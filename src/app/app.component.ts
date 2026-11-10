import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  type EffectCleanupRegisterFn,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationError, Router, RouterOutlet } from '@angular/router';

import { filter } from 'rxjs';
import { environment } from 'src/environments/environment';
import { getSupportedLanguage, localeByLanguage, supportedLanguages } from 'src/translations';
import { LoadingDialogComponent } from './components/loading-dialog/loading-dialog.component';
import { type IPlayerHasInProgressGameMessage } from './shared/interfaces/player-has-in-progress-game-message';
import { PageVisibilityService } from './shared/services/page-visibility.service';
import { SignalrService } from './shared/services/signalr-service';
import { ChunkLoadReloadService } from './shared/services/chunk-load-reload.service';
import { CommonHelper } from './shared/utils/common-util';

// A first connection usually completes well within this, and a dialog that flashes up
// and vanishes again reads as a glitch. Nothing is lost by waiting: hub calls made in
// the meantime queue until the connection is up.
const FIRST_CONNECTION_DIALOG_DELAY_MS = 500;

// Once shown, the first-connection dialog stays at least this long, so a connection
// that lands just after the delay expires does not make it blink in and straight back
// out. A reconnection dialog has no minimum: it is blocking a game in progress, so the
// board is handed back the moment the connection is.
const FIRST_CONNECTION_DIALOG_MIN_VISIBLE_MS = 400;

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
  private readonly pageVisibilityService = inject(PageVisibilityService);

  private connectionDialogRef: MatDialogRef<LoadingDialogComponent> | null = null;
  private connectionDialogMinVisibleUntil = 0;

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
      this.closeConnectionDialog();
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
    effect(onCleanup => {
      // A player who is not looking gains nothing from this dialog, and one opened in
      // the background would still be sitting there on their return even though the
      // connection has since recovered. Reconnection itself continues either way.
      if (!this.pageVisibilityService.visible()) {
        this.closeConnectionDialog();
        return;
      }

      if (this.signalrService.connected()) {
        this.scheduleAfter(
          this.getConnectionDialogRemainingMinVisibleMs(),
          () => this.closeConnectionDialog(),
          onCleanup
        );
        return;
      }

      if (this.connectionDialogRef) {
        return;
      }

      // Only the first connection gets a grace period. Losing a connection the player
      // already had blocks the board at once, before they try a move that cannot land.
      const isFirstConnection = !this.signalrService.hasConnectedBefore();
      this.scheduleAfter(
        isFirstConnection ? FIRST_CONNECTION_DIALOG_DELAY_MS : 0,
        () => this.openConnectionDialog(isFirstConnection ? FIRST_CONNECTION_DIALOG_MIN_VISIBLE_MS : 0),
        onCleanup
      );
    });
  }

  /**
   * Runs `action` now, or after `delayMs` unless the effect re-runs first. Any change
   * to the connection or visibility re-runs the effect, which cancels a pending action
   * that no longer fits the new state.
   */
  private scheduleAfter(delayMs: number, action: () => void, onCleanup: EffectCleanupRegisterFn): void {
    if (delayMs <= 0) {
      action();
      return;
    }

    const timeoutId = setTimeout(action, delayMs);
    onCleanup(() => clearTimeout(timeoutId));
  }

  private getConnectionDialogRemainingMinVisibleMs(): number {
    if (!this.connectionDialogRef) {
      return 0;
    }

    return this.connectionDialogMinVisibleUntil - performance.now();
  }

  private openConnectionDialog(minVisibleMs: number): void {
    this.connectionDialogMinVisibleUntil = performance.now() + minVisibleMs;
    this.connectionDialogRef = this.dialog.open(LoadingDialogComponent, {
      data: { dialogTitle: $localize`:@@loading_dialog.connecting:Connecting to server` },
      // Only the connection coming back may dismiss it. Escape or a backdrop click
      // would leave the player on a board whose moves cannot reach the server.
      disableClose: true,
      height: '100%',
      width: '100%'
    });
  }

  private closeConnectionDialog(): void {
    this.connectionDialogRef?.close();
    this.connectionDialogRef = null;
  }
}
