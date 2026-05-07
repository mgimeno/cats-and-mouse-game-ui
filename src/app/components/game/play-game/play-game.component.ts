import {
  ChangeDetectionStrategy,
  Component,
  type OnDestroy,
  type OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { ChatComponent } from '../chat/chat.component';
import { ChessBoxComponent } from '../chess-box/chess-box.component';
import { COMMON_CONSTANTS } from '../../../shared/constants/common';
import { CommonHelper } from 'src/app/shared/utils/common-util';
import { ConfirmationDialogComponent } from 'src/app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { type IChessBox } from '../../../shared/interfaces/chess-box.interface';
import { type IFigure } from '../../../shared/interfaces/figure.interface';
import { type IGameStatus } from '../../../shared/interfaces/game-status.interface';
import { type IGameStatusMessage } from '../../../shared/interfaces/game-status-message.interface';
import { type IPlayer } from 'src/app/shared/interfaces/player.interface';
import { HowToPlayDialogComponent } from '../../how-to-play-dialog/how-to-play-dialog.component';
import { LoaderComponent } from 'src/app/shared/components/loader/loader.component';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { SignalrService } from '../../../shared/services/signalr-service';
import { TeamEnum } from 'src/app/shared/enums/team.enum';

interface GameInfo {
  header: string;
  subHeader: string | null;
  colourClass: 'green' | 'red';
}

enum TurnInfoStateEnum {
  Initial = 'Initial',
  MyTurn = 'MyTurn',
  TheirTurn = 'TheirTurn',
  IWon = 'IWon',
  ILost = 'ILost'
}

@Component({
  imports: [MatButtonModule, MatIconModule, LoaderComponent, ChessBoxComponent, ChatComponent],
  templateUrl: './play-game.component.html',
  styleUrls: ['./play-game.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayGameComponent implements OnInit, OnDestroy {
  private readonly signalrService = inject(SignalrService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly unsubscribeCallbacks: (() => void)[] = [];
  private readonly beepAudio = new Audio(COMMON_CONSTANTS.BEEP_AUDIO_DATA);

  readonly boardIndexes = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly turnInfoState = signal(TurnInfoStateEnum.Initial);
  readonly gameStatus = signal<IGameStatus | null>(null);
  readonly chessBoard = signal<IChessBox[][]>(
    CommonHelper.buildChessBoard(COMMON_CONSTANTS.PLAY_CHESS_BOARD_ROWS, COMMON_CONSTANTS.PLAY_CHESS_BOARD_COLUMNS)
  );
  readonly chessBoxCurrentlySelected = signal<IChessBox | null>(null);
  readonly hasSentRematchRequest = signal(false);
  readonly gameInfo = computed(() => this.buildGameInfo());

  ngOnInit(): void {
    this.signalrService.sendMessage('SendInProgressGameStatusToCaller').catch(reason => {
      console.error(reason);
      this.notificationService.showError($localize`:@@home.game_does_not_exist:Game does not exist`);
      void this.router.navigate(['/']);
    });

    this.unsubscribeCallbacks.push(
      this.signalrService.subscribeToMethod<IGameStatusMessage>('GameStatus', message => {
        this.gameStatus.set(message.gameStatus);
        this.chessBoxCurrentlySelected.set(null);
        this.updateChessBoard();
        this.alertUserIfItsTheirTurnOrGameOver();
        this.resetSentRematchRequestIfNeeded();
        this.updateTurnInfoState();
      })
    );
  }

  onChessBoxClicked(rowIndex: number, columnIndex: number): void {
    if (!this.isMyTurn()) {
      return;
    }

    const clickedChessBox = this.chessBoard()[rowIndex][columnIndex];
    const selectedChessBox = this.chessBoxCurrentlySelected();
    const canMoveSelectedFigure = selectedChessBox?.figure?.canMoveToPositions.some(
      position => position.rowIndex === rowIndex && position.columnIndex === columnIndex
    );

    if (canMoveSelectedFigure) {
      this.moveCurrentlySelectedFigure(rowIndex, columnIndex);
      return;
    }

    if (clickedChessBox.canFigureBeSelected && this.getNumberOfMyFiguresThatICanMove() > 1) {
      if (clickedChessBox.isFigureSelected) {
        this.applySelection(null);
      } else {
        this.applySelection(clickedChessBox);
      }
    }
  }

  getMyPlayer(): IPlayer {
    const gameStatus = this.getGameStatus();
    return gameStatus.players[gameStatus.myPlayerIndex];
  }

  getEnemyPlayer(): IPlayer {
    const gameStatus = this.getGameStatus();
    return gameStatus.players[gameStatus.myPlayerIndex === 0 ? 1 : 0];
  }

  isGameOver(): boolean {
    return this.gameStatus()?.players.some(player => player.isWinner) ?? false;
  }

  isMyTurn(): boolean {
    return this.gameStatus() ? this.getMyPlayer().isTheirTurn : false;
  }

  amITheWinner(): boolean {
    return this.gameStatus() ? this.getMyPlayer().isWinner : false;
  }

  hasAnyPlayerLeft(): boolean {
    return this.gameStatus()?.players.some(player => player.hasUserLeftTheGame) ?? false;
  }

  openHowToPlayDialog(): void {
    this.dialog.open(HowToPlayDialogComponent, { height: '100%', width: '100%' });
  }

  isRematchButtonVisible(): boolean {
    return this.isGameOver() && !this.hasAnyPlayerLeft();
  }

  isRematchButtonEnabled(): boolean {
    return this.isRematchButtonVisible() && !this.hasSentRematchRequest();
  }

  sendRematchRequest(): void {
    const gameStatus = this.gameStatus();
    if (!gameStatus || this.hasSentRematchRequest()) {
      return;
    }

    this.hasSentRematchRequest.set(true);
    this.signalrService.sendMessage('PlayerWantsToRematch', { gameId: gameStatus.gameId }).catch(reason => {
      console.error(reason);
      this.notificationService.showCommonError();
    });
  }

  exitGame(): void {
    const gameStatus = this.gameStatus();
    if (!gameStatus) {
      void this.router.navigate(['/']);
      return;
    }

    this.signalrService
      .sendMessage('ExitGame', { gameId: gameStatus.gameId })
      .then(() => {
        void this.router.navigate(['/']);
      })
      .catch(reason => {
        console.error(reason);
        this.notificationService.showCommonError();
      });
  }

  surrender(): void {
    const bottomSheetRef = this.bottomSheet.open(ConfirmationDialogComponent, {
      data: {
        dialogTitle: $localize`:@@play.surrender_question:Surrender?`,
        dialogBody: null
      }
    });

    bottomSheetRef.afterDismissed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.signalrService.sendMessage('Surrender').catch(reason => {
          console.error(reason);
          this.notificationService.showCommonError();
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
  }

  private buildGameInfo(): GameInfo {
    if (!this.gameStatus()) {
      return { header: '', subHeader: null, colourClass: 'red' };
    }

    if (this.isGameOver()) {
      return this.amITheWinner()
        ? { header: $localize`:@@play.win:You win!`, subHeader: null, colourClass: 'green' }
        : { header: $localize`:@@play.lose:You lose`, subHeader: null, colourClass: 'red' };
    }

    if (this.isMyTurn()) {
      return {
        header: $localize`:@@play.your_turn:Your turn!`,
        subHeader: this.amICatsPlayer()
          ? $localize`:@@play.cat_turn_info:select a cat and then move it`
          : $localize`:@@play.mouse_turn_info:move the mouse piece`,
        colourClass: 'green'
      };
    }

    return {
      header: $localize`:@@play.their_turn:Their turn`,
      subHeader: `${this.getEnemyPlayer().name} ${$localize`:@@play.is_thinking:is thinking...`}`,
      colourClass: 'red'
    };
  }

  private getGameStatus(): IGameStatus {
    const gameStatus = this.gameStatus();
    if (!gameStatus) {
      throw new Error('Game status is not available');
    }

    return gameStatus;
  }

  private amICatsPlayer(): boolean {
    return this.getMyPlayer().teamId === TeamEnum.Cats;
  }

  private updateTurnInfoState(): void {
    if (this.isGameOver()) {
      this.turnInfoState.set(this.amITheWinner() ? TurnInfoStateEnum.IWon : TurnInfoStateEnum.ILost);
      return;
    }

    this.turnInfoState.set(this.isMyTurn() ? TurnInfoStateEnum.MyTurn : TurnInfoStateEnum.TheirTurn);
  }

  private alertUserIfItsTheirTurnOrGameOver(): void {
    if (this.isMyTurn() || this.isGameOver()) {
      void this.beepAudio.play().catch((): void => undefined);
    }
  }

  private resetSentRematchRequestIfNeeded(): void {
    if (!this.isGameOver() && this.hasSentRematchRequest()) {
      this.hasSentRematchRequest.set(false);
    }
  }

  private getFigureInPosition(rowIndex: number, columnIndex: number): IFigure | null {
    const gameStatus = this.gameStatus();
    if (!gameStatus) {
      return null;
    }

    return (
      gameStatus.players
        .flatMap(player => player.figures)
        .find(figure => figure.position.rowIndex === rowIndex && figure.position.columnIndex === columnIndex) ?? null
    );
  }

  private updateChessBoard(): void {
    const nextBoard = this.chessBoard().map((row, rowIndex) =>
      row.map((chessBox, columnIndex) => {
        const figure = this.getFigureInPosition(rowIndex, columnIndex);

        return {
          ...chessBox,
          figure,
          isFigureSelected: false,
          canFigureBeSelected:
            this.isMyTurn() && !!figure && this.isMyFigure(figure.id) && figure.canMoveToPositions.length > 0,
          canBeNewPositionForSelectedFigure: false
        };
      })
    );

    this.chessBoard.set(nextBoard);

    if (this.isMyTurn() && this.getNumberOfMyFiguresThatICanMove() === 1) {
      const onlyFigureThatICanMove = this.getMyPlayer().figures.find(figure => figure.canMoveToPositions.length > 0);
      if (onlyFigureThatICanMove) {
        this.applySelection(
          nextBoard[onlyFigureThatICanMove.position.rowIndex][onlyFigureThatICanMove.position.columnIndex]
        );
      }
    }
  }

  private applySelection(selectedChessBox: IChessBox | null): void {
    const selectedFigureId = selectedChessBox?.figure?.id ?? null;
    const allowedMoves = selectedChessBox?.figure?.canMoveToPositions ?? [];
    let selectedBoxInNextBoard: IChessBox | null = null;

    const nextBoard = this.chessBoard().map(row =>
      row.map(chessBox => {
        const isSelected = selectedFigureId !== null && chessBox.figure?.id === selectedFigureId;
        const nextChessBox = {
          ...chessBox,
          isFigureSelected: isSelected,
          canBeNewPositionForSelectedFigure: allowedMoves.some(
            position =>
              position.rowIndex === chessBox.figure?.position.rowIndex &&
              position.columnIndex === chessBox.figure?.position.columnIndex
          )
        };

        if (isSelected) {
          selectedBoxInNextBoard = nextChessBox;
        }

        return nextChessBox;
      })
    );

    if (selectedFigureId !== null) {
      allowedMoves.forEach(position => {
        nextBoard[position.rowIndex][position.columnIndex] = {
          ...nextBoard[position.rowIndex][position.columnIndex],
          canBeNewPositionForSelectedFigure: true
        };
      });
    }

    this.chessBoard.set(nextBoard);
    this.chessBoxCurrentlySelected.set(selectedBoxInNextBoard);
  }

  private getNumberOfMyFiguresThatICanMove(): number {
    return this.getMyPlayer().figures.filter(figure => figure.canMoveToPositions.length > 0).length;
  }

  private isMyFigure(figureId: number): boolean {
    return this.getMyPlayer().figures.some(figure => figure.id === figureId);
  }

  private moveCurrentlySelectedFigure(rowIndex: number, columnIndex: number): void {
    const selectedFigure = this.chessBoxCurrentlySelected()?.figure;
    if (!selectedFigure) {
      return;
    }

    this.signalrService
      .sendMessage('Move', {
        figureId: selectedFigure.id,
        rowIndex,
        columnIndex
      })
      .catch(reason => {
        console.error(reason);
        this.notificationService.showCommonError();
      });
  }
}
