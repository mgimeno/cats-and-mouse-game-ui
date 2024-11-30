import { Component, Inject, OnInit } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { ILabelValue } from 'src/app/shared/interfaces/label-value.interface';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IGameListItem } from 'src/app/shared/interfaces/game-list-item.interface';
import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { SignalrService } from '../../../shared/services/signalr-service';
import { environment } from 'src/environments/environment';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { COMMON_CONSTANTS } from 'src/app/shared/constants/common';


@Component({
  templateUrl: './join-game-dialog.component.html',
  styleUrls: ['./join-game-dialog.component.scss']
})
export class JoinGameDialogComponent implements OnInit {

  formGroup: UntypedFormGroup = null;
  maxUsernameLength: number = COMMON_CONSTANTS.MAX_USERNAME_LENGTH;

  teams: ILabelValue[] = [{ label: TeamEnum[TeamEnum.Cats], value: TeamEnum.Cats }, { label: TeamEnum[TeamEnum.Mouse], value: TeamEnum.Mouse }];

  teamId: number = null;

  constructor(
    public dialogRef: MatDialogRef<JoinGameDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: IGameListItem,
    private signalrService: SignalrService,
    private notificationService: NotificationService) {
  }

  ngOnInit(): void {

    const previousUserName = localStorage.getItem(`${environment.localStoragePrefix}user-name`);
    this.teamId = (this.data.teamId == TeamEnum.Cats ? TeamEnum.Mouse : TeamEnum.Cats);

    this.formGroup = new UntypedFormGroup({
      'userName': new UntypedFormControl(previousUserName || null, [Validators.required, Validators.maxLength(this.maxUsernameLength)]),
      'teamId': new UntypedFormControl({ value: this.teamId, disabled: true }, Validators.required)
    });

    if (this.data.isPasswordProtected) {
      this.formGroup.addControl("gamePassword", new UntypedFormControl(null, Validators.required));
    }
  }

  onSubmit(): void {

    if (this.formGroup.invalid) {
      if (this.formGroup.controls.userName.invalid) {
        this.notificationService.showError($localize`:@@error.missing_name:Type your name`);
      }

      return;
    }

    const userName = this.formGroup.controls.userName.value;

    let message: any = {
      gameId: this.data.gameId,
      userName: userName
    };

    localStorage.setItem(`${environment.localStoragePrefix}user-name`, userName);

    if (this.data.isPasswordProtected) {
      message.gamePassword = this.formGroup.controls.gamePassword.value;
    }

    this.signalrService.sendMessage("JoinGame", message)
      .catch((reason: any) => {
        console.error(reason);
        this.notificationService.showCommonError();
      });

  }

  onCancel(): void {
    this.dialogRef.close();
  }

}
