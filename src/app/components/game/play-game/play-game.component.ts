import { Component, OnInit, OnDestroy } from '@angular/core';
import { SignalrService } from '../../../shared/services/signalr-service';
import { IGameStatus } from '../../../shared/interfaces/game-status.interface';
import { IGameStatusMessage } from '../../../shared/interfaces/game-status-message.interface';
import { IFigure } from '../../../shared/interfaces/figure.interface';
import { IChessBox } from '../../../shared/interfaces/chess-box.interface';
import { COMMON_CONSTANTS } from '../../../shared/constants/common';
import { IPlayer } from 'src/app/shared/interfaces/player.interface';
import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { Router } from '@angular/router';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { HowToPlayDialogComponent } from '../../how-to-play-dialog/how-to-play-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from 'src/app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { CommonHelper } from 'src/app/shared/helpers/common-helper';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { DrawAttentionAnimation, DrawAttentionAnimationStateEnum } from './play-game.component.animations';


@Component({
  templateUrl: './play-game.component.html',
  styleUrls: ['./play-game.component.scss'],
  animations: [DrawAttentionAnimation]
})
export class PlayGameComponent implements OnInit, OnDestroy {

  attentionAnimation = DrawAttentionAnimationStateEnum.Initial;

  gameInfoHeader: string;
  gameInfoSubHeader: string;
  gameInfoHeaderColourClass: string;

  private chessBoard: [IChessBox[], IChessBox[], IChessBox[], IChessBox[], IChessBox[], IChessBox[], IChessBox[], IChessBox[]] = null;
  private chessBoxCurrentlySelected: IChessBox = null;

  gameStatus: IGameStatus = null;

  private beepAudio = new Audio(COMMON_CONSTANTS.BEEP_AUDIO_DATA);

  private hasSentRematchRequest: boolean = false;


  constructor(private signalrService: SignalrService,
    private router: Router,
    private notificationService: NotificationService,
    private dialog: MatDialog,
    private bottomSheet: MatBottomSheet) {

    this.chessBoard = CommonHelper.buildChessBoard(COMMON_CONSTANTS.PLAY_CHESS_BOARD_ROWS, COMMON_CONSTANTS.PLAY_CHESS_BOARD_COLUMNS);
  }

  ngOnInit() : void {

    this.signalrService.sendMessage("SendInProgressGameStatusToCaller")
      .catch((reason: any) => {
        console.error(reason);
        this.notificationService.showError("Game does not exist");
        this.router.navigate(['/']);
      });


    this.signalrService.subscribeToMethod("GameStatus", (message: IGameStatusMessage) => {

      this.gameStatus = message.gameStatus;

      this.chessBoxCurrentlySelected = null;

      this.updateChessBoard();

      this.alertUserIfItsTheirTurnOrGameOver();

      this.resetSentRematchRequestIfNeeded();

      this.updateGameInfo();

      this.triggerGameInfoAnimation();
      
    });
  }

  private updateGameInfo(): void{
    if(this.isGameOver()){
      if(this.amITheWinner()){
        this.gameInfoHeader = $localize`:@@play.win:You win!`; 
        this.gameInfoSubHeader = null;
        this.gameInfoHeaderColourClass = "green";
      }
      else{
        this.gameInfoHeader = $localize`:@@play.lose:You lose`;
        this.gameInfoSubHeader = null;
        this.gameInfoHeaderColourClass = "red";
      }
    }
    else{
      if(this.isMyTurn()){
        this.gameInfoHeader = $localize`:@@play.your_turn:Your turn!`;
        this.gameInfoSubHeader = this.amICatsPlayer() ? $localize`:@@play.cat_turn_info:select a cat and then move it` : $localize`:@@play.mouse_turn_info:move the mouse piece`;
        this.gameInfoHeaderColourClass = "green";
      }
      else{
        this.gameInfoHeader = $localize`:@@play.their_turn:Their turn`;
        this.gameInfoSubHeader = `${this.getEnemyPlayer().name} ${$localize`:@@play.is_thinking:is thinking...`}`;
        this.gameInfoHeaderColourClass = "red";
      }
    }
  }

