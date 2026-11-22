# Katora: rooms and screens

## Two ways to play
- One screen (hot-seat): everyone shares one device. Game runs in the browser with the same engine. No server needed.
- Many screens: one player creates a room and gets a 4-letter code. Others join from their own device. The server runs the game.

## Design decisions
| # | Decision | Alternative | Why |
|---|---|---|---|
| R1 | Server is the authority in rooms | Trust each client | Clients could cheat. The engine only runs on the server |
| R2 | Server-Sent Events down, POST up | WebSockets, polling | SSE + fetch is built into browsers and Node: zero dependencies. Katora is turn-based, so one-way push is enough |
| R3 | Same engine file in browser and server | Two implementations | One set of rules, one test suite |
| R4 | Room state in memory | Database | Rooms are short-lived. Lost on restart (known limit) |
| R5 | Player identity = random id per browser tab | Sign-in | Play money, open project. Refresh keeps your seat; sign-in can come later |
| R6 | Game API lives in the project folder and the gateway delegates /p/katora/api/* to it | A separate server | Gateway keeps tracking every call and enforcing sign-in |

## Room API (under /p/katora/api)
POST /rooms {pid,name} -> {code}
POST /rooms/CODE/join {pid,name}
POST /rooms/CODE/start {pid}      (host only)
POST /rooms/CODE/bid {pid,bid}    (current player only, bid 0 = pass)
POST /rooms/CODE/next {pid}       (after round end)
POST /rooms/CODE/end {pid}        (host only)
GET  /rooms/CODE/events?pid=      (SSE: full state snapshot on every change)

## Known limits
- Rooms vanish on server restart; rooms older than 6 hours are deleted.
- A player who leaves mid-game blocks the table (host can end the game).
- pid is not a secret: fine for play money, not for real accounts.
