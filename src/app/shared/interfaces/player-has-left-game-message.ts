import { IMessageToClient } from './message-to-client.interface';
import { TeamEnum } from '../enums/team.enum';

export interface IPlayerHasLeftGameMessage extends IMessageToClient {
  gameId:string;
  userName:string;
  teamId: TeamEnum;
}
