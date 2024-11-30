import { Component, Input } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { TeamEnum } from '../../enums/team.enum';
import { IGameListItem } from '../../interfaces/game-list-item.interface';


@Component({
  selector: 'app-team-select',
  templateUrl: './team-select.component.html',
  styleUrls: ['./team-select.component.scss']
})
export class TeamSelectComponent {

  @Input() formGroup: UntypedFormGroup;
  @Input() game: IGameListItem = null;

  teamEnum = TeamEnum;

  catsText:string = $localize`:@@select_team.cats:cats`;
  mouseText:string = $localize`:@@select_team.mouse:mouse`;
  opponentText:string = $localize`:@@select_team.opponent:opponent`;

  getTeamName(teamEnum: TeamEnum): string {


    if (this.game) {
      if (this.game.teamId === teamEnum) {
        return this.game.userName;
      }
      else {
        return this.formGroup.controls.userName.value;
      }
    }
    else {
      if (this.formGroup.controls.teamId.value == null) {
        if (teamEnum === TeamEnum.Cats) {
          return this.catsText;
        }
        else {
          return this.mouseText;
        }
      }
      else {
        if (+this.formGroup.controls.teamId.value === teamEnum) {
          return this.formGroup.controls.userName.value;
        }
        else {
          return this.opponentText;
        }
      }
    }

  }

  selectMyTeam(teamEnum: TeamEnum): void {
    if (this.canSelectTeam()) {
      this.formGroup.controls.teamId.setValue(teamEnum);
    }
  }

  isMyTeamSelected(teamEnum: TeamEnum): boolean {
    return this.formGroup.controls.teamId.value !== null && (+this.formGroup.controls.teamId.value === teamEnum);
  }

  isOpponentTeamSelected(teamEnum: TeamEnum): boolean {
    if(this.formGroup.controls.teamId.value == null){
      return false;
    }
    else{
      return (this.formGroup.controls.teamId.value !== teamEnum);
    }
  }

  canSelectTeam(): boolean {
    return this.game == null;
  }

}
