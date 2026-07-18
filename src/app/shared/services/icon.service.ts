import { inject, Injectable } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';

@Injectable({
  providedIn: 'root'
})
export class IconService {
  private readonly matIconRegistry = inject(MatIconRegistry);

  registerIcons(): void {
    // The "Material Symbols Outlined" font is self-hosted: the @font-face ships in the bundled
    // stylesheet (src/styles/_material-symbols.scss) and the woff2 is preloaded from index.html,
    // both generated from MATERIAL_SYMBOLS_ICON_NAMES via `npm run generate:material-symbols-font`.
    this.matIconRegistry.setDefaultFontSetClass('material-symbols-outlined');
  }
}
