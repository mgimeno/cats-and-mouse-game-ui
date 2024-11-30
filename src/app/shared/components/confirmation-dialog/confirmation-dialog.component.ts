import {Component, Inject} from '@angular/core';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';

@Component({
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.scss']
})
export class ConfirmationDialogComponent {

  constructor(private bottomSheetRef: MatBottomSheetRef<ConfirmationDialogComponent>,
              @Inject(MAT_BOTTOM_SHEET_DATA) public data: any) {
  }

  onConfirmation(): void {
    this.bottomSheetRef.dismiss(true);
  }

  onCancel(): void {
    this.bottomSheetRef.dismiss(false);
  }
}