  private triggerGameInfoAnimation(): void{
    if(this.isGameOver()){
      if(this.amITheWinner()){
        this.attentionAnimation = DrawAttentionAnimationStateEnum.IWon;
      }
      else{
        this.attentionAnimation = DrawAttentionAnimationStateEnum.ILost;
      }
    }
    else{
      if(this.isMyTurn()){
        this.attentionAnimation = DrawAttentionAnimationStateEnum.MyTurn;
      }
      else{
        this.attentionAnimation = DrawAttentionAnimationStateEnum.TheirTurn;
      }
    }
  }

  private alertUserIfItsTheirTurnOrGameOver(): void {
    if (this.isMyTurn() || this.isGameOver()) {
      this.beepAudio.play();
    }

  }

  private resetSentRematchRequestIfNeeded(): void {
    if (!this.isGameOver() && this.hasSentRematchRequest) {
      this.hasSentRematchRequest = false;
    }
  }

  getFigureInPosition = (rowIndex: number, columnIndex: number): IFigure => {

    //todo Find a more elegant solution for this method.

    if (!this.gameStatus) {
      return null;
    }

    let figureInPosition: IFigure = null;

    for (let playerIndex = 0; playerIndex < this.gameStatus.players.length; playerIndex++) {

      for (let figureIndex = 0; figureIndex < this.gameStatus.players[playerIndex].figures.length; figureIndex++) {

        const figure = this.gameStatus.players[playerIndex].figures[figureIndex];

        if (figure.position.rowIndex === rowIndex && figure.position.columnIndex === columnIndex) {

          figureInPosition = figure;

          break;
        }

      }

    }

    return figureInPosition;

  }

  onChessBoxClicked = (rowIndex: number, columnIndex: number): void => {

    if (!this.isMyTurn()) {
      return;
    }

    let clickedChessBox = this.chessBoard[rowIndex][columnIndex];

    const canMoveCurrentlySelectedFigureToThisPosition = this.chessBoxCurrentlySelected && this.chessBoxCurrentlySelected.figure.canMoveToPositions.some(p => p.rowIndex === rowIndex && p.columnIndex === columnIndex);

    if (canMoveCurrentlySelectedFigureToThisPosition) {

      this.moveCurrentlySelectedFigure(rowIndex, columnIndex);

    }
    else {

      if (clickedChessBox.canFigureBeSelected && this.getNumberOfMyFiguresThatICanMove() > 1) {
        //Select/Deselect a figure

        this.deselectCurrentlySelectedChessBox();

        if (clickedChessBox.isFigureSelected) {
          clickedChessBox.isFigureSelected = false;
        }
        else {
          this.selectChessBox(clickedChessBox);
        }

      }

    }

  };

  getMyPlayer(): IPlayer {
    return this.gameStatus.players[this.gameStatus.myPlayerIndex];
  }

  getEnemyPlayer(): IPlayer {
    return this.gameStatus.players[(this.gameStatus.myPlayerIndex === 0 ? 1 : 0)];
  }

  isGameOver = (): boolean => {
    return this.gameStatus.players.some(p => p.isWinner);
  }

  isMyTurn = (): boolean => {
    return this.getMyPlayer().isTheirTurn;
  }

  amITheWinner = (): boolean => {
    return this.getMyPlayer().isWinner;
  }

  amICatsPlayer = (): boolean => {
    return (this.getMyPlayer().teamId === TeamEnum.Cats);
  }

  hasAnyPlayerLeft = (): boolean => {
    return this.gameStatus.players.some(p => p.hasUserLeftTheGame);
  }

  openHowToPlayDialog(): void {
    this.dialog.open(HowToPlayDialogComponent, { height: "100%", width: "100%" });
  }

  isRematchButtonVisible = (): boolean => {
    return this.isGameOver() && !this.hasAnyPlayerLeft();
  };

  isRematchButtonEnabled = (): boolean => {
    return this.isRematchButtonVisible() && !this.hasSentRematchRequest;
  };

