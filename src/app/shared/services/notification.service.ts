import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { COMMON_CONSTANTS } from '../constants/common';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(private snackBar: MatSnackBar) { }

  showSuccess(text: string): void{

    let config: MatSnackBarConfig = <MatSnackBarConfig>{
      duration: COMMON_CONSTANTS.NOTIFICATION_DURATION_MILLISECONS,
      panelClass: "success"
    };

    this.snackBar.open(text, null,config);
  }

  showCommonError(): void{
    this.showError();
  }

  showError(text?:string): void{
    let config: MatSnackBarConfig = <MatSnackBarConfig>{
      duration: COMMON_CONSTANTS.NOTIFICATION_ERROR_DURATION_MILLISECONS,
      panelClass: "error"
    };

    let errorMessage = (text || $localize`:@@error.error_ocurred:An error has ocurred`);

    this.snackBar.open(errorMessage, null ,config);
  }

  showWarning(text:string): void{
    let config: MatSnackBarConfig = <MatSnackBarConfig>{
      duration: COMMON_CONSTANTS.NOTIFICATION_DURATION_MILLISECONS,
      panelClass: "warning"
    };

    this.snackBar.open(text, null,config);
  }

  showInfo(text:string): void{
    let config: MatSnackBarConfig = <MatSnackBarConfig>{
      duration: COMMON_CONSTANTS.NOTIFICATION_DURATION_MILLISECONS,
      panelClass: "info"
    };

    this.snackBar.open(text, null,config);
  }
}