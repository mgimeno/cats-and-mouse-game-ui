import { Component, OnInit, OnDestroy } from '@angular/core';
import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { IGameListItem } from 'src/app/shared/interfaces/game-list-item.interface';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { CreateGameDialogComponent } from '../game/create-game-dialog/create-game-dialog.component';
import { JoinGameDialogComponent } from '../game/join-game-dialog/join-game-dialog.component';
import { ActivatedRoute, Router } from '@angular/router';
import { SignalrService } from '../../shared/services/signalr-service';
import { IGameListMessage } from '../../shared/interfaces/game-list-message.interface';
import { NotificationService } from '../../shared/services/notification.service';
import { HowToPlayDialogComponent } from '../how-to-play-dialog/how-to-play-dialog.component';
import { IGameStartMessage } from 'src/app/shared/interfaces/game-start-message.interface';
import { COMMON_CONSTANTS } from 'src/app/shared/constants/common';
import { IChessBox } from 'src/app/shared/interfaces/chess-box.interface';
import { CommonHelper } from 'src/app/shared/helpers/common-helper';
import { FigureTypeEnum } from 'src/app/shared/enums/figure-type.enum';
import { IFigure } from 'src/app/shared/interfaces/figure.interface';
import { SelectLanguageComponent } from '../select-language/select-language.component';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { environment } from 'src/environments/environment';
import { LoadingDialogComponent } from '../loading-dialog/loading-dialog.component';
import { IGameStatusMessage } from 'src/app/shared/interfaces/game-status-message.interface';


@Component({
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {

  //tableColumns: string[] = ["userName", "isPasswordProtected", "gameId"];
  tableColumns: string[] = ["userName", "gameId"];
  teamEnum = TeamEnum;

  games: IGameListItem[] = [];

  createGameDialogRef: MatDialogRef<CreateGameDialogComponent>;
  joinGameDialogRef: MatDialogRef<JoinGameDialogComponent>;
  howToPlayDialogRef: MatDialogRef<HowToPlayDialogComponent>;

  currentLanguageCode: string = localStorage.getItem(`${environment.localStoragePrefix}language`);

  private chessBoard: [IChessBox[], IChessBox[], IChessBox[], IChessBox[], IChessBox[], IChessBox[], IChessBox[], IChessBox[]] = null;

  constructor(
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private signalrService: SignalrService,
    private notificationService: NotificationService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private bottomSheet: MatBottomSheet) {

    this.setupLogoChessBoard();

  }

  ngOnInit() : void {

    this.signalrService.sendMessage("SendWhetherHasInProgressGameToCaller")
      .catch((reason: any) => {
        console.error(reason);
        this.notificationService.showCommonError();
      });

    this.signalrService.sendMessage("SendGamesAwaitingForSecondPlayerToCallerAsync")
      .catch((reason: any) => {
        console.error(reason);
        this.notificationService.showCommonError();
      });

    this.signalrService.subscribeToMethod("GameList", (message: IGameListMessage) => {

      const userId = localStorage.getItem(`${environment.localStoragePrefix}user-id`);

      this.games = message.gameList.filter(g => g.userId !== userId);

      const gameThisUserHasCreatedInAnotherDeviceOrTab = message.gameList.find(g=> g.userId === userId);

      if(gameThisUserHasCreatedInAnotherDeviceOrTab && !this.createGameDialogRef){
        this.openCreateGameDialog(gameThisUserHasCreatedInAnotherDeviceOrTab);
      }
      else{
        this.openJoinGameDialogIfGameInUrl();
      }
      
    });

    this.signalrService.subscribeToMethod("GameStart", (message: IGameStartMessage) => {
      this.goToPlay();
    });

    this.signalrService.subscribeToMethod("GameStatus", (message: IGameStatusMessage) => {
      this.goToPlay();
    });
  }

  private goToPlay(): void{
    if (this.createGameDialogRef) {
      this.createGameDialogRef.close();
    }

    if (this.joinGameDialogRef) {
      this.joinGameDialogRef.close();
    }

    if (this.howToPlayDialogRef) {
      this.howToPlayDialogRef.close();
    }

    this.router.navigate(['/play']);
    
  }

  openSelectLanguage(): void {
    const bottomSheetRef = this.bottomSheet.open(SelectLanguageComponent);

    bottomSheetRef.afterDismissed().subscribe((newLanguageCode: string) => {

      if (newLanguageCode) {

        if (newLanguageCode !== this.currentLanguageCode) {
          localStorage.setItem(`${environment.localStoragePrefix}language`, newLanguageCode);
          this.dialog.open(LoadingDialogComponent, { data: { dialogTitle: $localize`:@@loading_dialog.loading:Loading...` }, height: "100%", width: "100%" });
          window.location.reload();
        }

      }

    });
  }

  private setupLogoChessBoard(): void {
    this.chessBoard = CommonHelper.buildChessBoard(COMMON_CONSTANTS.LOGO_CHESS_BOARD_ROWS, COMMON_CONSTANTS.LOGO_CHESS_BOARD_COLUMNS);

    this.chessBoard[0][5].figure = <IFigure>{ typeId: FigureTypeEnum.Cat };
    this.chessBoard[0][7].figure = <IFigure>{ typeId: FigureTypeEnum.Cat };
    this.chessBoard[2][5].figure = <IFigure>{ typeId: FigureTypeEnum.Cat };
    this.chessBoard[2][7].figure = <IFigure>{ typeId: FigureTypeEnum.Cat };

    this.chessBoard[1][6].figure = <IFigure>{ typeId: FigureTypeEnum.Mouse };

    const logoTitle = $localize`:@@home.title:CATS & MOUSE`;

    this.chessBoard[0][0].text = logoTitle[0];
    this.chessBoard[0][1].text = logoTitle[1];
    this.chessBoard[0][2].text = logoTitle[2];
    this.chessBoard[0][3].text = logoTitle[3];

    this.chessBoard[1][2].text = logoTitle[5];

    this.chessBoard[2][0].text = logoTitle[7];
    this.chessBoard[2][1].text = logoTitle[8];
    this.chessBoard[2][2].text = logoTitle[9];
    this.chessBoard[2][3].text = logoTitle[10];
    this.chessBoard[2][4].text = logoTitle[11];
  }


  openJoinGameDialogIfGameInUrl = (): void => {

    const gameIdFromUrl: string = (this.route.snapshot.queryParams["joinGame"] || null);
    if (gameIdFromUrl) {
      //This removes the 'joinGame' url param to avoid issues.
      this.router.navigate(
        [],
        {
          relativeTo: this.activatedRoute
        });
      this.openJoinGameDialog(gameIdFromUrl);
    }
  }


  openCreateGameDialog(gameToLoad?: IGameListItem): void {
    this.createGameDialogRef = this.dialog.open(CreateGameDialogComponent, { data: gameToLoad, height: "100%", width: "100%" });
  }

  openJoinGameDialog(gameId: string): void {
    const game = this.games.find(g => g.gameId == gameId);

    if (!game) {
      this.notificationService.showError("Game does not exist");
    }
    else {
      this.joinGameDialogRef = this.dialog.open(JoinGameDialogComponent, { data: game, height: "100%", width: "100%" });
    }

  }

  openHowToPlayDialog(): void {
    this.howToPlayDialogRef = this.dialog.open(HowToPlayDialogComponent, { height: "100%", width: "100%" });
  }

  ngOnDestroy(): void {

    this.signalrService.unsubscribeToMethod("GameList");
    this.signalrService.unsubscribeToMethod("GameStart");
    this.signalrService.unsubscribeToMethod("GameStatus");
    
  }
}
