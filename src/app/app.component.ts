import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationError, Router, RouterOutlet } from '@angular/router';

import { filter } from 'rxjs';
import { environment } from 'src/environments/environment';
import { getSupportedLanguage, localeByLanguage, supportedLanguages } from 'src/translations';
import { LoadingDialogComponent } from './components/loading-dialog/loading-dialog.component';
import { type IPlayerHasInProgressGameMessage } from './shared/interfaces/player-has-in-progress-game-message';
import { SignalrService } from './shared/services/signalr-service';
import { ChunkLoadReloadService } from './shared/services/chunk-load-reload.service';
import { CommonHelper } from './shared/utils/common-util';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly signalrService = inject(SignalrService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly chunkLoadReloadService = inject(ChunkLoadReloadService);

  private reconnectingDialogRef: MatDialogRef<LoadingDialogComponent> | null = null;

  constructor() {
    this.watchConnectionStatus();
    this.addTitleAndMetaTags();
    this.createBrowserUserId();

    const unsubscribe = this.signalrService.subscribeToMethod<IPlayerHasInProgressGameMessage>(
      'HasInProgressGame',
      message => {
        if (message.hasInProgressGame) {
          void this.router.navigate(['/play']);
          return;
        }

        if (this.isOnPlayRoute()) {
          void this.router.navigate(['/']);
        }
      }
    );

    this.destroyRef.onDestroy(() => {
      unsubscribe();
      this.reconnectingDialogRef?.close();
    });

    this.router.events
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((event): event is NavigationError => event instanceof NavigationError),
        filter(event => this.chunkLoadReloadService.isChunkLoadError(event.error))
      )
      .subscribe((event: NavigationError) => {
        this.chunkLoadReloadService.reloadIfChunkLoadError(event.error, event.url);
      });
  }

  private isOnPlayRoute(): boolean {
    return this.router.url.split(/[?#]/, 1)[0] === '/play';
  }

  private createBrowserUserId(): void {
    const userId = localStorage.getItem(`${environment.localStoragePrefix}user-id`);
    if (!userId) {
      localStorage.setItem(`${environment.localStoragePrefix}user-id`, CommonHelper.getNewGuid());
    }
  }

  private addTitleAndMetaTags(): void {
    this.title.setTitle($localize`:@@index.title:Cats & Mouse. Multiplayer Game`);
    this.meta.updateTag({
      name: 'description',
      content: $localize`:@@index.meta_description:Play for free Cats and Mouse game on a chessboard. Play online with friends.`
    });
    this.meta.updateTag({ property: 'og:title', content: $localize`:@@index.title:Cats & Mouse. Multiplayer Game` });
    this.meta.updateTag({
      property: 'og:description',
      content: $localize`:@@index.meta_og_description:Play for free Cats and Mouse with friends`
    });

    const languageCode =
      getSupportedLanguage(localStorage.getItem(`${environment.localStoragePrefix}language`)) ?? 'en';
    this.meta.updateTag({ property: 'og:locale', content: localeByLanguage[languageCode] });

    while (this.meta.getTag('property="og:locale:alternate"')) {
      this.meta.removeTag('property="og:locale:alternate"');
    }

    this.meta.addTags(
      supportedLanguages
        .filter(supportedLanguage => supportedLanguage !== languageCode)
        .map(supportedLanguage => ({
          property: 'og:locale:alternate',
          content: localeByLanguage[supportedLanguage]
        })),
      true
    );
  }

  private watchConnectionStatus(): void {
    effect(() => {
      if (this.signalrService.connected()) {
        this.reconnectingDialogRef?.close();
        this.reconnectingDialogRef = null;
        return;
      }

      this.reconnectingDialogRef ??= this.dialog.open(LoadingDialogComponent, {
        data: { dialogTitle: $localize`:@@loading_dialog.connecting:Connecting to server` },
        height: '100%',
        width: '100%'
      });
    });
  }
}
