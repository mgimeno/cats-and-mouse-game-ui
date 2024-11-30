import { IMessageToClient } from './message-to-client.interface';
import { IChatLine } from './chat-line.interface';

export interface IChatMessage extends IMessageToClient  {
  gameId: string;
  chatLine: IChatLine;
}
