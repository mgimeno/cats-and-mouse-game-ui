import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';

import { languageOptions, type SupportedLanguage } from 'src/translations';

@Component({
  imports: [MatButtonModule],
  templateUrl: './select-language.component.html',
  styleUrls: ['./select-language.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectLanguageComponent {
  private readonly bottomSheetRef = inject(MatBottomSheetRef<SelectLanguageComponent>);

  readonly languageOptions = languageOptions;

  selectLanguage(languageCode: SupportedLanguage): void {
    this.bottomSheetRef.dismiss(languageCode);
  }
}
