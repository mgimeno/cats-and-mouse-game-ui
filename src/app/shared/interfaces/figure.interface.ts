import { type IFigurePosition } from './figure-position.interface';
import { type FigureTypeEnum } from '../enums/figure-type.enum';

export interface IFigure {
  id: number;
  typeId: FigureTypeEnum;
  position: IFigurePosition;
  canMoveToPositions: IFigurePosition[];
}
