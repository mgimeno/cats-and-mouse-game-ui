import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';


@Component({
  templateUrl: './how-to-play-dialog.component.html',
  styleUrls: ['./how-to-play-dialog.component.scss']
})
export class HowToPlayDialogComponent {

  constructor(public dialogRef: MatDialogRef<HowToPlayDialogComponent>) { }

  onClose(): void{
    this.dialogRef.close();
  }
}

