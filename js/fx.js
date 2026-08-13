/* ══════════════════════════════════════════════════════════════════════
   fx.js — particles, weather and the small deterministic noise helpers
   the tile decorator uses. Nothing here changes how the game plays; it
   only decides how it feels.
   ══════════════════════════════════════════════════════════════════════ */
(function (PR) {
  'use strict';

  /** Deterministic hash -> [0,1). Same tile always gets the same crack. */
  function hash(x, y, seed) {
    var h = (x * 374761393 + y * 668265263 + (seed || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // ══ particles ══════════════════════════════════════════════════════
  // One flat pool, no allocation during play.
  var MAX = 900;

  function Particles() {
    this.p = new Array(MAX);
    for (var i = 0; i < MAX; i++) {
      this.p[i] = { on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, g: 0, drag: 1, r: 0, g0: 0, b: 0, a: 1, glow: false, kind: 0, spin: 0, rot: 0 };
    }
    this.head = 0;
  }

  Particles.prototype.spawn = function (o) {
    var q = null;
    // find a free slot, walking forward from the last one used
    for (var i = 0; i < MAX; i++) {
      var idx = (this.head + i) % MAX;
      if (!this.p[idx].on) { q = this.p[idx]; this.head = (idx + 1) % MAX; break; }
    }
    if (!q) return;
    q.on = true;
    q.x = o.x; q.y = o.y;
    q.vx = o.vx || 0; q.vy = o.vy || 0;
    q.max = q.life = o.life || 0.5;
    q.size = o.size || 1;
    q.g = o.g === undefined ? -180 : o.g;
    q.drag = o.drag === undefined ? 0.86 : o.drag;
    q.col = o.col || '#ffffff';
    q.col2 = o.col2 || null;
    q.glow = !!o.glow;
    q.kind = o.kind || 0;         // 0 square, 1 streak, 2 ring, 3 spark
    q.spin = o.spin || 0;
    q.rot = o.rot || 0;
    q.a = o.a === undefined ? 1 : o.a;
  };

  Particles.prototype.update = function (dt) {
    for (var i = 0; i < MAX; i++) {
      var q = this.p[i];
      if (!q.on) continue;
      q.life -= dt;
      if (q.life <= 0) { q.on = false; continue; }
      q.vy += q.g * dt;
      var d = Math.pow(q.drag, dt * 60);
      q.vx *= d; q.vy *= d;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.spin * dt;
    }
  };

  /** Draw into a camera-translated context (world space, y up). */
  Particles.prototype.draw = function (c, camX, camY, w, h) {
    for (var i = 0; i < MAX; i++) {
      var q = this.p[i];
      if (!q.on) continue;
      var sx = q.x - camX, sy = camY - q.y;          // world -> screen (flip y)
      if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;

      var t = q.life / q.max;
      c.globalAlpha = clamp(t * q.a, 0, 1);
      c.fillStyle = q.col2 ? (t > 0.55 ? q.col : q.col2) : q.col;

      if (q.kind === 2) {                              // shockwave ring
        var rad = (1 - t) * q.size;
        c.globalAlpha = clamp(t * t * q.a, 0, 1);
        c.strokeStyle = c.fillStyle;
        c.lineWidth = Math.max(0.6, t * 2);
        c.beginPath(); c.arc(sx, sy, rad, 0, 6.2832); c.stroke();
      } else if (q.kind === 1) {                       // motion streak
        var len = clamp(Math.hypot(q.vx, q.vy) * 0.045, 1, 7);
        c.fillRect(sx, sy, Math.max(0.7, q.size * 0.5), len);
      } else if (q.kind === 3) {                       // spark, fades to size 0
        var s = Math.max(0.6, q.size * t);
        c.fillRect(sx - s / 2, sy - s / 2, s, s);
      } else {
        var sz = q.size;
        c.fillRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), sz, sz);
      }
    }
    c.globalAlpha = 1;
  };

  /** Emissive pass — only the glowy particles, for the bloom buffer. */
  Particles.prototype.drawGlow = function (c, camX, camY, w, h) {
    for (var i = 0; i < MAX; i++) {
      var q = this.p[i];
      if (!q.on || !q.glow) continue;
      var sx = q.x - camX, sy = camY - q.y;
      if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
      var t = q.life / q.max;
      c.globalAlpha = clamp(t * 0.9, 0, 1);
      c.fillStyle = q.col;
      var s = Math.max(1, q.size * (q.kind === 2 ? 1 : t) * 1.6);
      c.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
    c.globalAlpha = 1;
  };

  Particles.prototype.clear = function () {
    for (var i = 0; i < MAX; i++) this.p[i].on = false;
  };

  // ══ named bursts ═══════════════════════════════════════════════════
  // x, y are world coordinates with y pointing up, like the Java game.
  var Burst = {
    dust: function (P, x, y, power) {
      var n = 4 + Math.round(power * 8);
      for (var i = 0; i < n; i++) {
        P.spawn({
          x: x + (Math.random() - 0.5) * 9, y: y + Math.random() * 1.5,
          vx: (Math.random() - 0.5) * (24 + power * 42),
          vy: Math.random() * (10 + power * 26),
          life: 0.26 + Math.random() * 0.34,
          size: Math.random() < 0.3 ? 2 : 1,
          g: -40, drag: 0.82,
          col: 'rgba(206,198,180,.85)', col2: 'rgba(140,133,120,.5)'
        });
      }
    },

    jump: function (P, x, y) {
      for (var i = 0; i < 7; i++) {
        var a = Math.PI + (Math.random() - 0.5) * 1.5;
        P.spawn({
          x: x + (Math.random() - 0.5) * 7, y: y,
          vx: Math.cos(a) * 30 * (Math.random() - 0.5) * 2,
          vy: Math.sin(a) * 26 * Math.random(),
          life: 0.22 + Math.random() * 0.2, size: 1,
          g: -30, drag: 0.86, col: 'rgba(220,214,198,.6)'
        });
      }
    },

    bounce: function (P, x, y) {
      P.spawn({ x: x, y: y + 2, vx: 0, vy: 0, life: 0.45, size: 26, g: 0, drag: 1, kind: 2, col: '#7dff9b', glow: true });
      for (var i = 0; i < 16; i++) {
        var a = Math.random() * Math.PI;
        P.spawn({
          x: x + (Math.random() - 0.5) * 12, y: y,
          vx: Math.cos(a) * (30 + Math.random() * 70),
          vy: Math.sin(a) * (40 + Math.random() * 90),
          life: 0.3 + Math.random() * 0.4, size: Math.random() < 0.4 ? 2 : 1,
          g: -160, drag: 0.9, glow: true,
          col: '#9dff8a', col2: '#3f9c4a', kind: 3
        });
      }
    },

    boom: function (P, x, y) {
      P.spawn({ x: x, y: y, life: 0.5, size: 54, g: 0, drag: 1, kind: 2, col: '#ffd27a', glow: true });
      P.spawn({ x: x, y: y, life: 0.75, size: 78, g: 0, drag: 1, kind: 2, col: '#ff7a45', glow: true, a: 0.6 });
      var i;
      for (i = 0; i < 30; i++) {          // fire
        var a = Math.random() * 6.2832, s = 40 + Math.random() * 150;
        P.spawn({
          x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.28 + Math.random() * 0.5, size: 1 + Math.round(Math.random() * 2),
          g: -120, drag: 0.87, glow: true, kind: 3,
          col: Math.random() < 0.5 ? '#fff0b8' : '#ff9a3c', col2: '#c0361a'
        });
      }
      for (i = 0; i < 22; i++) {          // rubble
        var a2 = Math.random() * 6.2832, s2 = 30 + Math.random() * 120;
        P.spawn({
          x: x, y: y, vx: Math.cos(a2) * s2, vy: Math.abs(Math.sin(a2)) * s2 * 1.1,
          life: 0.6 + Math.random() * 0.7, size: Math.random() < 0.35 ? 2 : 1,
          g: -280, drag: 0.98,
          col: '#8a8377', col2: '#4a4740', spin: (Math.random() - 0.5) * 12
        });
      }
      for (i = 0; i < 14; i++) {          // smoke
        P.spawn({
          x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 26, vy: 12 + Math.random() * 26,
          life: 0.8 + Math.random() * 0.9, size: 2 + Math.round(Math.random() * 2),
          g: 12, drag: 0.94, a: 0.5,
          col: 'rgba(90,86,80,.7)', col2: 'rgba(50,48,46,.35)'
        });
      }
    },

    splash: function (P, x, y) {
      P.spawn({ x: x, y: y, life: 0.4, size: 30, g: 0, drag: 1, kind: 2, col: '#8fd4ff', glow: true });
      for (var i = 0; i < 26; i++) {
        var a = Math.PI * (0.15 + Math.random() * 0.7);
        var s = 40 + Math.random() * 120;
        P.spawn({
          x: x + (Math.random() - 0.5) * 8, y: y,
          vx: Math.cos(a) * s * (Math.random() < 0.5 ? -1 : 1),
          vy: Math.sin(a) * s,
          life: 0.35 + Math.random() * 0.5, size: Math.random() < 0.3 ? 2 : 1,
          g: -260, drag: 0.97, kind: 1, glow: Math.random() < 0.4,
          col: '#bfe6ff', col2: '#3f86c9'
        });
      }
    },

    death: function (P, x, y, tint) {
      P.spawn({ x: x, y: y, life: 0.5, size: 44, g: 0, drag: 1, kind: 2, col: tint || '#ff6a4d', glow: true });
      for (var i = 0; i < 34; i++) {
        var a = Math.random() * 6.2832, s = 30 + Math.random() * 170;
        P.spawn({
          x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.35 + Math.random() * 0.6, size: Math.random() < 0.3 ? 2 : 1,
          g: -240, drag: 0.93, glow: true, kind: 3,
          col: tint || '#ff9a7a', col2: '#7a2417'
        });
      }
    },

    doorGlow: function (P, x, y) {
      P.spawn({
        x: x + (Math.random() - 0.5) * 12, y: y - 6 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 6, vy: 8 + Math.random() * 14,
        life: 0.9 + Math.random() * 0.7, size: 1, g: 4, drag: 0.99,
        glow: true, kind: 3, col: '#ffdf9b', col2: '#e2a13c'
      });
    },

    trail: function (P, x, y, vx) {
      P.spawn({
        x: x, y: y, vx: -vx * 0.12, vy: 4 + Math.random() * 8,
        life: 0.2 + Math.random() * 0.15, size: 1, g: -10, drag: 0.9,
        col: 'rgba(255,240,210,.35)'
      });
    },

    win: function (P, x, y) {
      for (var i = 0; i < 90; i++) {
        var a = Math.random() * 6.2832, s = 40 + Math.random() * 200;
        P.spawn({
          x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.9 + Math.random() * 1.3, size: 1 + Math.round(Math.random() * 2),
          g: -180, drag: 0.96, glow: true, kind: 3,
          col: ['#ffd47a', '#fff3cf', '#7dff9b', '#8fd4ff'][i & 3]
        });
      }
    }
  };

  // ══ rain ═══════════════════════════════════════════════════════════
  // Drawn behind the tiles, so it only shows through open sky.
  function Rain(count) {
    this.d = [];
    for (var i = 0; i < count; i++) {
      this.d.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 0.9, len: 3 + Math.random() * 7 });
    }
  }
  Rain.prototype.draw = function (c, w, h, t, camX, camY, wind, count) {
    var n = Math.min(count === undefined ? this.d.length : count, this.d.length);
    c.save();
    c.strokeStyle = 'rgba(150,185,225,.30)';
    c.lineWidth = 1;
    c.beginPath();
    for (var i = 0; i < n; i++) {
      var r = this.d[i];
      // parallax with the camera so the rain belongs to the world
      var x = ((r.x * w + camX * 0.35 * r.s + t * wind * 40 * r.s) % (w + 20) + w + 20) % (w + 20) - 10;
      var y = ((r.y * h + camY * 0.35 * r.s + t * (150 + r.s * 260)) % (h + 20) + h + 20) % (h + 20) - 10;
      c.moveTo(x, y);
      c.lineTo(x - wind * r.len * 0.4, y + r.len);
    }
    c.stroke();
    c.restore();
  };

  PR.fx = { Particles: Particles, Burst: Burst, Rain: Rain, hash: hash, lerp: lerp, clamp: clamp };
})(window.PR = window.PR || {});
