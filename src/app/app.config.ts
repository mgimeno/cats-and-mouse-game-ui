import { provideHttpClient } from '@angular/common/http';
import {
  type ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection
} from '@angular/core';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { provideRouter, withPreloading } from '@angular/router';

import { routes } from './app.routes';
import { AppInitService } from './shared/services/app-init.service';
import { AppRoutePreloadingStrategy } from './shared/services/app-route-preloading.strategy';
import { ChunkLoadReloadService } from './shared/services/chunk-load-reload.service';

const createErrorHandler = (): ErrorHandler => {
  const delegate = new ErrorHandler();
  const chunkLoadReloadService = inject(ChunkLoadReloadService);

  return {
    handleError(error: unknown): void {
      chunkLoadReloadService.reloadIfChunkLoadError(error);
      delegate.handleError(error);
    }
  };
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    {
      provide: ErrorHandler,
      useFactory: createErrorHandler
    },
    provideRouter(routes, withPreloading(AppRoutePreloadingStrategy)),
    provideZonelessChangeDetection(),
    provideAppInitializer(async () => {
      const appInitService = inject(AppInitService);

      await appInitService.init();
    }),
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        autoFocus: false,
        hasBackdrop: true,
        disableClose: true,
        height: '100dvh',
        width: '100dvw',
        maxHeight: '100dvh',
        maxWidth: '100dvw',
        panelClass: 'fullscreen-dialog'
      }
    }
  ]
};
