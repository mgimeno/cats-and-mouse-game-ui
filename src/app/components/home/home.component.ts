import { ChangeDetectionStrategy, Component, type OnDestroy, type OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';

import { ChessBoxComponent } from '../game/chess-box/chess-box.component';
import { COMMON_CONSTANTS } from 'src/app/shared/constants/common';
import { CommonHelper } from 'src/app/shared/utils/common-util';
import { CreateGameDialogComponent } from '../game/create-game-dialog/create-game-dialog.component';
import { FigureTypeEnum } from 'src/app/shared/enums/figure-type.enum';
import { HowToPlayDialogComponent } from '../how-to-play-dialog/how-to-play-dialog.component';
import { type IChessBox } from 'src/app/shared/interfaces/chess-box.interface';
import { type IFigure } from 'src/app/shared/interfaces/figure.interface';
import { type IGameListItem } from 'src/app/shared/interfaces/game-list-item.interface';
import { type IGameListMessage } from '../../shared/interfaces/game-list-message.interface';
import { type IGameStartMessage } from 'src/app/shared/interfaces/game-start-message.interface';
import { type IGameStatusMessage } from 'src/app/shared/interfaces/game-status-message.interface';
import { JoinGameDialogComponent } from '../game/join-game-dialog/join-game-dialog.component';
import { LoadingDialogComponent } from '../loading-dialog/loading-dialog.component';
import { NotificationService } from '../../shared/services/notification.service';
import { SelectLanguageComponent } from '../select-language/select-language.component';
import { SignalrService } from '../../shared/services/signalr-service';
import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { environment } from 'src/environments/environment';

@Component({
  imports: [MatButtonModule, MatTableModule, ChessBoxComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly signalrService = inject(SignalrService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly unsubscribeCallbacks: (() => void)[] = [];

  readonly tableColumns = ['userName', 'gameId'];
  readonly teamEnum = TeamEnum;
  readonly games = signal<IGameListItem[]>([]);
  readonly currentLanguageCode = signal(localStorage.getItem(`${environment.localStoragePrefix}language`) ?? 'en');
  readonly chessBoard = this.setupLogoChessBoard();

  private createGameDialogRef: MatDialogRef<CreateGameDialogComponent> | null = null;
  private joinGameDialogRef: MatDialogRef<JoinGameDialogComponent> | null = null;
  private howToPlayDialogRef: MatDialogRef<HowToPlayDialogComponent> | null = null;

  ngOnInit(): void {
    this.signalrService.sendMessage('SendWhetherHasInProgressGameToCaller').catch(reason => {
      console.error(reason);
      this.notificationService.showCommonError();
    });

    this.signalrService.sendMessage('SendGamesAwaitingForSecondPlayerToCallerAsync').catch(reason => {
      console.error(reason);
      this.notificationService.showCommonError();
    });

    this.unsubscribeCallbacks.push(
      this.signalrService.subscribeToMethod<IGameListMessage>('GameList', message => {
        const userId = localStorage.getItem(`${environment.localStoragePrefix}user-id`);

        this.games.set(message.gameList.filter(game => game.userId !== userId));

        const gameThisUserHasCreatedInAnotherDeviceOrTab = message.gameList.find(game => game.userId === userId);

        if (gameThisUserHasCreatedInAnotherDeviceOrTab && !this.createGameDialogRef) {
          this.openCreateGameDialog(gameThisUserHasCreatedInAnotherDeviceOrTab);
        } else {
          this.openJoinGameDialogIfGameInUrl();
        }
      }),
      this.signalrService.subscribeToMethod<IGameStartMessage>('GameStart', () => {
        this.goToPlay();
      }),
      this.signalrService.subscribeToMethod<IGameStatusMessage>('GameStatus', () => {
        this.goToPlay();
      })
    );
  }

  openSelectLanguage(): void {
    const bottomSheetRef = this.bottomSheet.open(SelectLanguageComponent);

    bottomSheetRef.afterDismissed().subscribe((newLanguageCode?: string) => {
      if (newLanguageCode && newLanguageCode !== this.currentLanguageCode()) {
        localStorage.setItem(`${environment.localStoragePrefix}language`, newLanguageCode);
        this.dialog.open(LoadingDialogComponent, {
          data: { dialogTitle: $localize`:@@loading_dialog.loading:Loading...` },
          height: '100%',
          width: '100%'
        });
        window.location.reload();
      }
    });
  }

  openJoinGameDialogIfGameInUrl(): void {
    const gameIdFromUrl = this.route.snapshot.queryParamMap.get('game');
    if (!gameIdFromUrl) {
      return;
    }

    void this.router.navigate([], { relativeTo: this.activatedRoute });
    this.openJoinGameDialog(gameIdFromUrl);
  }

  openCreateGameDialog(gameToLoad?: IGameListItem): void {
    this.createGameDialogRef = this.dialog.open(CreateGameDialogComponent, {
      data: gameToLoad ?? null,
      height: '100%',
      width: '100%'
    });
  }

  openJoinGameDialog(gameId: string): void {
    const game = this.games().find(currentGame => currentGame.gameId === gameId);

    if (!game) {
      this.notificationService.showError($localize`:@@home.game_does_not_exist:Game does not exist`);
      return;
    }

    this.joinGameDialogRef = this.dialog.open(JoinGameDialogComponent, {
      data: game,
      height: '100%',
      width: '100%'
    });
  }

  openHowToPlayDialog(): void {
    this.howToPlayDialogRef = this.dialog.open(HowToPlayDialogComponent, {
      height: '100%',
      width: '100%'
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
  }

  private goToPlay(): void {
    this.createGameDialogRef?.close();
    this.joinGameDialogRef?.close();
    this.howToPlayDialogRef?.close();

    void this.router.navigate(['/play']);
  }

  private setupLogoChessBoard(): IChessBox[][] {
    const chessBoard = CommonHelper.buildChessBoard(
      COMMON_CONSTANTS.LOGO_CHESS_BOARD_ROWS,
      COMMON_CONSTANTS.LOGO_CHESS_BOARD_COLUMNS
    );

    chessBoard[0][5].figure = { typeId: FigureTypeEnum.Cat } as IFigure;
    chessBoard[0][7].figure = { typeId: FigureTypeEnum.Cat } as IFigure;
    chessBoard[2][5].figure = { typeId: FigureTypeEnum.Cat } as IFigure;
    chessBoard[2][7].figure = { typeId: FigureTypeEnum.Cat } as IFigure;
    chessBoard[1][6].figure = { typeId: FigureTypeEnum.Mouse } as IFigure;

    const logoTitle = $localize`:@@home.title:CATS & MOUSE`;
    const titlePositions = [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4]
    ];
    const titleCharacters = [0, 1, 2, 3, 5, 7, 8, 9, 10, 11];

    titlePositions.forEach(([rowIndex, columnIndex], index) => {
      chessBoard[rowIndex][columnIndex].text = logoTitle[titleCharacters[index]] ?? null;
    });

    return chessBoard;
  }
}
