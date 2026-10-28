# Retro Games Locally

A game library of well-known open-source retro games that run **offline in your browser** — solo, side by side on one
keyboard, or **online with friends** through a shared link. Searchable and filterable by who is playing and by type.

```sh
npm ci
npm start        # builds vendor bundles, serves http://localhost:3000 (and your LAN address)
npm test         # rule unit tests
npm run test:e2e # browser tests (Playwright)
```

Requires Node.js 22+. Open the LAN address printed on start from a phone or another computer on the same network.

## For reviewers: what's mine and how to check it

Most games here are **other people's open-source projects**, credited and pinned to an exact upstream
commit in [CREDITS.md](CREDITS.md). My work is the platform around them, plus the games marked
"Original":

| Mine | Where | Notes |
|---|---|---|
| Library hub: search, filters, player wrapper, invite links | `public/index.html`, `hub.js`, `catalog.js`, `play.html` | `catalog.js` is the single source of truth for every game |
| **1v1 Build Fight** | `public/games/buildfight/game.js` (~850 lines) | three.js third-person shooter with build mechanics (walls/floors/ramps), a bot opponent, and P2P online play over Trystero/WebRTC |
| **Slope (remake)** | `public/games/slope-run/game.js` | three.js endless downhill runner |
| **Tabletop rules engine** | `public/games/tabletop/rules.mjs` | Four in a Row, Checkers (mandatory captures), Reversi, Tic-Tac-Toe, Gomoku, Mancala, Nim, Dots & Boxes. Chess uses chess.js. |
| Duel Arena 1v1 | `public/games/duel-arena/` | top-down local 2-player game |
| Offline packaging | `scripts/`, `CREDITS.md` | vendored builds, licence files copied per game, SHA-256-pinned EmulatorJS cores, credits generator |

Slope and Build Fight are from-scratch remakes based on the public gameplay of closed or discontinued
games. They share no code or assets with the originals.

```bash
npm ci
npm test          # 14 rules tests: wins, draws, illegal moves, mandatory captures, Mancala capture/extra turn, chess mate
npm run test:e2e  # Playwright: hub search/filter, every game boots, Build Fight (walls block, ramps climb,
                  # shooting damages the bot, a full match ends with a winner), an autopilot proves Slope's
                  # generated track is beatable
```

## What is in it

| Players | Games |
| --- | --- |
| Solo | 2048, Hextris, Tetris (Classic), Match-3, Bubble Shooter, Pac-Man, Breakout, Snake, Asteroids, Space Invaders, Invaderz, Alien Invasion, T-Rex Runner, Floppy Bird, Clumsy Bird, Pseudo-3D Racer, Slope (remake), 1v1 Build Fight (vs bot) |
| Local 2P+ | Pong (shared keyboard), Duel Arena 1v1 (shared keyboard), all tabletop games (pass-and-play), console games with gamepads |
| Online friends | 1v1 Build Fight, Tetris — Friends (shared rooms), Chess, Four in a Row, Checkers, Reversi, Tic-Tac-Toe, Gomoku, Mancala, Nim, Dots & Boxes |
| Bring your own ROM | Mario Kart 64 / Super Mario Kart / Mario Kart: Super Circuit, or any SNES/GBA/N64 game, in the bundled EmulatorJS |

- **1v1.LOL** was permanently shut down by its publisher on 3 Nov 2025. *1v1 Build Fight* is a from-scratch remake of its
  public gameplay (third-person, build walls/floors/ramps/cones, pickaxe/shotgun/rifle, three lives each) that you can play
  against a bot or a friend online. Edit mode and materials are not included. *Duel Arena 1v1* is a separate, simpler
  top-down local game.
- **Slope** (Y8) is closed source, so *Slope (remake)* is written from scratch from its public gameplay description: a ball
  on a steep downhill track, speed that keeps rising, red blocks, gaps and jump ramps. Official game:
  <https://www.y8.com/games/slope>. Both remakes share no code or assets with the originals.
- **No ROMs are included.** Bring a file you legally own; it never leaves your browser.

Sources, licenses, stars and pinned commits for every bundled game are in [CREDITS.md](CREDITS.md). Add a game by
copying its repo into `public/games/<id>/`, adding an entry to `public/catalog.js`, then running `node scripts/credits.mjs`.

## Online rooms

Peer-to-peer over WebRTC using [Trystero](https://github.com/dmotz/trystero) and public Nostr relays for signaling.
Both players need internet to find each other; after that traffic is direct. Restrictive networks or relay outages can
block a connection — local modes always work. Rooms are casual (the host is trusted; no accounts, no anti-cheat).
`node scripts/p2p-check.mjs` runs a live two-browser check against a running server.

## Hosting

`.github/workflows/pages.yml` tests and deploys `public/` to GitHub Pages (enable *Settings → Pages → Source: GitHub
Actions*). Any static host works; `npm start` is only a convenience server.

## Layout

```
public/index.html, hub.js, catalog.js   library UI + the catalog (single source of truth)
public/play.html                        player wrapper: back, controls, restart, fullscreen, copy link
public/games/<id>/                      each game, with its own license
scripts/                                build, qa (smoke test + thumbnails), credits, p2p-check
test/, e2e/                             rule unit tests, Playwright browser tests
```
