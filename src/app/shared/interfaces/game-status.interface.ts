import { type IPlayer } from './player.interface';

export interface IGameStatus {
  gameId: string;
  players: IPlayer[];
  myPlayerIndex: number;
}
