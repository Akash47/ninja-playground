# Katora: video chat at the table

Each player in a room can show their camera on their seat, in place of the animal avatar. Tap a face to enlarge it.

## How it works
- The game state still goes through the room server (server = referee).
- Camera and mic go DIRECTLY between players' browsers using WebRTC (peer-to-peer). The room server never sees media.
- To connect, two browsers must first swap a few handshake messages (an "offer", an "answer", and network "candidates"). This is called signaling. We reuse the room's existing live channel for it:
  POST /rooms/CODE/signal {to, data}  ->  server forwards to that seat's open event stream as {signal:{from,data}}.
- POST /rooms/CODE/video {on} sets a per-seat "my camera is on" flag, shown to everyone in the room snapshot as `video: [bool...]`.

## Design decisions
| # | Decision | Alternative | Why |
|---|---|---|---|
| V1 | Peer-to-peer mesh (everyone connects to everyone with video on) | A media server (SFU) | No server cost or code. Fine up to ~6 players; each extra player adds an upload stream |
| V2 | Only players who joined video see/hear others | Everyone receives, only some send | No renegotiation when someone switches video on later. Joining is also the consent step |
| V3 | The LOWER seat makes the offer when two players are both on | Both try | Prevents "glare" (both offering at once) |
| V4 | Small video: 320x240 at 15fps | HD | Mesh upload cost grows with players; faces at 46px don't need more |
| V5 | Mic starts muted | Mic on | Friends sitting in the same room would cause echo |
| V6 | STUN only (Google's public servers) | Add a TURN relay | Free and zero setup. About 1 in 8 networks (strict office/school Wi-Fi, some mobile carriers) cannot connect without TURN |
| V7 | Server clears a seat's video flag when its stream closes | Trust the flag | A closed tab must not leave others calling a dead camera |

## Privacy
- Camera/mic only start after the player taps "Join video" and allows the browser prompt.
- STUN servers learn a player's public IP address (needed to connect). Media is encrypted in transit (WebRTC always is).
- Nothing is recorded or stored by Katora.

## Known limits
- Browsers only allow the camera on https or localhost. On a phone you need the shared https link, not http://192.168...
- No retry when a connection fails; no TURN, so a few networks will not connect.
- 6+ players with video on a weak phone connection can stutter (mesh upload). Turn the camera off to lighten it.
- A player who turns "Camera off" sends black frames (their avatar is not shown behind it).

## Bigger faces, Big view, and chat (added later)
- A seat grows wider when its player has a camera, so the picture fills it (about 110x75 px on a laptop, versus a 46px circle before).
- "📺 Big view" (or tap any face) opens a full-screen grid of everyone's camera. Its tiles are muted because the sound already plays from the seats; playing it twice would double the audio.
- Chat is LIVE ONLY, on purpose: you type, and everyone sees a speech bubble over your seat for 8 seconds. Nothing is stored anywhere (not on the server, not in the host's browser, not on disk), so people who join late or reload see no earlier messages. Tests check that nothing is replayed or written to disk.
- Chat limits: 200 characters, and one message per 0.4 seconds per player.
- If a browser loses its saved player id (for example a closed tab), the page now says "You are not seated in that room any more" and goes back to the start, instead of showing a table the player cannot act on.
