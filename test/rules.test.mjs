import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { createGame, legalActions, applyAction, reversiFlips, scores } from '../public/games/tabletop/rules.mjs';

const play = (state, ...actions) => actions.reduce((s, a) => {
  const next = applyAction(s, a, Chess);
  assert.ok(next, `illegal action ${JSON.stringify(a)}`);
  return next;
}, state);

test('tic-tac-toe: row win ends the game for the first player', () => {
  const s = play(createGame('tictactoe'), { at: 0 }, { at: 3 }, { at: 1 }, { at: 4 }, { at: 2 });
  assert.equal(s.ended, true);
  assert.equal(s.winner, 0);
  assert.deepEqual(legalActions(s), []);
});

test('tic-tac-toe: full board without a line is a draw', () => {
  const order = [0, 1, 2, 4, 3, 5, 7, 6, 8];
  const s = play(createGame('tictactoe'), ...order.map((at) => ({ at })));
  assert.equal(s.winner, 'draw');
});

test('connect four: discs fall and four vertical wins', () => {
  let s = play(createGame('connect4'), { column: 3 });
  assert.equal(s.board[38], 1, 'first disc rests on the bottom row');
  s = play(s, { column: 4 }, { column: 3 }, { column: 4 }, { column: 3 }, { column: 4 }, { column: 3 });
  assert.equal(s.winner, 0);
});

test('connect four: a full column is not a legal move', () => {
  let s = createGame('connect4');
  for (let i = 0; i < 6; i++) s = play(s, { column: 0 });
  assert.equal(legalActions(s).some((a) => a.column === 0), false);
  assert.equal(applyAction(s, { column: 0 }, Chess), null);
});

test('reversi: standard opening has four legal moves for black and flips one disc', () => {
  const s = createGame('reversi');
  assert.deepEqual(legalActions(s).map((a) => a.at).sort((a, b) => a - b), [19, 26, 37, 44]);
  assert.deepEqual(reversiFlips(s.board, 19, 0), [27]);
  const n = play(s, { at: 19 });
  assert.deepEqual(scores(n), [4, 1]);
  assert.equal(n.turn, 1);
});

test('checkers: opening position has seven legal moves and rejects bad actions', () => {
  const s = createGame('checkers');
  assert.equal(s.board.filter((v) => v === 1).length, 12);
  assert.equal(s.board.filter((v) => v === 2).length, 12);
  assert.equal(legalActions(s).length, 7);
  assert.equal(applyAction(s, { from: 0, to: 9 }, Chess), null);
});

test('checkers: captures are mandatory', () => {
  const s = createGame('checkers');
  s.board = Array(64).fill(0);
  s.board[44] = 1; // red man
  s.board[37] = 2; // ivory man adjacent, capturable
  s.board[63] = 1;
  const moves = legalActions(s);
  assert.ok(moves.length > 0 && moves.every((m) => m.capture !== undefined), 'only the capture is offered');
});

test('mancala: sowing into your own store grants another turn', () => {
  const s = play(createGame('mancala'), { at: 2 });
  assert.equal(s.board[6], 1);
  assert.equal(s.turn, 0);
});

test('mancala: landing in an empty own pit captures the opposite pit', () => {
  const s = createGame('mancala');
  s.board = [1, 0, 0, 0, 0, 0, 0, 3, 4, 4, 4, 4, 4, 0];
  const n = play(s, { at: 0 });
  assert.equal(n.board[6], 5, 'one stone plus four captured');
  assert.equal(n.board[1], 0);
});

test('nim: taking the last stone wins (normal play)', () => {
  let s = createGame('nim');
  s = play(s, { heap: 0, count: 3 }, { heap: 1, count: 5 }, { heap: 2, count: 7 });
  assert.equal(s.ended, true);
  assert.equal(s.winner, 0);
});

test('dots & boxes: closing a box scores it and keeps the turn', () => {
  let s = createGame('dots');
  // box 0 edges: top 0, bottom 3, left 12, right 13
  s = play(s, { edge: 0 }, { edge: 3 }, { edge: 12 }, { edge: 5 });
  const before = s.turn;
  s = play(s, { edge: 13 });
  assert.equal(s.boxes[0], before + 1);
  assert.equal(s.turn, before, 'same player moves again');
});

test('gomoku: five in a row wins, four does not', () => {
  let s = createGame('gomoku');
  for (let i = 0; i < 4; i++) s = play(s, { at: i }, { at: 15 + i });
  assert.equal(s.ended, false);
  s = play(s, { at: 4 });
  assert.equal(s.winner, 0);
});

test('chess: scholar’s mate ends the game and illegal moves are rejected', () => {
  const sq = (name) => (8 - Number(name[1])) * 8 + name.charCodeAt(0) - 97;
  const mv = (from, to) => ({ from: sq(from), to: sq(to), promotion: 'q' });
  assert.equal(applyAction(createGame('chess', Chess), mv('e2', 'e5'), Chess), null);
  const s = play(createGame('chess', Chess), mv('e2', 'e4'), mv('e7', 'e5'), mv('d1', 'h5'), mv('b8', 'c6'), mv('f1', 'c4'), mv('g8', 'f6'), mv('h5', 'f7'));
  assert.equal(s.ended, true);
  assert.equal(s.winner, 0);
});

test('chess: ordinary moves expose a single action regardless of the promotion dropdown', () => {
  const s = createGame('chess', Chess);
  const e2e4 = legalActions(s, Chess).filter((a) => a.from === 52 && a.to === 36);
  assert.equal(e2e4.length, 1);
});
