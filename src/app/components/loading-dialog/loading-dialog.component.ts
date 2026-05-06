import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

import { LoaderComponent } from 'src/app/shared/components/loader/loader.component';

@Component({
  imports: [MatDialogModule, LoaderComponent],
  templateUrl: './loading-dialog.component.html',
  styleUrls: ['./loading-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingDialogComponent {
  readonly data = inject<{ dialogTitle: string }>(MAT_DIALOG_DATA);
}
