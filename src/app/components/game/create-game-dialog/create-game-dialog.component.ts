import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { COMMON_CONSTANTS } from 'src/app/shared/constants/common';
import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { type IGameListItem } from 'src/app/shared/interfaces/game-list-item.interface';
import { type ILabelValue } from 'src/app/shared/interfaces/label-value.interface';
import { LoaderComponent } from 'src/app/shared/components/loader/loader.component';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { SignalrService } from '../../../shared/services/signalr-service';
import {
  TeamSelectComponent,
  type TeamFormControls
} from 'src/app/shared/components/team-select/team-select.component';
import { environment } from 'src/environments/environment';

interface ShareLink {
  label: string;
  href: string;
  className: string;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    LoaderComponent,
    TeamSelectComponent
  ],
  templateUrl: './create-game-dialog.component.html',
  styleUrls: ['./create-game-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateGameDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateGameDialogComponent>);
  private readonly data = inject<IGameListItem | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly signalrService = inject(SignalrService);
  private readonly notificationService = inject(NotificationService);

  readonly isGameCreated = signal(false);
  readonly joinGameUrl = signal<string | null>(null);
  readonly isJoinGameLinkCopiedToClipboard = signal(false);
  readonly createdGame = signal<IGameListItem | null>(null);
  readonly maxUsernameLength = COMMON_CONSTANTS.MAX_USERNAME_LENGTH;
  readonly copyLinkText = $localize`:@@create.copy_link:Copy link`;
  readonly shareText = $localize`:@@create.share_text:Join my Cats & Mouse game:`;
  readonly shareLinks = computed<ShareLink[]>(() => {
    const joinGameUrl = this.joinGameUrl();
    if (!joinGameUrl) {
      return [];
    }

    const encodedUrl = encodeURIComponent(joinGameUrl);
    const shareText = encodeURIComponent(`${this.shareText} ${joinGameUrl}`);

    return [
      {
        label: 'WhatsApp',
        href: `https://wa.me/?text=${shareText}`,
        className: 'whatsapp'
      },
      {
        label: 'Telegram',
        href: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(this.shareText)}`,
        className: 'telegram'
      },
      {
        label: 'Messenger',
        href: `fb-messenger://share?link=${encodedUrl}`,
        className: 'messenger'
      },
      {
        label: 'Instagram',
        href: `instagram://sharesheet?text=${shareText}`,
        className: 'instagram'
      }
    ];
  });

  readonly teams: ILabelValue[] = [
    { label: TeamEnum[TeamEnum.Cats], value: TeamEnum.Cats },
    { label: TeamEnum[TeamEnum.Mouse], value: TeamEnum.Mouse }
  ];

  readonly formGroup = new FormGroup<TeamFormControls>({
    userName: new FormControl<string | null>(localStorage.getItem(`${environment.localStoragePrefix}user-name`), [
      control => Validators.required(control),
      control => Validators.maxLength(this.maxUsernameLength)(control)
    ]),
    teamId: new FormControl<TeamEnum | null>(null, control => Validators.required(control)),
    gamePassword: new FormControl<string | null>(null)
  });

  constructor() {
    if (this.data) {
      this.isGameCreated.set(true);
      this.createdGame.set(this.data);
      this.joinGameUrl.set(this.getJoinGameUrl(this.data.gameId));
    }
  }

  onSubmit(): void {
    if (this.formGroup.invalid) {
      if (this.formGroup.controls.userName.invalid) {
        this.notificationService.showError($localize`:@@error.missing_name:Type your name`);
      } else if (this.formGroup.controls.teamId.invalid) {
        this.notificationService.showError($localize`:@@error.missing_team:Select a team`);
      }

      return;
    }

    const userName = this.formGroup.controls.userName.value?.trim();
    const teamId = this.formGroup.controls.teamId.value;
    if (!userName || teamId === null) {
      return;
    }

    const message = {
      userName,
      teamId,
      gamePassword: this.formGroup.controls.gamePassword.value
    };

    localStorage.setItem(`${environment.localStoragePrefix}user-name`, userName);

    this.signalrService
      .sendMessage<IGameListItem>('CreateGame', message)
      .then(game => {
        this.isGameCreated.set(true);
        this.createdGame.set(game);
        this.joinGameUrl.set(this.getJoinGameUrl(game.gameId));
      })
      .catch(reason => {
        console.error(reason);
        this.notificationService.showCommonError();
      });
  }

  async onCopyLinkClick(): Promise<void> {
    const joinGameUrl = this.joinGameUrl();
    if (!joinGameUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(joinGameUrl);
      this.isJoinGameLinkCopiedToClipboard.set(true);
    } catch (reason) {
      console.error(reason);
      this.notificationService.showCommonError();
    }
  }

  onShareLinkClick(shareLink: ShareLink): void {
    if (shareLink.href.startsWith('http')) {
      window.open(shareLink.href, '_blank', 'noopener,noreferrer');
      return;
    }

    window.location.href = shareLink.href;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onCancelGame(): void {
    const createdGame = this.createdGame();
    if (!createdGame) {
      this.dialogRef.close();
      return;
    }

    const cancelGameModel = {
      gameId: createdGame.gameId,
      userId: localStorage.getItem(`${environment.localStoragePrefix}user-id`)
    };

    this.signalrService.sendMessage('CancelGameThatHasNotStarted', cancelGameModel).catch(reason => {
      console.error(reason);
      this.notificationService.showCommonError();
    });

    this.dialogRef.close();
  }

  private getJoinGameUrl(gameId: string): string {
    return `${environment.websiteUrl}?joinGame=${gameId}`;
  }
}
