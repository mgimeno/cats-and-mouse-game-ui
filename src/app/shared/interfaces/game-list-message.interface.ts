import { IGameListItem } from './game-list-item.interface';
import { IMessageToClient } from './message-to-client.interface';

export interface IGameListMessage extends IMessageToClient  {
  gameList: IGameListItem[];
}