  sendRematchRequest(): void {
    if (this.hasSentRematchRequest) {
      return;
    }
    this.hasSentRematchRequest = true;
    this.signalrService.sendMessage("PlayerWantsToRematch", { gameId: this.gameStatus.gameId })
      .catch((reason: any) => {
        console.error(reason);
        this.notificationService.showCommonError();
      });
  }

  exitGame(): void {
    this.signalrService.sendMessage("ExitGame", { gameId: this.gameStatus.gameId })
      .then(() => {
        this.router.navigate(['/']);
      })
      .catch((reason: any) => {
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

        this.signalrService.sendMessage("Surrender")
          .catch((reason: any) => {
            console.error(reason);
        this.notificationService.showCommonError();
          });

      }

    });

  }

  private updateChessBoard = (): void => {

    for (let rowIndex = 0; rowIndex < COMMON_CONSTANTS.PLAY_CHESS_BOARD_ROWS; rowIndex++) {

      for (let columnIndex = 0; columnIndex < COMMON_CONSTANTS.PLAY_CHESS_BOARD_COLUMNS; columnIndex++) {

        const figure = this.getFigureInPosition(rowIndex, columnIndex);
        this.chessBoard[rowIndex][columnIndex].figure = figure;
        
        this.chessBoard[rowIndex][columnIndex].isFigureSelected = false;
        this.chessBoard[rowIndex][columnIndex].canFigureBeSelected = this.isMyTurn() && figure && this.isMyFigure(figure.id) && (figure.canMoveToPositions.length > 0);
        this.chessBoard[rowIndex][columnIndex].canBeNewPositionForSelectedFigure = false;

      }

    }


    if (this.isMyTurn() && this.getNumberOfMyFiguresThatICanMove() === 1) {
      this.preSelectTheOnlyChessBoxThatICanSelect();
    }

  };

  private preSelectTheOnlyChessBoxThatICanSelect = (): void => {

    const onlyFigureThatICanMove = this.getMyPlayer().figures.find(f => f.canMoveToPositions.length > 0);
    let chessBox = this.chessBoard[onlyFigureThatICanMove.position.rowIndex][onlyFigureThatICanMove.position.columnIndex];

    this.selectChessBox(chessBox);
  };

  private selectChessBox = (chessBox: IChessBox): void => {

    chessBox.isFigureSelected = true;

    this.chessBoxCurrentlySelected = chessBox;

    //highlight possible moves
    this.chessBoxCurrentlySelected.figure.canMoveToPositions.forEach(p => {

      this.chessBoard[p.rowIndex][p.columnIndex].canBeNewPositionForSelectedFigure = true;

    });
  };

  private getNumberOfMyFiguresThatICanMove = (): number => {
    return this.getMyPlayer().figures.filter(f => f.canMoveToPositions.length > 0).length;
  };

  private isMyFigure = (figureId: number): boolean => {
    return this.getMyPlayer().figures.some(f => f.id === figureId);
  }

  private deselectCurrentlySelectedChessBox = (): void => {

    if (this.chessBoxCurrentlySelected) {
      this.chessBoard[this.chessBoxCurrentlySelected.figure.position.rowIndex][this.chessBoxCurrentlySelected.figure.position.columnIndex].isFigureSelected = false;

      this.chessBoxCurrentlySelected = null;

      //remove all highlighted chessboxes possible moves
      for (let rowIndex = 0; rowIndex < COMMON_CONSTANTS.PLAY_CHESS_BOARD_ROWS; rowIndex++) {

        for (let columnIndex = 0; columnIndex < COMMON_CONSTANTS.PLAY_CHESS_BOARD_COLUMNS; columnIndex++) {

          this.chessBoard[rowIndex][columnIndex].canBeNewPositionForSelectedFigure = false;

        }

      }

    }

  };

  private moveCurrentlySelectedFigure = (rowIndex: number, columnIndex: number): void => {

    const message = {
      figureId: this.chessBoxCurrentlySelected.figure.id,
      rowIndex: rowIndex,
      columnIndex: columnIndex
    };

    this.signalrService.sendMessage("Move", message)
      .catch((reason: any) => {
        console.error(reason);
      });
  };

  ngOnDestroy(): void {
    this.signalrService.unsubscribeToMethod("GameStatus");
  }

}
