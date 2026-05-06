import { Injectable, inject } from '@angular/core';
import { MatSnackBar, type MatSnackBarConfig } from '@angular/material/snack-bar';

import { COMMON_CONSTANTS } from '../constants/common';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  showSuccess(text: string): void {
    this.open(text, 'success', COMMON_CONSTANTS.NOTIFICATION_DURATION_MILLISECONS);
  }

  showCommonError(): void {
    this.showError();
  }

  showError(text?: string): void {
    this.open(
      text ?? $localize`:@@error.error_ocurred:An error has ocurred`,
      'error',
      COMMON_CONSTANTS.NOTIFICATION_ERROR_DURATION_MILLISECONS
    );
  }

  showWarning(text: string): void {
    this.open(text, 'warning', COMMON_CONSTANTS.NOTIFICATION_DURATION_MILLISECONS);
  }

  showInfo(text: string): void {
    this.open(text, 'info', COMMON_CONSTANTS.NOTIFICATION_INFO_DURATION_MILLISECONS);
  }

  private open(text: string, panelClass: string, duration: number): void {
    const config: MatSnackBarConfig = {
      duration,
      panelClass
    };

    this.snackBar.open(text, undefined, config);
  }
}
