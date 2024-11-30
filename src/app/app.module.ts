import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ClipboardModule } from 'ngx-clipboard';

import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HowToPlayDialogComponent } from './components/how-to-play-dialog/how-to-play-dialog.component';
import { PageNotFoundComponent } from './components/page-not-found/page-not-found.component';
import { PlayGameComponent } from './components/game/play-game/play-game.component';
import { CreateGameDialogComponent } from './components/game/create-game-dialog/create-game-dialog.component';
import { JoinGameDialogComponent } from './components/game/join-game-dialog/join-game-dialog.component';
import { HomeComponent } from './components/home/home.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { SignalrService } from './shared/services/signalr-service';
import { ChessBoxComponent } from './components/game/chess-box/chess-box.component';
import { ChatComponent } from './components/game/chat/chat.component';
import { LoadingDialogComponent } from './components/loading-dialog/loading-dialog.component';
import { LoaderComponent } from './shared/components/loader/loader.component';
import { TeamSelectComponent } from './shared/components/team-select/team-select.component';
import { ConfirmationDialogComponent } from './shared/components/confirmation-dialog/confirmation-dialog.component';
import { SelectLanguageComponent } from './components/select-language/select-language.component';


@NgModule({
  declarations: [
    AppComponent,
    LoadingDialogComponent,
    HowToPlayDialogComponent,
    ConfirmationDialogComponent,
    PageNotFoundComponent,
    CreateGameDialogComponent,
    JoinGameDialogComponent,
    PlayGameComponent,
    HomeComponent,
    ChessBoxComponent,
    ChatComponent,
    LoaderComponent,
    TeamSelectComponent,
    SelectLanguageComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatBottomSheetModule,
    MatDialogModule,
    MatTableModule,
    MatSnackBarModule,
    ClipboardModule,
  ],
  entryComponents: [
    CreateGameDialogComponent,
    JoinGameDialogComponent,
    LoadingDialogComponent,
    HowToPlayDialogComponent,
    ConfirmationDialogComponent,
    SelectLanguageComponent
  ],
  providers: [
    SignalrService,
    { provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: { hasBackdrop: true, disableClose: true } },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
