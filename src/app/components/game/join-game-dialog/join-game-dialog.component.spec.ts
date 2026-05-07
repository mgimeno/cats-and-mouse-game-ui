import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { type IGameListItem } from 'src/app/shared/interfaces/game-list-item.interface';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { SignalrService } from 'src/app/shared/services/signalr-service';
import { environment } from 'src/environments/environment';
import { JoinGameDialogComponent } from './join-game-dialog.component';

describe('JoinGameDialogComponent', () => {
  let fixture: ComponentFixture<JoinGameDialogComponent>;
  let component: JoinGameDialogComponent;
  let signalrService: { sendMessage: ReturnType<typeof vi.fn> };
  let notificationService: { showError: ReturnType<typeof vi.fn>; showCommonError: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('chooses the opposite team and requires a password for protected games', async () => {
    await setup(awaitingGame({ teamId: TeamEnum.Cats, isPasswordProtected: true }));

    component.formGroup.controls.userName.setValue('Marta');
    component.formGroup.controls.gamePassword.setValue(null);
    component.onSubmit();

    expect(component.teamId).toBe(TeamEnum.Mouse);
    expect(signalrService.sendMessage).not.toHaveBeenCalled();
  });

  it('rejects blank names with a clear error', async () => {
    await setup(awaitingGame({ isPasswordProtected: false }));

    component.formGroup.controls.userName.setValue('   ');
    component.onSubmit();

    expect(notificationService.showError).toHaveBeenCalledWith('Type your name');
    expect(signalrService.sendMessage).not.toHaveBeenCalled();
  });

  it('joins a protected game with trimmed name and password', async () => {
    await setup(awaitingGame({ isPasswordProtected: true }));
    component.formGroup.controls.userName.setValue('  Alex  ');
    component.formGroup.controls.gamePassword.setValue('secret');

    component.onSubmit();

    expect(signalrService.sendMessage).toHaveBeenCalledWith('JoinGame', {
      gameId: 'game-1',
      userName: 'Alex',
      gamePassword: 'secret'
    });
    expect(localStorage.getItem(`${environment.localStoragePrefix}user-name`)).toBe('Alex');
  });

  it('joins a public game without sending an empty password', async () => {
    await setup(awaitingGame({ isPasswordProtected: false }));
    component.formGroup.controls.userName.setValue('Alex');
    component.formGroup.controls.gamePassword.setValue('ignored');

    component.onSubmit();

    expect(signalrService.sendMessage).toHaveBeenCalledWith('JoinGame', {
      gameId: 'game-1',
      userName: 'Alex'
    });
  });

  it('closes the dialog on cancel', async () => {
    await setup(awaitingGame({ isPasswordProtected: false }));

    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledOnce();
  });

  async function setup(data: IGameListItem): Promise<void> {
    localStorage.clear();
    signalrService = { sendMessage: vi.fn().mockResolvedValue(undefined) };
    notificationService = { showError: vi.fn(), showCommonError: vi.fn() };
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [JoinGameDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SignalrService, useValue: signalrService },
        { provide: NotificationService, useValue: notificationService },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data }
      ]
    })
      .overrideComponent(JoinGameDialogComponent, {
        set: { template: '', imports: [] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(JoinGameDialogComponent);
    component = fixture.componentInstance;
  }
});

function awaitingGame(overrides: Partial<IGameListItem>): IGameListItem {
  return {
    gameId: 'game-1',
    userId: 'creator-1',
    userName: 'Marta',
    teamId: TeamEnum.Mouse,
    isPasswordProtected: false,
    ...overrides
  };
}
