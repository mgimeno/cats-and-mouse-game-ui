import { Component, OnInit, Inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { ILabelValue } from 'src/app/shared/interfaces/label-value.interface';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { environment } from 'src/environments/environment';
import { SignalrService } from '../../../shared/services/signalr-service';
import { IGameListItem } from '../../../shared/interfaces/game-list-item.interface';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { COMMON_CONSTANTS } from 'src/app/shared/constants/common';


@Component({
  templateUrl: './create-game-dialog.component.html',
  styleUrls: ['./create-game-dialog.component.scss']
})
export class CreateGameDialogComponent implements OnInit {

  formGroup: UntypedFormGroup = null;
  isGameCreated: boolean = false;
  joinGameUrl: string = null;
  isJoinGameLinkCopiedToClipboard: boolean = false;
  createdGame: IGameListItem = null;
  maxUsernameLength: number = COMMON_CONSTANTS.MAX_USERNAME_LENGTH;
  teams: ILabelValue[] = [{ label: TeamEnum[TeamEnum.Cats], value: TeamEnum.Cats }, { label: TeamEnum[TeamEnum.Mouse], value: TeamEnum.Mouse }];

  constructor(
    public dialogRef: MatDialogRef<CreateGameDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: IGameListItem,
    private signalrService: SignalrService,
    private notificationService: NotificationService) { }

  ngOnInit(): void {

    if(this.data){
      this.isGameCreated = true;

      this.createdGame = this.data;

      this.joinGameUrl = `${environment.websiteUrl}?joinGame=${this.data.gameId}`;
    }
    else{
      const previousUserName = localStorage.getItem(`${environment.localStoragePrefix}user-name`);

      this.formGroup = new UntypedFormGroup({
        'userName': new UntypedFormControl(previousUserName || null, [Validators.required, Validators.maxLength(this.maxUsernameLength)]),
        'teamId': new UntypedFormControl(null, Validators.required),
        'gamePassword': new UntypedFormControl(null)
      });
    }  
  }

  onSubmit(): void {

    if (this.formGroup.invalid) {
      if (this.formGroup.controls.userName.invalid) {
        this.notificationService.showError($localize`:@@error.missing_name:Type your name`);
      }
      else if (this.formGroup.controls.teamId.invalid) {
        this.notificationService.showError($localize`:@@error.missing_team:Select a team`);
      }

      return;
    }

    const userName = this.formGroup.controls.userName.value;

    const message = {
      userName: userName,
      teamId: this.formGroup.controls.teamId.value,
      gamePassword: this.formGroup.controls.gamePassword.value
    };

    localStorage.setItem(`${environment.localStoragePrefix}user-name`, userName);

    this.signalrService.sendMessage("CreateGame", message)
      .then((game: IGameListItem) => {

        this.isGameCreated = true;

        this.createdGame = game;

        this.joinGameUrl = `${environment.websiteUrl}?joinGame=${game.gameId}`;

      })
      .catch((reason: any) => {
        console.error(reason);
        this.notificationService.showCommonError();
      });

  }

  onCopyLinkClick(): void {
    this.isJoinGameLinkCopiedToClipboard = true;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onCancelGame(): void {

    const cancelGameModel = {
      gameId: this.createdGame.gameId,
      userId: localStorage.getItem(`${environment.localStoragePrefix}user-id`)
    };

    this.signalrService.sendMessage("CancelGameThatHasNotStarted", cancelGameModel)
      .catch((reason: any) => {
        console.error(reason);
        this.notificationService.showCommonError();
      });

    this.dialogRef.close();
  }

}
