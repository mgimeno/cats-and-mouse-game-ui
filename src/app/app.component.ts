import { Component } from '@angular/core';
import { SignalrService } from './shared/services/signalr-service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { LoadingDialogComponent } from './components/loading-dialog/loading-dialog.component';
import { environment } from 'src/environments/environment';
import { CommonHelper } from './shared/helpers/common-helper';
import { Router } from '@angular/router';
import { IPlayerHasInProgressGameMessage } from './shared/interfaces/player-has-in-progress-game-message';
import { Meta, Title, MetaDefinition } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  isReconnectingDialogOpen: boolean = false;
  reconnectingDialogRef: MatDialogRef<LoadingDialogComponent> = null;

  constructor(
    private signalrService: SignalrService,
    private dialog: MatDialog,
    private router: Router,
    private meta: Meta,
    private title: Title) {

    this.addTitleAndMetaTags();

    this.createBrowserUserId();

    this.openReconnectingDialog();
    this.signalrService.startConnection();

    setInterval(() => {

      if (!this.isReconnectingDialogOpen && !this.signalrService.isConnected) {
        this.openReconnectingDialog();
      }
      else if (this.isReconnectingDialogOpen && this.signalrService.isConnected && this.reconnectingDialogRef) {
        this.reconnectingDialogRef.close();
        this.isReconnectingDialogOpen = false;
      }
    }, 200);

    this.signalrService.subscribeToMethod("HasInProgressGame", (message: IPlayerHasInProgressGameMessage) => {

      if (message.hasInProgressGame) {
        this.router.navigate(['/play']);
      }
      else {
        this.router.navigate(['/']);
      }

    });

  }

  private openReconnectingDialog(): void {
    this.isReconnectingDialogOpen = true;
    this.reconnectingDialogRef = this.dialog.open(LoadingDialogComponent, { data: {dialogTitle: $localize`:@@loading_dialog.connecting:Connecting to server`}, height: "100%", width: "100%" });
  }

  private createBrowserUserId(): void {
    const userId = localStorage.getItem(`${environment.localStoragePrefix}user-id`);
    if (!userId) {
      localStorage.setItem(`${environment.localStoragePrefix}user-id`, CommonHelper.getNewGuid());
    }
  }

  private addTitleAndMetaTags(): void {

    this.title.setTitle($localize`:@@index.title:Cats & Mouse. Multiplayer Game`);
    this.meta.updateTag(<MetaDefinition>{ name: "description", content: $localize`:@@index.meta_description:Play for free Cats and Mouse game on a chessboard. Play online with friends.` });
    this.meta.updateTag(<MetaDefinition>{ property: "og:title", content: $localize`:@@index.title:Cats & Mouse. Multiplayer Game` });
    this.meta.updateTag(<MetaDefinition>{ property: "og:description", content: $localize`:@@index.meta_og_description:Play for free Cats and Mouse with friends` });

    const languageCode = localStorage.getItem(`${environment.localStoragePrefix}language`);
    this.meta.updateTag(<MetaDefinition>{ property: "og:locale", content: (languageCode === "en" ? "en_GB" : "es_ES") });
    this.meta.updateTag(<MetaDefinition>{ property: "og:locale:alternate", content: (languageCode === "en" ? "es_ES" : "en_GB") });

  }
}
