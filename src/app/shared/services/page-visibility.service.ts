import { DOCUMENT, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

/** Describes how the page returned to the foreground. */
export interface IForegroundContext {
  /** How long the page spent in the background. */
  readonly hiddenDurationMs: number;
  /**
   * True when the page was restored from the back/forward cache. The browser closes
   * open WebSockets when a page enters that cache, so a restore always needs a full
   * reconnect rather than the cheaper liveness check a plain tab switch needs.
   */
  readonly wasRestoredFromBackForwardCache: boolean;
}

type ForegroundCallback = (context: IForegroundContext) => void;

/**
 * Tracks whether the user is actually looking at the page.
 *
 * This is deliberately free of any app knowledge: it reports browser state and lets
 * consumers decide what that means for them. `visibilitychange` is the only lifecycle
 * event guaranteed to fire on mobile, where the OS freezes or discards a backgrounded
 * page without running `beforeunload`/`unload` (both of which also disable the
 * back/forward cache and are therefore never used here).
 */
@Injectable({
  providedIn: 'root'
})
export class PageVisibilityService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly foregroundCallbacks = new Set<ForegroundCallback>();
  private readonly visibleSignal = signal(this.isDocumentVisible());
  private readonly focusedSignal = signal(this.document.hasFocus());

  // Monotonic, so a system clock change cannot produce a negative or absurd duration.
  private hiddenSince: number | null = this.isDocumentVisible() ? null : performance.now();

  /**
   * Whether the page is rendered. This is the signal that matters for anything the
   * browser itself ties to visibility: timer throttling, page freezing, socket
   * teardown and screen wake locks all key off this and ignore focus entirely.
   */
  readonly visible = this.visibleSignal.asReadonly();

  /** Whether the page holds input focus. A visible page is often not the focused one. */
  readonly focused = this.focusedSignal.asReadonly();

  /**
   * Whether the player is plausibly looking at the page. Stricter than `visible`: a
   * game sitting on a second monitor behind someone's editor is still visible, but
   * nobody is watching it, so it should keep behaving as though they are away.
   */
  readonly hasUserAttention = computed(() => this.visible() && this.focused());

  constructor() {
    const window = this.document.defaultView;

    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    window?.addEventListener('pageshow', this.onPageShow);
    window?.addEventListener('pagehide', this.onPageHide);
    window?.addEventListener('focus', this.onFocus);
    window?.addEventListener('blur', this.onBlur);

    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
      window?.removeEventListener('pageshow', this.onPageShow);
      window?.removeEventListener('pagehide', this.onPageHide);
      window?.removeEventListener('focus', this.onFocus);
      window?.removeEventListener('blur', this.onBlur);
      this.foregroundCallbacks.clear();
    });
  }

  get isVisible(): boolean {
    return this.visible();
  }

  /**
   * Runs `callback` every time the page returns to the foreground. Callbacks may be
   * invoked twice for a single restore if a browser fires `pageshow` and
   * `visibilitychange` out of the documented order, so they must be idempotent.
   */
  onForeground(callback: ForegroundCallback): () => void {
    this.foregroundCallbacks.add(callback);

    return () => this.foregroundCallbacks.delete(callback);
  }

  private readonly onVisibilityChange = (): void => {
    // Read the live state instead of trusting the event: browsers also fire this for
    // window occlusion and screen lock, not just tab switches.
    if (this.isDocumentVisible()) {
      this.enterForeground(false);
      return;
    }

    this.enterBackground();
  };

  private readonly onPageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) {
      this.enterForeground(true);
    }
  };

  // Focus deliberately does not feed onForeground: losing focus does not throttle
  // timers or close sockets, so recovering the connection on it would cost a server
  // round trip every time the player clicked another window.
  private readonly onFocus = (): void => {
    this.focusedSignal.set(true);
  };

  private readonly onBlur = (): void => {
    this.focusedSignal.set(false);
  };

  private readonly onPageHide = (): void => {
    // Usually redundant with `visibilitychange`, but it is the event that reliably
    // marks entry into the back/forward cache across browsers.
    this.enterBackground();
  };

  private enterBackground(): void {
    if (this.hiddenSince !== null) {
      return;
    }

    this.hiddenSince = performance.now();
    this.visibleSignal.set(false);
  }

  private enterForeground(wasRestoredFromBackForwardCache: boolean): void {
    const hiddenSince = this.hiddenSince;

    // A back/forward cache restore always notifies, because the socket is dead even if
    // the page never observed itself going hidden.
    if (hiddenSince === null && !wasRestoredFromBackForwardCache) {
      return;
    }

    this.hiddenSince = null;
    this.visibleSignal.set(true);

    const context: IForegroundContext = {
      hiddenDurationMs: hiddenSince === null ? 0 : performance.now() - hiddenSince,
      wasRestoredFromBackForwardCache
    };

    this.foregroundCallbacks.forEach(callback => {
      try {
        callback(context);
      } catch (error) {
        console.error('Page foreground handler failed', error);
      }
    });
  }

  private isDocumentVisible(): boolean {
    return this.document.visibilityState === 'visible';
  }
}
