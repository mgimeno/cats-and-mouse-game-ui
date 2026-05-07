import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { type IGameListItem } from 'src/app/shared/interfaces/game-list-item.interface';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { SignalrService } from 'src/app/shared/services/signalr-service';
import { environment } from 'src/environments/environment';
import { CreateGameDialogComponent } from './create-game-dialog.component';

describe('CreateGameDialogComponent', () => {
  let fixture: ComponentFixture<CreateGameDialogComponent>;
  let component: CreateGameDialogComponent;
  let signalrService: { sendMessage: ReturnType<typeof vi.fn> };
  let notificationService: {
    showError: ReturnType<typeof vi.fn>;
    showCommonError: ReturnType<typeof vi.fn>;
    showSuccess: ReturnType<typeof vi.fn>;
  };
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    signalrService = { sendMessage: vi.fn().mockResolvedValue(createdGame()) };
    notificationService = { showError: vi.fn(), showCommonError: vi.fn(), showSuccess: vi.fn() };
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CreateGameDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SignalrService, useValue: signalrService },
        { provide: NotificationService, useValue: notificationService },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: null }
      ]
    })
      .overrideComponent(CreateGameDialogComponent, {
        set: { template: '', imports: [] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(CreateGameDialogComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('rejects blank names and missing teams with clear errors', () => {
    component.formGroup.controls.userName.setValue('   ');
    component.formGroup.controls.teamId.setValue(null);

    component.onSubmit();

    expect(signalrService.sendMessage).not.toHaveBeenCalled();
    expect(notificationService.showError).toHaveBeenCalledWith('Type your name');

    component.formGroup.controls.userName.setValue('Marta');
    component.onSubmit();

    expect(notificationService.showError).toHaveBeenLastCalledWith('Select a team');
  });

  it('creates a game with a trimmed name and stores the player name', async () => {
    component.formGroup.setValue({
      userName: '  Marta  ',
      teamId: TeamEnum.Cats,
      gamePassword: 'secret'
    });

    component.onSubmit();
    await Promise.resolve();

    expect(signalrService.sendMessage).toHaveBeenCalledWith('CreateGame', {
      userName: 'Marta',
      teamId: TeamEnum.Cats,
      gamePassword: 'secret'
    });
    expect(localStorage.getItem(`${environment.localStoragePrefix}user-name`)).toBe('Marta');
    expect(component.isGameCreated()).toBe(true);
    expect(component.createdGame()).toEqual(createdGame());
    expect(component.joinGameUrl()).toBe(`${environment.websiteUrl}?joinGame=game-1`);
  });

  it('copies the share link when native share is not available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    component.joinGameUrl.set('https://example.test?joinGame=game-1');

    await component.onShareLinkClick();

    expect(writeText).toHaveBeenCalledWith('https://example.test?joinGame=game-1');
    expect(notificationService.showSuccess).toHaveBeenCalledWith('Link copied');
  });

  it('shares only the game URL when native share is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    component.joinGameUrl.set('https://example.test?joinGame=game-1');

    await component.onShareLinkClick();

    expect(share).toHaveBeenCalledWith({
      url: 'https://example.test?joinGame=game-1'
    });
  });

  it('cancels a created game before closing the dialog', () => {
    localStorage.setItem(`${environment.localStoragePrefix}user-id`, 'user-1');
    component.createdGame.set(createdGame());

    component.onCancelGame();

    expect(signalrService.sendMessage).toHaveBeenCalledWith('CancelGameThatHasNotStarted', {
      gameId: 'game-1',
      userId: 'user-1'
    });
    expect(dialogRef.close).toHaveBeenCalledOnce();
  });
});

function createdGame(): IGameListItem {
  return {
    gameId: 'game-1',
    userId: 'user-1',
    userName: 'Marta',
    teamId: TeamEnum.Cats,
    isPasswordProtected: true
  };
}
