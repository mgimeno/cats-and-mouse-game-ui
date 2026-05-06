import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import { type FormControl, type FormGroup } from '@angular/forms';

import { TeamEnum } from '../../enums/team.enum';
import { type IGameListItem } from '../../interfaces/game-list-item.interface';

export interface TeamFormControls {
  userName: FormControl<string | null>;
  teamId: FormControl<TeamEnum | null>;
  gamePassword: FormControl<string | null>;
}

@Component({
  selector: 'app-team-select',
  templateUrl: './team-select.component.html',
  styleUrls: ['./team-select.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamSelectComponent {
  readonly formGroup = input.required<FormGroup<TeamFormControls>>();
  readonly game = input<IGameListItem | null>(null);
  readonly formValueVersion = signal(0);

  readonly teamEnum = TeamEnum;
  readonly catsText = $localize`:@@select_team.cats:cats`;
  readonly mouseText = $localize`:@@select_team.mouse:mouse`;
  readonly opponentText = $localize`:@@select_team.opponent:opponent`;
  readonly formValueChangesEffect = effect(onCleanup => {
    const subscription = this.formGroup().valueChanges.subscribe(() => {
      this.formValueVersion.update(version => version + 1);
    });

    onCleanup(() => subscription.unsubscribe());
  });

  getTeamName(teamEnum: TeamEnum): string {
    this.formValueVersion();

    const game = this.game();
    const formGroup = this.formGroup();

    if (game) {
      return game.teamId === teamEnum ? game.userName : (formGroup.controls.userName.value ?? '');
    }

    if (formGroup.controls.teamId.value === null) {
      return teamEnum === TeamEnum.Cats ? this.catsText : this.mouseText;
    }

    return formGroup.controls.teamId.value === teamEnum ? (formGroup.controls.userName.value ?? '') : this.opponentText;
  }

  selectMyTeam(teamEnum: TeamEnum): void {
    if (this.canSelectTeam()) {
      this.formGroup().controls.teamId.setValue(teamEnum);
    }
  }

  isMyTeamSelected(teamEnum: TeamEnum): boolean {
    const selectedTeamId = this.formGroup().controls.teamId.value;
    return selectedTeamId !== null && selectedTeamId === teamEnum;
  }

  isOpponentTeamSelected(teamEnum: TeamEnum): boolean {
    const selectedTeamId = this.formGroup().controls.teamId.value;
    return selectedTeamId !== null && selectedTeamId !== teamEnum;
  }

  canSelectTeam(): boolean {
    return this.game() == null;
  }
}
