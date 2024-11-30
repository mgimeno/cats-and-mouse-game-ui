import { IMessageToClient } from './message-to-client.interface';

export interface IPlayerHasInProgressGameMessage extends IMessageToClient {
  hasInProgressGame: boolean;
}
