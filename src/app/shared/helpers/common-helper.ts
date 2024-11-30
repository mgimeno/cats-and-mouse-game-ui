import { ChessBoxColorEnum } from '../enums/chess-box-color.enum';
import { IChessBox } from '../interfaces/chess-box.interface';

export class CommonHelper {

    public static getNewGuid(): string {
        return ([1e7].toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
        );
    }

    public static buildChessBoard = (numberOfRows: number, numberOfColumns:number): [IChessBox[], [], [], [],[], [], [], []] => {

        let result: [IChessBox[], [], [], [],[], [], [], []] = [[], [], [], [],[], [], [], []];
    
        let currentChessBoxColorId: ChessBoxColorEnum = ChessBoxColorEnum.White;
    
        for (let rowIndex = 0; rowIndex < numberOfRows; rowIndex++) {
    
          for (let columnIndex = 0; columnIndex < numberOfColumns; columnIndex++) {
    
            if (columnIndex !== 0) {
              currentChessBoxColorId = (currentChessBoxColorId === ChessBoxColorEnum.White ? ChessBoxColorEnum.Black : ChessBoxColorEnum.White)
            }
    
            const chessBox = <IChessBox>{
              colorId: currentChessBoxColorId,
              figure: null,
              isFigureSelected: false,
              canFigureBeSelected: false,
              canBeNewPositionForSelectedFigure: false,
              text: null
            };
    
            result[rowIndex][columnIndex] = chessBox;
    
          }
    
        }

        return result;
    
      };
}
