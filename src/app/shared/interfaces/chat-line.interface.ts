import { TeamEnum } from '../enums/team.enum';


export interface IChatLine {
  userName: string;
  teamId: TeamEnum;
  message: string;

  class: string;
}
