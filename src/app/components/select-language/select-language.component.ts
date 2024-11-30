import { Component } from '@angular/core';
import { MatBottomSheetRef} from '@angular/material/bottom-sheet';

@Component({
  templateUrl: './select-language.component.html',
  styleUrls: ['./select-language.component.scss']
})
export class SelectLanguageComponent {

  constructor(private bottomSheetRef: MatBottomSheetRef<SelectLanguageComponent>) {
  }

  selectLanguage(languageCode: string): void{
    this.bottomSheetRef.dismiss(languageCode);
  }

}
