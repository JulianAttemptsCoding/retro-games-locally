# Tabletop game rules and provenance

These games are independent implementations of established abstract game rules, not copied code from unspecified browser-game mirrors. Chess move generation and outcome detection use [chess.js](https://github.com/jhlywa/chess.js), the widely used BSD-2-Clause library by Jeff Hlywa and contributors (approximately 4,400 GitHub stars checked October 27, 2026). Its complete license is retained with the vendored bundle by the parent app.

- **Chess:** standard chess through chess.js, including castling, en passant, selectable promotion, checkmate, stalemate, insufficient material, threefold repetition and the fifty-move draw. Move history is retained in PGN so repetition does not disappear between turns. No chess clocks or computer opponent are included.
- **Four in a Row:** standard 7-column, 6-row gravity game; four discs in any straight direction wins. Based on [Hasbro's Connect Four instructions](https://www.hasbro.com/common/instruct/ConnectFour.PDF). No proprietary art or branding is included.
- **Reversi:** 8×8 board, black starts, all bracketed lines flip, mandatory pass when no move exists, game ends when neither player can move. Follows the [World Othello Federation's official rules](https://www.worldothello.org/about/about-othello/othello-rules/official-rules/english).
- **American checkers / English draughts:** 8×8 dark squares, twelve men each. Men move/capture diagonally forward, kings move/capture one diagonal step in either direction, captures are mandatory, and a multi-jump must continue with the same piece. A man reaching its king row is crowned and that turn ends. The player with no legal move loses. Draw after three repeated positions or 40 moves by each player without a capture or man move. See [World Checkers/Draughts Federation rules](https://www.wcdf.net/rules.htm). This is not international 10×10 draughts.
- **Tic-tac-toe:** alternate placing marks on a 3×3 grid; three in a row wins, full board with no winner is a draw.
- **Freestyle Gomoku:** 15×15 board; black starts; five **or more** consecutive stones wins. This is the unrestricted freestyle variant, not Renju or tournament swap-opening Gomoku.
- **Mancala:** specifically **Kalah**, six pits with four stones each and one store per player. Sow counterclockwise, skipping the opposing store. Landing in your own store gives another turn. Landing in an empty own pit captures its stone and the opposite occupied pit. When a side empties, sweep the remaining stones into the other store. Highest store wins. Mancala is a family of games; this is not Oware.
- **Nim:** normal play, three heaps initially containing 3, 5 and 7 stones. Remove at least one stone from one heap per turn. The player taking the last stone wins. This is not misère Nim.
- **Dots & Boxes:** 4×4 points make nine boxes. Add one unclaimed orthogonal edge per turn. Closing one or two boxes claims them and grants another turn. Most claimed boxes wins.

## Online play

Local pass-and-play runs without network dependencies after the app is installed. Optional peer rooms use pinned MIT-licensed Trystero 0.25.0, public Nostr signaling and WebRTC data channels. Two users opening the same auto-join invite elect one host by exchanged session-token order. Explicit host/join controls are also provided. Host plays the first side and validates legal actions, sender, turn, revision and game/epoch before applying an online move. A guest only accepts state from its selected host. Extra peers cannot take a turn or replace an established opponent.

New-game requests require both players' consent. Network failures disable remote turns and display an honest waiting state; no connection is claimed before the handshake. The host is trusted, so these rooms are for casual play, not a cheat-resistant competitive service. Room codes are identifiers, not passwords. Some public relays and restrictive networks can prevent WebRTC connections. No private key or account is required.

## Source license

The independent tabletop UI and rule implementations in this directory are supplied under the parent project's MIT license. External chess.js and Trystero packages retain their own licenses and notices. Rule descriptions above are paraphrases, not copied instruction-book text.
