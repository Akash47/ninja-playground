# Katora: free peer-to-peer mode (no game server)

The same page works two ways. At load it checks for a Katora game server; if there is none (static hosting, or a file on disk) it switches to peer-to-peer.

| | Server mode | Peer-to-peer mode |
|---|---|---|
| Who runs the game rules | the Node server | the room creator's browser (the "host") |
| How players connect | HTTP + Server-Sent Events | WebRTC data channels, straight to the host |
| Needs a server running | yes (laptop + tunnel, or a host) | no |
| Costs | your laptop / a host | $0 |
| Room survives a reload | server keeps it 12h, saved to disk | host saves it in the browser for 12h and resumes it; friends reconnect automatically |

## How it works
1. The host's browser registers a room code (e.g. `QJAM`) with a free public "meeting point" (PeerJS's open signaling broker). The broker refuses an id that is already taken, which keeps room codes unique for free.
2. A friend enters the code. Their browser sends the host an offer *through the broker*; the host answers the same way. They swap network candidates, and a direct WebRTC connection opens.
3. From then on nothing goes through the broker. The host runs `roomcore.js` (the exact same rules file the Node server uses) and sends every player a snapshot over the data channel.
4. Video uses the same handshake relay: guests send their camera handshake messages to the host, which forwards them to the right player. The video itself still goes directly between players.

Files: `roomcore.js` (rules, shared with the server), `p2p.js` (host, guest, broker handshake), `game.js` (the cards engine). Tests: `roomcore.test.js`, `rooms.test.js`.

## Meeting strangers: Find a table / Quick match
A host can tick **Public table**. While the room is waiting for players, the host's browser also registers on one of 30 well-known broker ids (`katora-lobby-0..29`). "Find a table" pings all 30 and each live one answers with `{code, host, n, max}`; "Quick match" joins the first open table or opens a public one. The broker only relays messages shaped like real WebRTC handshakes, so the ping and reply are wrapped as ICE-candidate messages (found by testing; see `ice()` in `p2p.js`). In server mode the same list is `GET /rooms`. Hosts can remove a player (`kick`, blocked from rejoining). Limits: at most 30 public tables listed, and a table vanishes when its host closes the tab.

## Hosting it for free
Run `./tools/make-static.sh`. It builds the whole static website into `dist/`: the Ninja Playground home page plus every project marked `"static": true` (no server code, no tests). Upload the contents of `dist/` to any free static host:
- Netlify (drag and drop the folder),
- GitHub Pages (needs a GitHub account and the folder in a repo), or
- Cloudflare Pages.
Friends open the site's link, then the Katora card, and the host shares the 4-letter code or the invite link. Everything is https, so cameras and "Add to Home Screen" work on phones.
Nothing has been uploaded anywhere yet; creating an account and publishing is your decision.

## Limits (be honest with your friends)
- The HOST's tab is the server. If the host closes it, the game pauses until they reopen it and tap "Resume hosting". A phone host that locks its screen or switches apps may drop everyone (the page asks the phone to stay awake while at a table).
- The host is the referee, so a technical host could cheat. Fine for friends, not for stakes.
- It depends on a free third-party meeting point (PeerJS public broker) with no uptime promise. If it is down, new connections cannot start (existing games keep working). To avoid the dependency, run your own broker (`peerjs-server`) and open the game with `?broker=wss://your-host/peerjs?key=peerjs`.
- Direct connections need STUN (Google's free servers) and sometimes a TURN relay. We also list PeerJS's free public TURN relay as a best effort; I could not verify its credentials still work. Strict office/school Wi-Fi and some mobile carriers may fail to connect.
- Sign-in and the usage dashboard belong to the server platform; they do not exist in static mode.
- Mesh video: each player uploads to every other player, so keep it to about 4-6 players with cameras on.

## What I found while building it
- The public broker silently drops any relay message whose payload lacks the fields `type`, `connectionId`, `label`, `reliable`, `serialization`. Found by testing the real service (see `pay()` in `p2p.js`).
- Two tabs of one browser share storage, so a guest tab was offered "Resume hosting" for the other tab's room. Fixed by tying that offer to the tab whose id matches the host's.
