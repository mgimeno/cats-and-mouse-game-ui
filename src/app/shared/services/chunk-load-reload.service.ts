import { Injectable } from '@angular/core';
import { SessionStorageKeyEnum } from '../enums/session-storage-key.enum';

/**
 * Recovers from a lazily loaded chunk that failed to load - by reloading, the only thing that works:
 * a browser caches a failed dynamic `import()` for the life of the document, and Angular marks a
 * `@defer` block whose dependencies failed as failed for good.
 *
 * What this service really owns is when to reload. Never without a network to reload from: that
 * swaps a working app, and the page the user was on, for the browser's offline page - so it waits
 * until the app's own server answers. And never in a loop (see `reloadAttemptWindowMs`).
 */
@Injectable({
  providedIn: 'root'
})
export class ChunkLoadReloadService {
  private readonly chunkErrorPatterns = [
    /Loading chunk [\w.-]+ failed/i,
    /ChunkLoadError/i,
    /Failed to fetch dynamically imported module/i,
    /error loading dynamically imported module/i,
    /Importing a module script failed/i,
    // A `@defer` block whose dependencies failed to load: production builds keep only the code.
    /NG0750/
  ];

  /**
   * A chunk that is really gone - a tab outliving a deploy that removed it - fails again right after
   * the reload. Reloading at most once per window ends that at a console error, not in a loop.
   */
  private readonly reloadAttemptWindowMs = 60_000;
  private readonly originProbeTimeoutMs = 8_000;
  private readonly originProbeRetryDelayMs = 5_000;
  private isReloadScheduled = false;

  isChunkLoadError(error: unknown): boolean {
    if (this.isSameOriginScriptError(error)) {
      return true;
    }

    const message = this.getErrorMessage(error);
    return this.chunkErrorPatterns.some(pattern => pattern.test(message));
  }

  reloadIfChunkLoadError(error: unknown, url: string = window.location.href): boolean {
    if (!this.isChunkLoadError(error)) {
      return false;
    }

    this.reload(url, error);
    return true;
  }

  private reload(url: string, error: unknown): void {
    if (this.isReloadScheduled) {
      return;
    }

    const reloadUrl = this.getSameOriginReloadUrl(url);

    if (!this.canAttemptReload()) {
      console.error(`Stale chunk detected. Reload skipped to avoid loop: ${reloadUrl}`, error);
      return;
    }

    this.isReloadScheduled = true;
    console.error(`Stale chunk detected. Reloading once the app server answers: ${reloadUrl}`, error);

    void this.waitForReachableOrigin().then(() => {
      this.markReloadAttempt();
      window.location.assign(reloadUrl);
    });
  }

  private async waitForReachableOrigin(): Promise<void> {
    for (;;) {
      if (!navigator.onLine) {
        await new Promise<void>(resolve => window.addEventListener('online', () => resolve(), { once: true }));
      }

      if (await this.isOriginReachable()) {
        return;
      }

      await new Promise<void>(resolve => window.setTimeout(resolve, this.originProbeRetryDelayMs));
    }
  }

  /** Probes the app's own base URL, so a deployment under a sub-path probes itself, not the host. */
  private async isOriginReachable(): Promise<boolean> {
    try {
      const response = await fetch(document.baseURI, {
        method: 'HEAD',
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(this.originProbeTimeoutMs)
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private canAttemptReload(): boolean {
    try {
      const lastAttemptAt = Number(sessionStorage.getItem(SessionStorageKeyEnum.CHUNK_LOAD_RELOAD_ATTEMPT_AT) ?? 0);

      if (!Number.isFinite(lastAttemptAt)) {
        return true;
      }

      const elapsedMs = Date.now() - lastAttemptAt;

      // elapsedMs < 0 means the stored timestamp is in the future (clock skew /
      // tampering): treat as stale and allow the reload instead of blocking it.
      return elapsedMs < 0 || elapsedMs >= this.reloadAttemptWindowMs;
    } catch {
      return true;
    }
  }

  private markReloadAttempt(): void {
    try {
      sessionStorage.setItem(SessionStorageKeyEnum.CHUNK_LOAD_RELOAD_ATTEMPT_AT, Date.now().toString());
    } catch {
      // sessionStorage unavailable (private mode / quota): the reload still
      // proceeds, we just lose loop protection for this attempt.
    }
  }

  private getSameOriginReloadUrl(url: string | undefined): string {
    try {
      const parsedUrl = new URL(url || window.location.href, window.location.origin);
      if (parsedUrl.origin !== window.location.origin) {
        return window.location.href;
      }

      const basePathname = this.getBasePathname();
      const pathname =
        url?.startsWith('/') && basePathname !== '/' && !parsedUrl.pathname.startsWith(basePathname)
          ? `${basePathname.replace(/\/$/, '')}${parsedUrl.pathname}`
          : parsedUrl.pathname;

      return `${pathname}${parsedUrl.search}${parsedUrl.hash}`;
    } catch {
      return window.location.href;
    }
  }

  private getBasePathname(): string {
    try {
      const pathname = new URL(document.baseURI, window.location.origin).pathname || '/';
      return pathname.endsWith('/') ? pathname : `${pathname}/`;
    } catch {
      return '/';
    }
  }

  private getErrorMessage(error: unknown): string {
    if (!error) {
      return '';
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    if (typeof error === 'object') {
      const values: string[] = [];
      const maybeError = error as {
        error?: unknown;
        message?: unknown;
        name?: unknown;
        reason?: unknown;
      };

      if (typeof maybeError.name === 'string') {
        values.push(maybeError.name);
      }

      if (typeof maybeError.message === 'string') {
        values.push(maybeError.message);
      }

      if (maybeError.error) {
        values.push(this.getErrorMessage(maybeError.error));
      }

      if (maybeError.reason) {
        values.push(this.getErrorMessage(maybeError.reason));
      }

      return values.join(' ');
    }

    if (
      typeof error === 'number' ||
      typeof error === 'boolean' ||
      typeof error === 'bigint' ||
      typeof error === 'symbol'
    ) {
      return String(error);
    }

    return '';
  }

  private isSameOriginScriptError(error: unknown): boolean {
    if (typeof HTMLScriptElement === 'undefined' || !error || typeof error !== 'object' || !('target' in error)) {
      return false;
    }

    const target = (error as { target?: unknown }).target;
    if (!(target instanceof HTMLScriptElement) || !target.src) {
      return false;
    }

    try {
      const scriptUrl = new URL(target.src, window.location.origin);
      return scriptUrl.origin === window.location.origin && scriptUrl.pathname.endsWith('.js');
    } catch {
      return false;
    }
  }
}
