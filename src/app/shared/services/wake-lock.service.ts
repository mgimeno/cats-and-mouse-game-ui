import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

import { PageVisibilityService } from './page-visibility.service';

/**
 * Keeps the screen awake while a game is in progress, so a player waiting on a slow
 * opponent does not watch their phone dim and lock.
 *
 * The platform releases a screen wake lock automatically whenever the page is hidden
 * and never restores it, so re-acquiring on the way back to the foreground is required
 * rather than optional. Requests are serialized because the browser rejects them while
 * the page is hidden, which makes ordering against visibility changes significant.
 */
@Injectable({
  providedIn: 'root'
})
export class WakeLockService {
  private readonly pageVisibilityService = inject(PageVisibilityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly enabled = signal(false);

  private sentinel: WakeLockSentinel | null = null;
  private pendingOperations: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      this.sync(this.enabled() && this.pageVisibilityService.visible());
    });

    this.destroyRef.onDestroy(() => {
      this.sync(false);
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
  }

  private sync(shouldHold: boolean): void {
    if (!('wakeLock' in navigator)) {
      return;
    }

    // Chained rather than fired in parallel so an acquire and a release triggered in
    // quick succession cannot resolve out of order and strand a lock.
    this.pendingOperations = this.pendingOperations.then(() => this.applyDesiredState(shouldHold));
  }

  private async applyDesiredState(shouldHold: boolean): Promise<void> {
    if (shouldHold === (this.sentinel !== null)) {
      return;
    }

    if (shouldHold) {
      await this.requestSentinel();
      return;
    }

    await this.releaseSentinel();
  }

  private async requestSentinel(): Promise<void> {
    try {
      const sentinel = await navigator.wakeLock.request('screen');

      sentinel.addEventListener('release', () => {
        // Fires on the platform's own release when the page hides. Dropping the handle
        // is what lets the next foreground pass acquire a fresh one.
        if (this.sentinel === sentinel) {
          this.sentinel = null;
        }
      });

      this.sentinel = sentinel;
    } catch (error) {
      // Refused while hidden, on low battery, or by user agent policy. Nothing is
      // broken by this; the screen simply dims as it normally would.
      console.warn('Screen wake lock was refused', error);
    }
  }

  private async releaseSentinel(): Promise<void> {
    const sentinel = this.sentinel;
    if (sentinel === null) {
      return;
    }

    this.sentinel = null;

    try {
      await sentinel.release();
    } catch (error) {
      console.warn('Releasing the screen wake lock failed', error);
    }
  }
}
