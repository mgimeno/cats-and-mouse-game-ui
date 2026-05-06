import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { COMMON_CONSTANTS } from 'src/app/shared/constants/common';
import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { type IGameListItem } from 'src/app/shared/interfaces/game-list-item.interface';
import { type ILabelValue } from 'src/app/shared/interfaces/label-value.interface';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { SignalrService } from '../../../shared/services/signalr-service';
import {
  TeamSelectComponent,
  type TeamFormControls
} from 'src/app/shared/components/team-select/team-select.component';
import { environment } from 'src/environments/environment';

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TeamSelectComponent
  ],
  templateUrl: './join-game-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JoinGameDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<JoinGameDialogComponent>);
  readonly data = inject<IGameListItem>(MAT_DIALOG_DATA);
  private readonly signalrService = inject(SignalrService);
  private readonly notificationService = inject(NotificationService);

  readonly maxUsernameLength = COMMON_CONSTANTS.MAX_USERNAME_LENGTH;
  readonly teamId = this.data.teamId === TeamEnum.Cats ? TeamEnum.Mouse : TeamEnum.Cats;
  readonly teams: ILabelValue[] = [
    { label: TeamEnum[TeamEnum.Cats], value: TeamEnum.Cats },
    { label: TeamEnum[TeamEnum.Mouse], value: TeamEnum.Mouse }
  ];

  readonly formGroup = new FormGroup<TeamFormControls>({
    userName: new FormControl<string | null>(localStorage.getItem(`${environment.localStoragePrefix}user-name`), [
      control => Validators.required(control),
      control => Validators.maxLength(this.maxUsernameLength)(control)
    ]),
    teamId: new FormControl<TeamEnum | null>({ value: this.teamId, disabled: true }, control =>
      Validators.required(control)
    ),
    gamePassword: new FormControl<string | null>(null)
  });

  constructor() {
    this.formGroup.controls.gamePassword.setValidators(
      this.data.isPasswordProtected ? control => Validators.required(control) : null
    );
    this.formGroup.controls.gamePassword.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.formGroup.invalid) {
      if (this.formGroup.controls.userName.invalid) {
        this.notificationService.showError($localize`:@@error.missing_name:Type your name`);
      }

      return;
    }

    const userName = this.formGroup.controls.userName.value?.trim();
    if (!userName) {
      return;
    }

    const message: { gameId: string; userName: string; gamePassword?: string } = {
      gameId: this.data.gameId,
      userName
    };

    localStorage.setItem(`${environment.localStoragePrefix}user-name`, userName);

    if (this.data.isPasswordProtected) {
      const gamePassword = this.formGroup.controls.gamePassword.value;
      if (gamePassword) {
        message.gamePassword = gamePassword;
      }
    }

    this.signalrService.sendMessage('JoinGame', message).catch(reason => {
      console.error(reason);
      this.notificationService.showCommonError();
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
