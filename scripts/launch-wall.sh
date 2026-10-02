#!/bin/bash
# Launch the Villain Wall in a dedicated kiosk Chrome on the projector display.
# Usage:  ./launch-wall.sh                 (grid layout, QR on center)
#         ./launch-wall.sh "?layout=row"   (any URL params)
# Find the projector display's origin/size first:  system_profiler SPDisplaysDataType
URL="https://villain-wall.vercel.app/${1:-}"
POS="${POS:-0,0}"          # e.g. POS=1512,0 if the projector sits to the right of the laptop screen
SIZE="${SIZE:-3840,2160}"  # projector display size in points (System Settings > Displays)
caffeinate -dimsu -w $$ &   # keep the Mac + display awake while this script runs
open -na "Google Chrome" --args \
  --user-data-dir="$HOME/.villain-wall-chrome" \
  --kiosk --start-fullscreen --no-first-run --no-default-browser-check \
  --autoplay-policy=no-user-gesture-required \
  --window-position="$POS" --window-size="$SIZE" \
  "$URL"
echo "Launched $URL at $POS size $SIZE. Press H in the window for controls, C to label screens."
wait
