import { type IMessageToClient } from './message-to-client.interface';
import { type IChatLine } from './chat-line.interface';

export interface IChatMessage extends IMessageToClient {
  gameId: string;
  chatLine: IChatLine;
}
