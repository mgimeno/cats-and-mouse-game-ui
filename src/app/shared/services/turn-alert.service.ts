import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';

import { COMMON_CONSTANTS } from '../constants/common';
import { PageVisibilityService } from './page-visibility.service';

const TITLE_SEPARATOR = ' · ';

/**
 * Gets the player's attention when the game moves on without them.
 *
 * A sound alone is not enough: tabs get muted, phones get silenced, and neither
 * leaves any trace once it has played. The tab title and the app badge persist until
 * the player actually looks, and neither needs a permission prompt.
 */
@Injectable({
  providedIn: 'root'
})
export class TurnAlertService {
  private readonly pageVisibilityService = inject(PageVisibilityService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly beepAudio = new Audio(COMMON_CONSTANTS.BEEP_AUDIO_DATA);
  private readonly pendingLabel = signal<string | null>(null);

  private baseTitle: string | null = null;

  constructor() {
    effect(() => {
      const pendingLabel = this.pendingLabel();

      // Badge only while the player is away, which includes a visible-but-unfocused
      // window: a game parked on a second monitor is exactly the case a persistent
      // marker is for. Something needing attention while they are genuinely watching is
      // already on screen, but it starts badging the moment they look elsewhere.
      if (pendingLabel !== null && !this.pageVisibilityService.hasUserAttention()) {
        this.showBadge(pendingLabel);
        return;
      }

      this.hideBadge();
    });

    this.destroyRef.onDestroy(() => {
      this.hideBadge();
    });
  }

  /**
   * Plays the alert sound and starts badging until cleared. Safe to call on every
   * game update: the badge is keyed off `label`, so repeats do not stack.
   */
  alert(label: string): void {
    this.playBeep();
    this.pendingLabel.set(label);
  }

  clear(): void {
    this.pendingLabel.set(null);
  }

  private playBeep(): void {
    try {
      // Restart rather than ignore the call when two updates land back to back.
      this.beepAudio.currentTime = 0;
    } catch {
      // The element is not seekable yet; playing from wherever it is still alerts.
    }

    void this.beepAudio.play().catch((): void => undefined);
  }

  private showBadge(label: string): void {
    this.baseTitle ??= this.title.getTitle();
    this.title.setTitle(`${label}${TITLE_SEPARATOR}${this.baseTitle}`);

    if ('setAppBadge' in navigator) {
      // Only installed apps have somewhere to draw this, so a rejection is expected
      // in a plain tab and is not worth reporting.
      void navigator.setAppBadge(1).catch((): void => undefined);
    }
  }

  private hideBadge(): void {
    if (this.baseTitle !== null) {
      this.title.setTitle(this.baseTitle);
      this.baseTitle = null;
    }

    if ('clearAppBadge' in navigator) {
      void navigator.clearAppBadge().catch((): void => undefined);
    }
  }
}
