import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink, MatButtonModule],
  templateUrl: './page-not-found.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageNotFoundComponent {}
