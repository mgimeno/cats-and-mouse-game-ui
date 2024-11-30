import { ChessBoxColorEnum } from '../enums/chess-box-color.enum';
import { IFigure } from './figure.interface';


export interface IChessBox {
  colorId: ChessBoxColorEnum;
  figure: IFigure;

  isFigureSelected: boolean;
  canFigureBeSelected: boolean;
  canBeNewPositionForSelectedFigure: boolean;

  text: string;
}
