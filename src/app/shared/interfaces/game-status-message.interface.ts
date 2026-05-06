import { type IMessageToClient } from './message-to-client.interface';
import { type IGameStatus } from './game-status.interface';

export interface IGameStatusMessage extends IMessageToClient {
  gameStatus: IGameStatus;
}
