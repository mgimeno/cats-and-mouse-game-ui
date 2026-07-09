import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { FigureTypeEnum } from 'src/app/shared/enums/figure-type.enum';
import { MessageToClientTypeEnum } from 'src/app/shared/enums/message-to-client-type.enum';
import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { type IGameStatus } from 'src/app/shared/interfaces/game-status.interface';
import { type IGameStatusMessage } from 'src/app/shared/interfaces/game-status-message.interface';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { SignalrService } from 'src/app/shared/services/signalr-service';
import { PlayGameComponent } from './play-game.component';

describe('PlayGameComponent', () => {
  let fixture: ComponentFixture<PlayGameComponent>;
  let component: PlayGameComponent;
  let signalrService: {
    sendMessage: ReturnType<typeof vi.fn>;
    subscribeToMethod: ReturnType<typeof vi.fn>;
  };
  let subscriptions: Map<string, (message: unknown) => void>;
  let audioPlay: ReturnType<typeof vi.fn>;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let notificationService: { showCommonError: ReturnType<typeof vi.fn>; showError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    subscriptions = new Map();
    audioPlay = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      class {
        play = audioPlay;
      }
    );

    signalrService = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      subscribeToMethod: vi.fn((methodName: string, callback: (message: unknown) => void) => {
        subscriptions.set(methodName, callback);
        return vi.fn();
      })
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    notificationService = { showCommonError: vi.fn(), showError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PlayGameComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SignalrService, useValue: signalrService },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notificationService },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatBottomSheet, useValue: { open: vi.fn(() => ({ afterDismissed: () => of(false) })) } }
      ]
    })
      .overrideComponent(PlayGameComponent, {
        set: { template: '', imports: [] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(PlayGameComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('loads game status, updates the board, and auto-selects the only movable own piece', () => {
    component.ngOnInit();

    emitGameStatus(gameStatusWithOneMovableCat());

    expect(signalrService.sendMessage).toHaveBeenCalledWith('SendInProgressGameStatusToCaller');
    expect(component.gameStatus()?.gameId).toBe('game-1');
    expect(component.turnInfoState()).toBe('MyTurn');
    expect(component.gameInfo()).toEqual({
      header: 'Your turn!',
      subHeader: 'select a cat and then move it',
      colourClass: 'green'
    });
    expect(component.chessBoard()[2][1].figure?.id).toBe(1);
    expect(component.chessBoard()[2][1].isFigureSelected).toBe(true);
    expect(component.chessBoard()[3][0].canBeNewPositionForSelectedFigure).toBe(true);
    expect(component.chessBoard()[3][2].canBeNewPositionForSelectedFigure).toBe(true);
    expect(audioPlay).toHaveBeenCalledOnce();
  });

  it('subscribes to game status before requesting the current game', () => {
    component.ngOnInit();

    expect(signalrService.subscribeToMethod).toHaveBeenCalledWith('GameStatus', expect.any(Function));
    expect(signalrService.subscribeToMethod.mock.invocationCallOrder[0]).toBeLessThan(
      signalrService.sendMessage.mock.invocationCallOrder[0]
    );
  });

  it('selects among multiple movable figures and sends the selected move', () => {
    component.ngOnInit();
    emitGameStatus(gameStatusWithTwoMovableCats());

    component.onChessBoxClicked(2, 1);
    component.onChessBoxClicked(3, 0);

    expect(component.chessBoard()[2][1].isFigureSelected).toBe(true);
    expect(signalrService.sendMessage).toHaveBeenCalledWith('Move', {
      figureId: 1,
      rowIndex: 3,
      columnIndex: 0
    });
  });

  it('does not select or move when it is not this player turn', () => {
    component.ngOnInit();
    emitGameStatus({
      ...gameStatusWithTwoMovableCats(),
      players: [
        { ...gameStatusWithTwoMovableCats().players[0], isTheirTurn: false },
        { ...gameStatusWithTwoMovableCats().players[1], isTheirTurn: true }
      ]
    });

    component.onChessBoxClicked(2, 1);
    component.onChessBoxClicked(3, 0);

    expect(component.chessBoxCurrentlySelected()).toBeNull();
    expect(signalrService.sendMessage).not.toHaveBeenCalledWith('Move', expect.anything());
  });

  it('shows rematch only after game over and resets a sent rematch when a new game starts', () => {
    component.ngOnInit();
    emitGameStatus({
      ...gameStatusWithOneMovableCat(),
      players: [
        { ...gameStatusWithOneMovableCat().players[0], isWinner: true, isTheirTurn: false },
        { ...gameStatusWithOneMovableCat().players[1], isTheirTurn: false }
      ]
    });

    component.sendRematchRequest();
    component.sendRematchRequest();

    expect(component.isRematchButtonVisible()).toBe(true);
    expect(component.isRematchButtonEnabled()).toBe(false);
    expect(signalrService.sendMessage).toHaveBeenCalledTimes(2);
    expect(signalrService.sendMessage).toHaveBeenLastCalledWith('PlayerWantsToRematch', { gameId: 'game-1' });

    emitGameStatus(gameStatusWithOneMovableCat());

    expect(component.hasSentRematchRequest()).toBe(false);
  });

  it('routes home and shows an error when loading the in-progress game fails', async () => {
    signalrService.sendMessage.mockRejectedValueOnce(new Error('missing'));

    component.ngOnInit();
    await Promise.resolve();

    expect(notificationService.showError).toHaveBeenCalledWith('Game does not exist');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  function emitGameStatus(gameStatus: IGameStatus): void {
    const callback = subscriptions.get('GameStatus');

    expect(callback).toBeDefined();
    callback?.({ typeId: MessageToClientTypeEnum.GameStatus, gameStatus } satisfies IGameStatusMessage);
  }
});

function gameStatusWithOneMovableCat(): IGameStatus {
  return {
    gameId: 'game-1',
    myPlayerIndex: 0,
    players: [
      {
        name: 'Marta',
        teamId: TeamEnum.Cats,
        isTheirTurn: true,
        isWinner: false,
        hasUserLeftTheGame: false,
        figures: [
          {
            id: 1,
            typeId: FigureTypeEnum.Cat,
            position: { rowIndex: 2, columnIndex: 1 },
            canMoveToPositions: [
              { rowIndex: 3, columnIndex: 0 },
              { rowIndex: 3, columnIndex: 2 }
            ]
          },
          {
            id: 2,
            typeId: FigureTypeEnum.Cat,
            position: { rowIndex: 2, columnIndex: 3 },
            canMoveToPositions: []
          }
        ]
      },
      {
        name: 'Alex',
        teamId: TeamEnum.Mouse,
        isTheirTurn: false,
        isWinner: false,
        hasUserLeftTheGame: false,
        figures: [
          {
            id: 9,
            typeId: FigureTypeEnum.Mouse,
            position: { rowIndex: 5, columnIndex: 4 },
            canMoveToPositions: [{ rowIndex: 4, columnIndex: 3 }]
          }
        ]
      }
    ]
  };
}

function gameStatusWithTwoMovableCats(): IGameStatus {
  const gameStatus = gameStatusWithOneMovableCat();

  return {
    ...gameStatus,
    players: [
      {
        ...gameStatus.players[0],
        figures: [
          gameStatus.players[0].figures[0],
          {
            ...gameStatus.players[0].figures[1],
            canMoveToPositions: [{ rowIndex: 3, columnIndex: 4 }]
          }
        ]
      },
      gameStatus.players[1]
    ]
  };
}
