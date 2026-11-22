# Ninja Playground

A playground of small, silly projects. Each idea is a folder in `projects/`. The home page lists them; each one can be played in the browser.

**First project: Katora** — a table card game. Two cards each, bid on whether the dealer's next card lands between them. Rooms for friends, with live video and chat. It runs with **no game server** (peer-to-peer over WebRTC), so it can be hosted for free.

## Run it on your computer
```bash
node --watch server.js        # restarts itself when you change a file
```
Open http://localhost:3000. The home page is Ninja Playground; Katora is at `/p/katora/`.
Rooms, sign-in for locked projects, and the usage dashboard (the key is printed at startup) come from this server.

## Put it on the internet for free (GitHub Pages)
The site is plain static files, so GitHub Pages can host it. A workflow in `.github/workflows/pages.yml` runs the fast tests, builds `dist/` and publishes it on every push to `main`.

1. Create an empty **public** repository on github.com (for example `ninja-playground`). Free Pages needs a public repo.
2. In this folder, connect and push:
   ```bash
   git remote add origin https://github.com/YOUR-NAME/ninja-playground.git
   git push -u origin main
   ```
3. On GitHub: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.
4. Open the **Actions** tab, wait for the green tick, and your site is at `https://YOUR-NAME.github.io/ninja-playground/`.

Anything in a public repo is public, including commit author names and emails. If you don't want your email shown, use GitHub's "noreply" email in your git settings before you push.

You can also build by hand with `./tools/make-static.sh` and upload `dist/` to Netlify or Cloudflare Pages.
Details and limits: `docs/05-katora-p2p.md`.

## Add a new project
1. Make `projects/<name>/` with an `index.html` and a `project.json`:
   `{"title","tagline","emoji","tags":[],"auth":false,"static":true,"files":["index.html"]}`
2. It appears on the home page automatically. `"static": true` puts it on the free static site; leave it out if the project needs sign-in or the Node server.

## Tests
```bash
node projects/katora/game.test.js && node projects/katora/roomcore.test.js && node projects/katora/rooms.test.js && node projects/katora/sw.test.js
```

## Layout
- `site/index.html` — the Ninja Playground home page
- `projects/katora/` — the card game (`game.js` rules, `roomcore.js` room rules, `p2p.js` peer-to-peer, `server.js` HTTP rooms)
- `server.js`, `stats.js` — the Node gateway: serves projects, counts usage, sign-in
- `tools/` — builds the static site
- `docs/` — design notes, one per step
