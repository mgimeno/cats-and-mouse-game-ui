import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';

interface ConfirmationDialogData {
  dialogTitle?: string;
  dialogBody?: string;
}

@Component({
  imports: [MatButtonModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmationDialogComponent {
  private readonly bottomSheetRef = inject(MatBottomSheetRef<ConfirmationDialogComponent>);
  readonly data = inject<ConfirmationDialogData>(MAT_BOTTOM_SHEET_DATA);

  onConfirmation(): void {
    this.bottomSheetRef.dismiss(true);
  }

  onCancel(): void {
    this.bottomSheetRef.dismiss(false);
  }
}
