import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { type ThemePalette } from '@angular/material/core';

import { languageOptions, type SupportedLanguage } from 'src/translations';

export interface SelectLanguageData {
  readonly currentLanguageCode: string;
}

@Component({
  imports: [MatButtonModule],
  templateUrl: './select-language.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectLanguageComponent {
  private readonly bottomSheetRef = inject(MatBottomSheetRef<SelectLanguageComponent>);
  private readonly data = inject<SelectLanguageData | null>(MAT_BOTTOM_SHEET_DATA, { optional: true });

  readonly languageOptions = languageOptions;
  readonly currentLanguageCode = this.data?.currentLanguageCode ?? 'en';

  getLanguageButtonColor(languageCode: SupportedLanguage): ThemePalette {
    return languageCode === this.currentLanguageCode ? 'primary' : undefined;
  }

  selectLanguage(languageCode: SupportedLanguage): void {
    this.bottomSheetRef.dismiss(languageCode);
  }
}
