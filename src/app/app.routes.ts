import { type Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then(component => component.HomeComponent)
  },
  {
    path: 'play',
    loadComponent: () =>
      import('./components/game/play-game/play-game.component').then(component => component.PlayGameComponent)
  },
  { path: '**', redirectTo: '' }
];
