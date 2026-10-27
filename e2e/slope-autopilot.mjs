// Plays the Slope remake from the outside by always steering into the lane the track generator guarantees is clear
// (logged per row in window.__slopeLog, which the test must create before the page loads). If this bot can reach top
// speed and cross ramp gaps, the generated track is beatable with the real physics, not just on paper.
export const startAutopilot = (page) =>
  page.evaluate(() => {
    const COLS = 5, TILE_W = 2.2, HALF = (COLS * TILE_W) / 2, ROW = 4;
    const s = window.__slope;
    window.__autopilot = setInterval(() => {
      if (s.mode !== 'play') { s.left = s.right = false; return; }
      const idx = Math.round(-s.z / ROW);
      const row = window.__slopeLog[idx];
      const lane = row ? row.lane : 2;
      const dx = (-HALF + TILE_W * (lane + 0.5)) - s.x;
      s.left = dx < -0.12; s.right = dx > 0.12;
    }, 8);
  });

export const stopAutopilot = (page) => page.evaluate(() => { clearInterval(window.__autopilot); window.__slope.left = window.__slope.right = false; });
