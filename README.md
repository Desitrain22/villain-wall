# Villain Wall

Party projector wall: a looping villain video on three screens, a QR code on the center one,
and guests' confessions floating around as bubbles.

**Live:** https://villain-wall.vercel.app

| URL | What |
|---|---|
| `/` | The wall. Open this on the projector laptop. |
| `/submit` | The phone form guests reach from the QR code. |
| `/admin` | Delete a confession (needs the admin key). |

## 1. Put it on the projectors (venue laptop)

### Option A — Chrome straight to the projector (simplest)

1. Quit Resolume Arena (or just stop its output). The projector feed becomes a normal Mac display.
2. Open **Google Chrome** → `https://villain-wall.vercel.app`
3. Drag the window onto the projector display, press **F** (fullscreen).
4. Press **C**. Each panel shows a giant **A / B / C / X**. Note which physical projector shows which letter.
   - The default layout is a **2x2 grid** (A top-left, B top-right, C bottom-left, X bottom-right = video only).
     That matches a single 4K output split into four 1080p feeds, which is what the Resolume composition suggests.
   - If the projectors instead form one wide strip, press **L** to switch to the **1x3 row** layout.
   - If the letters land on the wrong projectors, reorder with a URL, e.g. `/?order=B,A,C,X`.
   - If each projector is its own display in macOS, open three Chrome windows: `/?layout=single&screen=A`, `…&screen=B`, `…&screen=C`, and fullscreen each on its projector.
5. Press **C** again to hide the labels. Video + QR + bubbles are now live. Keep the Mac awake: in Terminal run `caffeinate -dimsu`.

Or from Terminal: `scripts/launch-wall.sh` (kiosk Chrome, keeps the Mac awake; set `POS=x,y SIZE=w,h` to the projector display).

### Option B — keep Resolume and feed it the browser

Resolume Arena 6 on Mac accepts **Syphon** and **NDI** sources. Turn the Chrome window into one of those and
drop it in as a clip; your existing Advanced Output mapping to the projectors keeps working:

- **NDI:** install NDI Tools for Mac, run *NDI Scan Converter*, pick the Chrome window/display → in Resolume,
  Sources tab → NDI → drag the "Scan Converter" source into a clip slot → trigger it → scale to fit the composition.
- **Syphon:** run *Syphoner* (free), select the Chrome window → in Resolume, Sources → Syphon → drag the server into a clip slot.

Open the wall at `/?layout=grid` so the page's four quadrants line up with the composition's four 1080p quadrants,
and size the Chrome window as large as possible (16:9).

## 2. Controls on the wall page

| Key | Action |
|---|---|
| **F** | Fullscreen |
| **C** | Calibration labels (which projector is A/B/C) |
| **L** | Cycle layout grid → row → single |
| **Q** | QR on center only ↔ QR on every screen |
| **V** | Load a local video file instead of the hosted one (drag & drop also works; remembered on reload) |
| **X** | Forget the local video, back to hosted default |
| **D** | Drop a demo bubble |
| **H** | Help overlay with current settings |

URL params override `public/config.js`:
`?layout=grid|row|single` `&order=A,B,C,X` `&screen=B` `&qr=B|all` `&qrpos=br|bl|tr|tl|c`
`&video=https://…mp4` `&yt=1` (YouTube fallback) `&max=24` `&poll=2500` `&demo=1` `&debug=1`

## 3. Moderation

`https://villain-wall.vercel.app/admin` → paste the admin key (in Vercel env `ADMIN_KEY`) → Delete.
Deleted bubbles vanish from the wall within a few seconds.

## How it works

- Static HTML in `public/`, two Vercel functions in `api/` (`submit`, `list`), shared store in `lib/store.js`.
- Each confession is one small JSON blob in **Vercel Blob** (`s/<ts>-<id>.json`); listing is one `list()` call,
  contents are cached in the warm function. No database to provision.
- The wall polls `/api/list?since=<ts>` every 2.5s, adds new bubbles, removes deleted ones, shows the newest
  24 per screen and rotates older ones back in every 15s.
- The video is a 56 MB muted H.264 MP4 on Vercel Blob (transcoded from the 397 MB original). Four `<video>`
  copies play it and are re-synced every 3s so adjacent projectors match.

## Dev

```sh
npm install
vercel env pull .env.local   # BLOB_READ_WRITE_TOKEN, ADMIN_KEY
vercel dev
vercel deploy --prod
```
