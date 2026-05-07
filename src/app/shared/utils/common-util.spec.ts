import { ChessBoxColorEnum } from '../enums/chess-box-color.enum';
import { CommonHelper } from './common-util';

describe('CommonHelper', () => {
  it('builds a chess board with alternating colors across rows', () => {
    const board = CommonHelper.buildChessBoard(3, 4);

    expect(board).toHaveLength(3);
    expect(board.every(row => row.length === 4)).toBe(true);
    expect(board[0][0].colorId).toBe(ChessBoxColorEnum.White);
    expect(board[0][1].colorId).toBe(ChessBoxColorEnum.Black);
    expect(board[1][0].colorId).toBe(ChessBoxColorEnum.Black);
    expect(board[1][1].colorId).toBe(ChessBoxColorEnum.White);
  });

  it('creates independent empty boxes', () => {
    const board = CommonHelper.buildChessBoard(2, 2);

    board[0][0].canFigureBeSelected = true;

    expect(board[0][1].canFigureBeSelected).toBe(false);
    expect(board[1][0].figure).toBeNull();
    expect(board[1][1].text).toBeNull();
  });
});
