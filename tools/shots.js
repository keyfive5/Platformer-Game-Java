/**
 * shots.js — pasted into the dev page to grab canvas frames while the browser
 * pane is not compositing (requestAnimationFrame is paused when hidden, so the
 * game loop is pumped by hand here). Development only.
 */
window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));

window.__shot = async (name, crop, zoom) => {
  const cv = document.getElementById('screen');
  let src = cv;
  if (crop) {
    const [x, y, w, h] = crop;
    const z = zoom || 3;
    const t = document.createElement('canvas');
    t.width = w * z; t.height = h * z;
    const c = t.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(cv, x, y, w, h, 0, 0, w * z, h * z);
    src = t;
  }
  const data = src.toDataURL('image/png');
  const r = await fetch('/__shot', { method: 'POST', body: JSON.stringify({ name, data }) });
  return await r.text();
};

/** Advance the game by n frames of dt milliseconds. */
window.__pump = (frames, dtms) => {
  const g = window.PR.game;
  dtms = dtms || 16.6667;
  let t = g.__t || performance.now();
  for (let i = 0; i < frames; i++) { t += dtms; g.frame(t); }
  g.__t = t;
  const p = g.player;
  return {
    x: +p.x.toFixed(1), y: +p.y.toFixed(1), vy: +p.vy.toFixed(1),
    grounded: p.grounded, lvl: g.levelIndex, deaths: g.deaths,
    time: +g.time.toFixed(2), running: g.running
  };
};

/** Hold keys while pumping, e.g. __hold(['ArrowRight'], 60). */
window.__hold = (codes, frames, dtms) => {
  const g = window.PR.game;
  codes.forEach((c) => { g.keys[c] = true; });
  if (codes.some((c) => c === 'ArrowUp' || c === 'KeyW' || c === 'Space')) g.jumpEdge = true;
  const r = window.__pump(frames, dtms);
  codes.forEach((c) => { g.keys[c] = false; });
  return r;
};

/** Drop Porter at a world position so a specific room can be photographed. */
window.__teleport = (x, y) => {
  const g = window.PR.game;
  g.player.x = x; g.player.y = y; g.player.vy = 0;
  g.camX = x - g.vw / 2; g.camY = y + g.vh / 2;
  return window.__pump(4);
};
