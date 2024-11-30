import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { IChatLine } from '../../../shared/interfaces/chat-line.interface';
import { SignalrService } from '../../../shared/services/signalr-service';
import { IChatMessage } from '../../../shared/interfaces/chat-message.interface';
import { TeamEnum } from '../../../shared/enums/team.enum';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { IPlayerHasLeftGameMessage } from 'src/app/shared/interfaces/player-has-left-game-message';
import { IPlayerWantsRematchMessage } from 'src/app/shared/interfaces/player-wants-rematch-message';
import { IPlayerHasSurrenderedMessage } from 'src/app/shared/interfaces/player-has-surrendered-message';
import { IPlayerOnlyConnectionStatusChangedMessage } from 'src/app/shared/interfaces/player-only-connection-status-changed-message';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy {

  @Input() gameId: string;
  @Input() canSendMessages: boolean;

  formGroup: FormGroup = null;
  chatLines: IChatLine[] = [];

  teamEnum = TeamEnum;

  sendPlaceholder: string = $localize`:@@chat.send_placeholder:Send a message...`;

  constructor(
    private signalrService: SignalrService,
    private cdRef: ChangeDetectorRef,
    private notificationService: NotificationService) {

    this.formGroup = new FormGroup({
      'message': new FormControl(null, [Validators.required])
    });
  }

  ngOnInit() : void {
    this.signalrService.subscribeToMethod("ChatMessage", (message: IChatMessage) => {
      if (message.gameId === this.gameId) {
        message.chatLine.class = (message.chatLine.teamId == TeamEnum.Cats ? "black" : "white");

        this.addMessage(message.chatLine);
      }
    });

    this.signalrService.subscribeToMethod("PlayerHasLeftGame", (message: IPlayerHasLeftGameMessage) => {

      if (message.gameId === this.gameId) {

        const chatLine = <IChatLine>{
          userName: message.userName,
          teamId: message.teamId,
          message: `${message.userName} ${$localize`:@@chat.player_has_left:has left the game.`}`,
          class: "red"
        };

        this.addMessage(chatLine);
      }

    });

    this.signalrService.subscribeToMethod("PlayerWantsRematch", (message: IPlayerWantsRematchMessage) => {

      if (message.gameId === this.gameId) {

        const chatLine = <IChatLine>{
          userName: message.userName,
          teamId: message.teamId,
          message: `${message.userName} ${$localize`:@@chat.player_wants_rematch: wants a rematch.`}`,
          class: (message.teamId == TeamEnum.Cats ? "black" : "white")
        };

        this.addMessage(chatLine);
      }

    });

    this.signalrService.subscribeToMethod("PlayerHasSurrendered", (message: IPlayerHasSurrenderedMessage) => {

      if (message.gameId === this.gameId) {

        const chatLine = <IChatLine>{
          userName: message.userName,
          teamId: message.teamId,
          message: `${message.userName} ${$localize`:@@chat.player_has_surrendered:has surrendered.`}`,
          class: (message.teamId == TeamEnum.Cats ? "black" : "white")
        };

        this.addMessage(chatLine);
      }

    });

    this.signalrService.subscribeToMethod("PlayerOnlyConnectionStatusChanged", (message: IPlayerOnlyConnectionStatusChangedMessage) => {

      if (message.gameId === this.gameId) {

        const chatLine = <IChatLine>{
          userName: message.userName,
          teamId: message.teamId,
          message: `${message.userName} ${message.isConnected ? $localize`:@@chat.player_has_reconnected:has reconnected.` : $localize`:@@chat.player_has_disconnected:has disconnected.`}`,
          class: message.isConnected ? "green" : "red"
        };

        this.addMessage(chatLine);
      }

    });

  }

  private addMessage(chatLine: IChatLine): void{
      this.chatLines.push(chatLine);
      this.cdRef.detectChanges();
  }

  isSubmitButtonDisabled(): boolean {
    return !this.formGroup.controls.message.value || !this.formGroup.controls.message.value.length;
  }

  onSubmit(): void {

    this.signalrService.sendMessage("SendChatMessage", { gameId: this.gameId, message: this.formGroup.controls.message.value })
      .then(() => {
        this.formGroup.controls.message.setValue(null);
      })
      .catch((reason: any) => {
        console.error(reason);
        this.notificationService.showCommonError();
      });

  }

  ngOnDestroy(): void {
    this.signalrService.unsubscribeToMethod("ChatMessage");
    this.signalrService.unsubscribeToMethod("PlayerHasLeftGame");
    this.signalrService.unsubscribeToMethod("PlayerWantsRematch");
    this.signalrService.unsubscribeToMethod("PlayerHasSurrendered");
    this.signalrService.unsubscribeToMethod("PlayerOnlyConnectionStatusChanged");
  }
}
