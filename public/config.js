// Edit and redeploy to change defaults. URL params override these.
window.VILLAIN_CONFIG = {
  video: "/villain.mp4",    // served by the site itself (56 MB, deployed with the app)
  layout: "grid",           // grid (2x2 quadrants) | row (1x3) | single
  order: "",                // e.g. "A,B,C,X" for grid, "A,B,C" for row. X = video only
  yt: "Il-QdvRYFrM",        // YouTube fallback: open /?yt=1 to use it instead of the mp4
  qr: "B",                  // which screen(s) show the QR code: A,B,C or all
  qrpos: "br",              // br | bl | tr | tl | c
  stagger: 1,               // 1 = A/B/C each start a third of the loop apart, 0 = all in sync, or seconds between screens
  max: 21,                  // bubbles flying at once (7 per screen); the rest rotate in
  poll: 2500,               // ms between checks for new confessions
  rotate: 5000              // ms between swapping in older confessions when > max
};
