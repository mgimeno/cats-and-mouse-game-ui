import { inject, Injectable } from '@angular/core';
import { IconService } from './icon.service';

@Injectable({
  providedIn: 'root'
})
export class AppInitService {
  private readonly iconService = inject(IconService);

  init = async (): Promise<void> => {
    return new Promise<void>(resolve => {
      this.iconService.registerIcons();

      resolve();
    });
  };
}
