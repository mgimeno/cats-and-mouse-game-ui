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

  private reconnectingDialogRef: MatDialogRef<LoadingDialogComponent> | null = null;

  private readonly CHUNK_ERROR_PATTERNS = [
    /Loading chunk [\w.-]+ failed/i,
    /ChunkLoadError/i,
    /Failed to fetch dynamically imported module/i,
    /error loading dynamically imported module/i,
    /Importing a module script failed/i
  ];

  private isStaleChunkError(event: NavigationError): boolean {
    const msg = event.error?.message ?? String(event.error ?? '');
    return this.CHUNK_ERROR_PATTERNS.some(pattern => pattern.test(msg));
  }

  constructor() {
    this.watchConnectionStatus();
    this.addTitleAndMetaTags();
    this.createBrowserUserId();
    this.signalrService.startConnection();

    const unsubscribe = this.signalrService.subscribeToMethod<IPlayerHasInProgressGameMessage>(
      'HasInProgressGame',
      message => {
        void this.router.navigate([message.hasInProgressGame ? '/play' : '/']);
      }
    );

    this.destroyRef.onDestroy(() => {
      unsubscribe();
      this.reconnectingDialogRef?.close();
    });

    this.router.events
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(event => event instanceof NavigationError),
        filter((event: NavigationError) => this.isStaleChunkError(event))
      )
      .subscribe((event: NavigationError) => {
        // A new deployment has produced new chunk filenames.  The currently
        // running (old) app still references the deleted chunks, so lazy-load
        // navigations fail.  Reload to fetch the new index.html and its
        // up-to-date chunk references.
        console.error(`Stale chunk detected. Reloading: ${event.url}`, event);
        window.location.assign(event.url || window.location.href);
      });
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
