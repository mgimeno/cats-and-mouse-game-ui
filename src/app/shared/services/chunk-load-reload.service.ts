import { Injectable } from '@angular/core';
import { SessionStorageKeyEnum } from '../enums/session-storage-key.enum';

@Injectable({
  providedIn: 'root'
})
export class ChunkLoadReloadService {
  private readonly chunkErrorPatterns = [
    /Loading chunk [\w.-]+ failed/i,
    /ChunkLoadError/i,
    /Failed to fetch dynamically imported module/i,
    /error loading dynamically imported module/i,
    /Importing a module script failed/i
  ];

  private readonly reloadAttemptWindowMs = 10_000;
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
    console.error(`Stale chunk detected. Reloading: ${reloadUrl}`, error);
    window.location.assign(reloadUrl);
  }

  private canAttemptReload(): boolean {
    try {
      const now = Date.now();
      const lastAttemptAt = Number(sessionStorage.getItem(SessionStorageKeyEnum.CHUNK_LOAD_RELOAD_ATTEMPT_AT) ?? 0);

      if (Number.isFinite(lastAttemptAt) && now - lastAttemptAt < this.reloadAttemptWindowMs) {
        return false;
      }

      sessionStorage.setItem(SessionStorageKeyEnum.CHUNK_LOAD_RELOAD_ATTEMPT_AT, now.toString());
      return true;
    } catch {
      return true;
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
