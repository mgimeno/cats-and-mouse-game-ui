import { ChangeDetectionStrategy, Component, type OnDestroy, type OnInit, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { LucideAngularModule, Send } from 'lucide-angular';

import { type IChatLine } from '../../../shared/interfaces/chat-line.interface';
import { type IChatMessage } from '../../../shared/interfaces/chat-message.interface';
import { type IPlayerHasLeftGameMessage } from 'src/app/shared/interfaces/player-has-left-game-message';
import { type IPlayerHasSurrenderedMessage } from 'src/app/shared/interfaces/player-has-surrendered-message';
import { type IPlayerOnlyConnectionStatusChangedMessage } from 'src/app/shared/interfaces/player-only-connection-status-changed-message';
import { type IPlayerWantsRematchMessage } from 'src/app/shared/interfaces/player-wants-rematch-message';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { SignalrService } from '../../../shared/services/signalr-service';
import { TeamEnum } from '../../../shared/enums/team.enum';

@Component({
  selector: 'app-chat',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, LucideAngularModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComponent implements OnInit, OnDestroy {
  readonly gameId = input.required<string>();
  readonly canSendMessages = input.required<boolean>();

  private readonly signalrService = inject(SignalrService);
  private readonly notificationService = inject(NotificationService);
  private readonly unsubscribeCallbacks: (() => void)[] = [];

  readonly formGroup = new FormGroup({
    message: new FormControl<string | null>(null, control => Validators.required(control))
  });
  readonly chatLines = signal<IChatLine[]>([]);
  readonly teamEnum = TeamEnum;
  readonly sendIcon = Send;
  readonly sendPlaceholder = $localize`:@@chat.send_placeholder:Send a message...`;

  ngOnInit(): void {
    this.unsubscribeCallbacks.push(
      this.signalrService.subscribeToMethod<IChatMessage>('ChatMessage', message => {
        if (message.gameId === this.gameId()) {
          this.addMessage({
            ...message.chatLine,
            class: message.chatLine.teamId === TeamEnum.Cats ? 'black' : 'white'
          });
        }
      }),
      this.signalrService.subscribeToMethod<IPlayerHasLeftGameMessage>('PlayerHasLeftGame', message => {
        if (message.gameId === this.gameId()) {
          this.addMessage({
            userName: message.userName,
            teamId: message.teamId,
            message: `${message.userName} ${$localize`:@@chat.player_has_left:has left the game.`}`,
            class: 'red'
          });
        }
      }),
      this.signalrService.subscribeToMethod<IPlayerWantsRematchMessage>('PlayerWantsRematch', message => {
        if (message.gameId === this.gameId()) {
          this.addMessage({
            userName: message.userName,
            teamId: message.teamId,
            message: `${message.userName} ${$localize`:@@chat.player_wants_rematch: wants a rematch.`}`,
            class: message.teamId === TeamEnum.Cats ? 'black' : 'white'
          });
        }
      }),
      this.signalrService.subscribeToMethod<IPlayerHasSurrenderedMessage>('PlayerHasSurrendered', message => {
        if (message.gameId === this.gameId()) {
          this.addMessage({
            userName: message.userName,
            teamId: message.teamId,
            message: `${message.userName} ${$localize`:@@chat.player_has_surrendered:has surrendered.`}`,
            class: message.teamId === TeamEnum.Cats ? 'black' : 'white'
          });
        }
      }),
      this.signalrService.subscribeToMethod<IPlayerOnlyConnectionStatusChangedMessage>(
        'PlayerOnlyConnectionStatusChanged',
        message => {
          if (message.gameId === this.gameId()) {
            this.addMessage({
              userName: message.userName,
              teamId: message.teamId,
              message: `${message.userName} ${message.isConnected ? $localize`:@@chat.player_has_reconnected:has reconnected.` : $localize`:@@chat.player_has_disconnected:has disconnected.`}`,
              class: message.isConnected ? 'green' : 'red'
            });
          }
        }
      )
    );
  }

  isSubmitButtonDisabled(): boolean {
    return this.formGroup.controls.message.invalid;
  }

  onSubmit(): void {
    if (this.formGroup.invalid) {
      return;
    }

    const message = this.formGroup.controls.message.value?.trim();
    if (!message) {
      return;
    }

    this.signalrService
      .sendMessage('SendChatMessage', {
        gameId: this.gameId(),
        message
      })
      .then(() => {
        this.formGroup.controls.message.setValue(null);
      })
      .catch(reason => {
        console.error(reason);
        this.notificationService.showCommonError();
      });
  }

  ngOnDestroy(): void {
    this.unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
  }

  private addMessage(chatLine: IChatLine): void {
    this.chatLines.update(chatLines => [...chatLines.slice(-99), chatLine]);
  }
}
