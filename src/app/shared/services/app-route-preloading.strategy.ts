import { Injectable } from '@angular/core';
import { type PreloadingStrategy, type Route } from '@angular/router';
import { catchError, EMPTY, Observable, type Subscriber, type Subscription } from 'rxjs';

interface AppRoutePreloadData {
  preload?: boolean;
  preloadPriority?: number;
}

interface AppRoutePreloadTask {
  cancelled: boolean;
  done: boolean;
  load: () => Observable<unknown>;
  order: number;
  priority: number;
  resolve?: () => void;
  subscriber: Subscriber<void>;
  subscription?: Subscription;
}

@Injectable({
  providedIn: 'root'
})
export class AppRoutePreloadingStrategy implements PreloadingStrategy {
  private readonly queue: AppRoutePreloadTask[] = [];
  private activeTask?: AppRoutePreloadTask;
  private drainScheduled = false;
  private nextOrder = 0;

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const data = route.data as AppRoutePreloadData | undefined;

    if (!data?.preload) {
      return EMPTY;
    }

    if (!this.canPreloadForNetwork()) {
      return EMPTY;
    }

    return new Observable<void>(subscriber => {
      const task: AppRoutePreloadTask = {
        cancelled: false,
        done: false,
        load,
        order: this.nextOrder++,
        priority: data.preloadPriority ?? 0,
        subscriber
      };

      this.queue.push(task);
      this.sortQueue();
      this.scheduleDrain();

      return () => this.cancelTask(task);
    });
  }

  private canPreloadForNetwork(): boolean {
    if (typeof navigator === 'undefined') {
      return true;
    }

    const connection = (
      navigator as Navigator & {
        connection?: { effectiveType?: string; saveData?: boolean };
      }
    ).connection;

    if (connection?.saveData) {
      return false;
    }

    return !['slow-2g', '2g'].includes(connection?.effectiveType ?? '');
  }

  private cancelTask(task: AppRoutePreloadTask): void {
    if (task.done) {
      return;
    }

    task.cancelled = true;
    task.subscription?.unsubscribe();
    task.resolve?.();

    if (this.activeTask === task) {
      this.finishTask(task);
    }
  }

  private dequeue(): AppRoutePreloadTask | undefined {
    while (this.queue.length) {
      const task = this.queue.shift();

      if (task && !task.cancelled) {
        return task;
      }
    }

    return undefined;
  }

  private async drainQueue(): Promise<void> {
    if (this.activeTask) {
      return;
    }

    const task = this.dequeue();

    if (!task) {
      return;
    }

    this.activeTask = task;

    try {
      await this.waitForIdle();

      if (!task.cancelled && this.canPreloadForNetwork()) {
        await this.loadTask(task);
      }
    } finally {
      this.finishTask(task);
    }
  }

  private finishTask(task: AppRoutePreloadTask): void {
    if (task.done) {
      return;
    }

    task.done = true;
    task.subscription?.unsubscribe();
    task.subscriber.complete();

    if (this.activeTask === task) {
      this.activeTask = undefined;
    }

    if (this.queue.length) {
      this.scheduleDrain();
    }
  }

  private loadTask(task: AppRoutePreloadTask): Promise<void> {
    return new Promise(resolve => {
      task.resolve = resolve;

      try {
        task.subscription = task
          .load()
          .pipe(catchError(() => EMPTY))
          .subscribe({
            complete: resolve,
            error: resolve
          });
      } catch {
        resolve();
      }
    });
  }

  private scheduleDrain(): void {
    if (this.drainScheduled) {
      return;
    }

    this.drainScheduled = true;

    void Promise.resolve().then(() => {
      this.drainScheduled = false;
      void this.drainQueue();
    });
  }

  private sortQueue(): void {
    this.queue.sort((current, next) => next.priority - current.priority || current.order - next.order);
  }

  private waitForIdle(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const win = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      };

      if (win.requestIdleCallback) {
        win.requestIdleCallback(() => resolve(), { timeout: 5000 });
        return;
      }

      win.setTimeout(() => resolve(), 2000);
    });
  }
}
