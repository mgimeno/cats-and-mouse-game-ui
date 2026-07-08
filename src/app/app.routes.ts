import { type Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then(component => component.HomeComponent),
    data: { preload: true, preloadPriority: 20 }
  },
  {
    path: 'play',
    loadComponent: () =>
      import('./components/game/play-game/play-game.component').then(component => component.PlayGameComponent),
    data: { preload: true, preloadPriority: 10 }
  },
  { path: '**', redirectTo: '' }
];
