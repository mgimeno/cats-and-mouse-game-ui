import { IMessageToClient } from './message-to-client.interface';
import { IGameStatus } from './game-status.interface';

export interface IGameStatusMessage extends IMessageToClient {
  gameStatus: IGameStatus;
}
