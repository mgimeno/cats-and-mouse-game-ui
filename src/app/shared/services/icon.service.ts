import { inject, Injectable } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { appLoadStyles } from '../utils/load-to-dom.load-styles.util';

@Injectable({
  providedIn: 'root'
})
export class IconService {
  private readonly matIconRegistry = inject(MatIconRegistry);

  registerIcons(): void {
    this.registerMaterialIcons();
    this.matIconRegistry.setDefaultFontSetClass('material-symbols-outlined');
  }

  private registerMaterialIcons = (): void => {
    const url = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@300&display=swap&icon_names=';

    // Check icon is not already part of the array, otherwise no icons will load.
    // No need to add icons sorted alphabetically -> we actively sort them.
    const icons = ['flag', 'help', 'logout', 'refresh', 'send', 'share'];

    const style = {
      href: `${url}${icons.sort().join(',')}`
    };

    appLoadStyles([style]);
  };
}
