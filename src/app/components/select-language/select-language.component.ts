import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';

@Component({
  imports: [MatButtonModule],
  templateUrl: './select-language.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectLanguageComponent {
  private readonly bottomSheetRef = inject(MatBottomSheetRef<SelectLanguageComponent>);

  selectLanguage(languageCode: string): void {
    this.bottomSheetRef.dismiss(languageCode);
  }
}
