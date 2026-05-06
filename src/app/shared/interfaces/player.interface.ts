import { type TeamEnum } from '../enums/team.enum';
import { type IFigure } from './figure.interface';

export interface IPlayer {
  //userId is coming back although I don't map it
  name: string;
  isTheirTurn: boolean;
  teamId: TeamEnum;
  isWinner: boolean;
  figures: IFigure[];
  hasUserLeftTheGame: boolean;
}
