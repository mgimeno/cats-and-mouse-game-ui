import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ChessBoxColorEnum } from '../../../shared/enums/chess-box-color.enum';
import { FigureTypeEnum } from '../../../shared/enums/figure-type.enum';
import { type IChessBox } from '../../../shared/interfaces/chess-box.interface';

@Component({
  selector: 'app-chess-box',
  templateUrl: './chess-box.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChessBoxComponent {
  readonly chessBox = input.required<IChessBox>();
  readonly chessBoxCurrentlySelected = input<IChessBox | null>(null);

  readonly figureTypeEnum = FigureTypeEnum;
  readonly chessBoxColorEnum = ChessBoxColorEnum;

  hasFigureOfType(figureType: FigureTypeEnum): boolean {
    return this.chessBox().figure?.typeId === figureType;
  }
}
