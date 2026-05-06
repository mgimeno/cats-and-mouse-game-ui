import { type ChessBoxColorEnum } from '../enums/chess-box-color.enum';
import { type IFigure } from './figure.interface';

export interface IChessBox {
  colorId: ChessBoxColorEnum;
  figure: IFigure | null;

  isFigureSelected: boolean;
  canFigureBeSelected: boolean;
  canBeNewPositionForSelectedFigure: boolean;

  text: string | null;
}
