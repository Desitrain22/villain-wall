// Edit and redeploy to change defaults. URL params override these.
window.VILLAIN_CONFIG = {
  video: "https://50vff2ln10u38mac.public.blob.vercel-storage.com/villain.mp4",   // direct .mp4 URL (hosted on Vercel Blob)
  layout: "grid",           // grid (2x2 quadrants) | row (1x3) | single
  order: "",                // e.g. "A,B,C,X" for grid, "A,B,C" for row. X = video only
  yt: "Il-QdvRYFrM",        // YouTube fallback: open /?yt=1 to use it instead of the mp4
  qr: "B",                  // which screen(s) show the QR code: A,B,C or all
  qrpos: "br",              // br | bl | tr | tl | c
  max: 24,                  // max bubbles per screen at once
  poll: 2500,               // ms between checks for new confessions
  rotate: 15000             // ms between swapping in older confessions when > max
};
