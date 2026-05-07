import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type OnDestroy,
  type OnInit,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { NotificationService } from 'src/app/shared/services/notification.service';
import { TeamEnum } from '../../../shared/enums/team.enum';
import { type IChatLine } from '../../../shared/interfaces/chat-line.interface';
import { type GameFeedEvent, SignalrService } from '../../../shared/services/signalr-service';

@Component({
  selector: 'app-chat',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTooltipModule],
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
    message: new FormControl<string | null>(null)
  });
  readonly chatLines = signal<IChatLine[]>([]);
  readonly chatHistory = viewChild<ElementRef<HTMLElement>>('chatHistory');
  readonly teamEnum = TeamEnum;
  readonly sendPlaceholder = $localize`:@@chat.send_placeholder:Send a message...`;
  readonly sendLabel = $localize`:@@chat.send:Send`;

  ngOnInit(): void {
    this.unsubscribeCallbacks.push(
      this.signalrService.subscribeToGameFeed(event => {
        if (event.message.gameId !== this.gameId()) {
          return false;
        }

        this.addGameFeedEvent(event);
        return true;
      })
    );
  }

  isSubmitButtonDisabled(): boolean {
    return !this.formGroup.controls.message.value?.trim();
  }

  onSubmit(): void {
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
    this.scrollConversationToBottom();
  }

  private addGameFeedEvent(event: GameFeedEvent): void {
    switch (event.methodName) {
      case 'ChatMessage':
        this.addMessage({
          ...event.message.chatLine,
          class: event.message.chatLine.teamId === TeamEnum.Cats ? 'black' : 'white'
        });
        return;

      case 'PlayerHasLeftGame':
        this.addMessage({
          userName: event.message.userName,
          teamId: event.message.teamId,
          message: `${event.message.userName} ${$localize`:@@chat.player_has_left:has left the game`}`,
          class: 'red'
        });
        return;

      case 'PlayerWantsRematch':
        this.addMessage({
          userName: event.message.userName,
          teamId: event.message.teamId,
          message: `${event.message.userName} ${$localize`:@@chat.player_wants_rematch: wants a rematch`}`,
          class: event.message.teamId === TeamEnum.Cats ? 'black' : 'white'
        });
        return;

      case 'PlayerHasSurrendered':
        this.addMessage({
          userName: event.message.userName,
          teamId: event.message.teamId,
          message: `${event.message.userName} ${$localize`:@@chat.player_has_surrendered:has surrendered`}`,
          class: event.message.teamId === TeamEnum.Cats ? 'black' : 'white'
        });
        return;

      case 'PlayerOnlyConnectionStatusChanged':
        this.addMessage({
          userName: event.message.userName,
          teamId: event.message.teamId,
          message: `${event.message.userName} ${event.message.isConnected ? $localize`:@@chat.player_has_reconnected:has reconnected` : $localize`:@@chat.player_has_disconnected:has disconnected`}`,
          class: event.message.isConnected ? 'green' : 'red'
        });
        return;
    }
  }

  private scrollConversationToBottom(): void {
    requestAnimationFrame(() => {
      const chatHistoryElement = this.chatHistory()?.nativeElement;
      if (!chatHistoryElement) {
        return;
      }

      chatHistoryElement.scrollTop = chatHistoryElement.scrollHeight;
    });
  }
}
