# Villain Wall

Party projector wall: a looping villain video on three screens, a QR code on the center one,
and guests' confessions flying across all three screens as bubbles. A, B and C are treated as one
continuous wall: bubbles drift from projector to projector and bounce off the far ends.

**Live:** https://villain-wall.vercel.app

| URL | What |
|---|---|
| `/` | The wall. Open this on the projector laptop. |
| `/submit` | The phone form guests reach from the QR code. |
| `/admin` | Delete a confession (needs the admin key). |

## 1. Put it on the projectors (venue laptop)

### Step 0 — 2-minute hardware check (do this before quitting Resolume)

1. **In Resolume:** menu **Output → Identify Displays** overlays a number on each output, and **Output → Show Test Card**
   shows the resolution. Note which physical projector is which. **Output → Advanced…** shows the Screens/Slices mapping.
2. **In macOS:** Apple menu → **System Settings → Displays**. Count the external display thumbnails.
   - **One external display at 3840 x 2160** → the single USB-C cable goes to a 4K video-wall splitter (Datapath Fx4,
     QuadHead2Go, generic 2x2 box) that cuts the picture into four 1080p quadrants, one per projector. **Use the default
     `grid` layout.** (This is what the Resolume screenshot suggests.)
   - **One external display at 5760 x 1080** → a 1x3 unit (TripleHead2Go-style). **Use `/?layout=row`.**
   - **Three separate 1920 x 1080 displays** → a dock. Open three Chrome windows:
     `/?layout=single&screen=A`, `…screen=B`, `…screen=C`, one fullscreen on each projector
     (turn on System Settings → Desktop & Dock → *Displays have separate Spaces* first).
   - Terminal equivalent: `system_profiler SPDisplaysDataType | grep -E 'Resolution:|UI Looks like:|Connection Type:'`
3. Disable sleep and the screen saver: System Settings → Lock Screen → *Start Screen Saver* **Never**, *Turn display off*
   **Never**; turn on **Do Not Disturb**. Or run `caffeinate -dims` in Terminal and leave it open.

### Option A — Chrome straight to the projector (simplest, recommended)

1. Quit Resolume Arena (or **Output → Disabled**) so it releases the display.
2. Open **Google Chrome** → `https://villain-wall.vercel.app` (Chrome Settings → Performance → turn **off** Memory Saver).
3. Drag the window onto the projector display and press **Ctrl+Cmd+F** (Chrome's fullscreen; it survives the
   automatic refresh on new deploys). The page's **F** key works too but is dropped by a reload. Move the mouse back to the laptop screen.
4. Press **C**. Each panel shows a giant **A / B / C / X**. Walk the room and note which projector shows which letter.
   - Default `grid`: A top-left, B top-right, C bottom-left, X bottom-right (video only, for the spare/offline output).
   - Letters on the wrong projectors? Reorder in the URL, e.g. `/?order=B,A,C,X` (left, center, right = A, B, C).
   - Projectors form one wide strip? Press **L** for the 1x3 `row` layout.
5. Press **C** again to hide the labels. Video + QR + bubbles are live.

Terminal shortcut: `scripts/launch-wall.sh` launches a kiosk Chrome and keeps the Mac awake.
Set `POS=x,y SIZE=w,h` to the projector display's origin and size, e.g. `POS=1512,0 SIZE=3840,2160 scripts/launch-wall.sh`.

### Option B — keep Resolume and feed it the browser

Arena 6 accepts **Syphon** sources with nothing to enable (Sources tab on the right → drag the server onto an empty clip
slot → click the clip → menu **Clip → Resize → Fill**). Your Advanced Output mapping stays exactly as it is.
Chrome cannot publish Syphon itself, so you need a bridge:

- **Syphoner** (fastest, CHF 15, macOS 14.6+): https://www.sigmasix.ch/apps/syphoner/ — pick the Chrome window, grant
  Screen Recording when asked, quit and relaunch it. The unpaid trial watermarks the output.
- **OBS Studio** (free): add a *Browser* source at 3840x2160 pointing at the wall URL (or a window capture of Chrome),
  then publish via the obs-syphon-server plugin (Apple Silicon) or as **NDI** via DistroAV + NDI Runtime; in Resolume
  the source appears under Sources → Syphon / NDI. Note: OBS's built-in browser often can't decode H.264, so use a
  window capture of Chrome rather than the Browser source if the video stays black.
- **NDI Tools → NDI Scan Converter** (free, no OBS): https://downloads.ndi.tv/Tools/NDIToolsInstaller.pkg — captures
  the Chrome window as NDI. Arena 6.0 added NDI input, but 6.1.5 receiving a current NDI 6 sender is unverified;
  prefer Syphon if you have the choice.

Keep the Chrome window a 16:9 normal window on the laptop screen, **never minimized** (macOS stops rendering minimized
windows and the feed freezes). Open the wall at `/?layout=grid` so its four quadrants line up with the composition's.

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
`&video=https://…mp4` `&yt=1` (YouTube fallback) `&stagger=1|0|<seconds>` (A/B/C offset in the loop) `&max=60` (bubbles on the wall at once) `&poll=2500` `&demo=1` `&debug=1`

## 3. Moderation

`https://villain-wall.vercel.app/admin` → paste the admin key (in Vercel env `ADMIN_KEY`) → Delete.
Deleted bubbles vanish from the wall within a few seconds.

## How it works

- Static HTML in `public/`, two Vercel functions in `api/` (`submit`, `list`), shared store in `lib/store.js`.
- Each confession is one small JSON blob in **Vercel Blob** (`s/<ts>-<id>.json`); listing is one `list()` call,
  contents are cached in the warm function. No database to provision.
- The wall polls `/api/list?since=<ts>` every 2.5s, adds new bubbles, removes deleted ones, shows the newest
  60 and rotates older ones back in every 15s. Each bubble has a clone in every panel, positioned on one
  virtual strip (3 x panel width), so it crosses the seam between projectors seamlessly.
- The video is a 56 MB muted H.264 MP4 on Vercel Blob (transcoded from the 397 MB original). The wall downloads
  it once into memory and starts the copies a third of the loop apart (A, B, C each show a different part;
  `?stagger=0` for in-sync), re-checking every 3s so the offsets never drift. After the first load it keeps looping even if the WiFi drops.
- The wall checks the deployment id on every poll and reloads itself ~15s after a new version is deployed, so you
  never have to touch the projector laptop. Use Chrome's own fullscreen (Ctrl+Cmd+F) rather than the page's F key,
  because a reload drops the F-key fullscreen and the page then waits for you to reload manually.

## Dev

```sh
npm install
vercel env pull .env.local   # BLOB_READ_WRITE_TOKEN, ADMIN_KEY
vercel dev
vercel deploy --prod
```
