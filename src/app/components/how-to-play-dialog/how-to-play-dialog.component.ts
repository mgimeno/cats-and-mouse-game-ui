import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './how-to-play-dialog.component.html',
  styleUrls: ['./how-to-play-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HowToPlayDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<HowToPlayDialogComponent>);

  onClose(): void {
    this.dialogRef.close();
  }
}
