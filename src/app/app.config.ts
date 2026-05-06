import { type ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideHttpClient(),
    provideRouter(routes),
    provideZonelessChangeDetection(),
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        hasBackdrop: true,
        disableClose: true,
        height: '100vh',
        width: '100vw',
        maxHeight: '100vh',
        maxWidth: '100vw',
        panelClass: 'fullscreen-dialog'
      }
    }
  ]
};
