import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { MessageToClientTypeEnum } from 'src/app/shared/enums/message-to-client-type.enum';
import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { type IGameListItem } from 'src/app/shared/interfaces/game-list-item.interface';
import { type IGameListMessage } from 'src/app/shared/interfaces/game-list-message.interface';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { SignalrService } from 'src/app/shared/services/signalr-service';
import { environment } from 'src/environments/environment';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let signalrService: {
    sendMessage: ReturnType<typeof vi.fn>;
    subscribeToMethod: ReturnType<typeof vi.fn>;
  };
  let subscriptions: Map<string, (message: unknown) => void>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let notificationService: { showCommonError: ReturnType<typeof vi.fn>; showError: ReturnType<typeof vi.fn> };
  let queryParamGet: ReturnType<typeof vi.fn>;
  let dialogRefs: { close: ReturnType<typeof vi.fn> }[];

  beforeEach(async () => {
    localStorage.clear();
    subscriptions = new Map();
    dialogRefs = [];
    signalrService = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      subscribeToMethod: vi.fn((methodName: string, callback: (message: unknown) => void) => {
        subscriptions.set(methodName, callback);
        return vi.fn();
      })
    };
    dialog = {
      open: vi.fn(() => {
        const ref = { close: vi.fn() };
        dialogRefs.push(ref);
        return ref;
      })
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    notificationService = { showCommonError: vi.fn(), showError: vi.fn() };
    queryParamGet = vi.fn(() => null);

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SignalrService, useValue: signalrService },
        { provide: NotificationService, useValue: notificationService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: queryParamGet
              }
            }
          }
        },
        { provide: MatDialog, useValue: dialog },
        { provide: MatBottomSheet, useValue: { open: vi.fn(() => ({ afterDismissed: () => of(undefined) })) } }
      ]
    })
      .overrideComponent(HomeComponent, {
        set: { template: '', imports: [] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('requests lobby state and filters out this user own game', () => {
    localStorage.setItem(`${environment.localStoragePrefix}user-id`, 'user-1');
    component.ngOnInit();

    emit('GameList', {
      typeId: MessageToClientTypeEnum.GameList,
      gameList: [game({ gameId: 'own', userId: 'user-1' }), game({ gameId: 'other', userId: 'user-2' })]
    } satisfies IGameListMessage);

    expect(signalrService.sendMessage).toHaveBeenCalledWith('SendWhetherHasInProgressGameToCaller');
    expect(signalrService.sendMessage).toHaveBeenCalledWith('SendGamesAwaitingForSecondPlayerToCallerAsync');
    expect(component.games()).toEqual([game({ gameId: 'other', userId: 'user-2' })]);
    expect(dialog.open).toHaveBeenCalledOnce();
  });

  it('opens join dialog from the URL only when the game exists', () => {
    queryParamGet.mockReturnValue('game-2');
    component.ngOnInit();

    emit('GameList', {
      typeId: MessageToClientTypeEnum.GameList,
      gameList: [game({ gameId: 'game-2', userId: 'user-2' })]
    } satisfies IGameListMessage);

    expect(router.navigate).toHaveBeenCalledWith([], expect.anything());
    expect(dialog.open).toHaveBeenCalledOnce();
    expect(notificationService.showError).not.toHaveBeenCalled();
  });

  it('shows an error for a missing join game', () => {
    component.games.set([]);

    component.openJoinGameDialog('missing');

    expect(dialog.open).not.toHaveBeenCalled();
    expect(notificationService.showError).toHaveBeenCalledWith('Game does not exist');
  });

  it('closes open dialogs and routes to play when the game starts', () => {
    component.ngOnInit();
    component.games.set([game({ gameId: 'game-1' })]);
    component.openCreateGameDialog(game({ gameId: 'game-1' }));
    component.openJoinGameDialog(game({ gameId: 'game-1' }).gameId);
    component.openHowToPlayDialog();

    emit('GameStart', {});

    expect(dialogRefs.every(ref => ref.close.mock.calls.length === 1)).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/play']);
  });

  function emit(methodName: string, message: unknown): void {
    const callback = subscriptions.get(methodName);

    expect(callback).toBeDefined();
    callback?.(message);
  }
});

function game(overrides: Partial<IGameListItem>): IGameListItem {
  return {
    gameId: 'game-1',
    userId: 'user-1',
    userName: 'Marta',
    teamId: TeamEnum.Cats,
    isPasswordProtected: false,
    ...overrides
  };
}
