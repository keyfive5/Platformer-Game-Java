/* ══════════════════════════════════════════════════════════════════════
   audio.js — every sound in the remaster is synthesised at runtime.

   The 2019 build looped a 6 MB rip of the Watch_Dogs police-chase theme
   (PrisonRevelations.java, line 51). That file belongs to Ubisoft, so it is
   not in this repository. What replaced it is a small WebAudio score written
   in the same spirit: a nervous minor-key pursuit loop that never resolves.

   Mix rules, learned the hard way:
     · music is OFF until you ask for it, and quiet when you do
     · nothing above ~5 kHz survives the bus filters — no ice-pick hats
     · the whole thing sits under a soft ceiling so a bomb can never spike

   No files, no dependencies, ~0 bytes over the wire.
   ══════════════════════════════════════════════════════════════════════ */
(function (PR) {
  'use strict';

  var ctx = null;
  var master = null, musicBus = null, sfxBus = null;
  var muted = false;
  var musicOn = false;          // opt-in, deliberately
  var started = false;

  // ── mix levels, all conservative ───────────────────────────────────
  var MASTER = 0.42;
  var SFX_LEVEL = 0.38;
  var MUSIC_BASE = 0.030;
  var MUSIC_RANGE = 0.035;

  // ── scheduler state ────────────────────────────────────────────────
  var BPM = 126;
  var SPB = 60 / BPM;
  var STEP = SPB / 4;
  var step = 0;
  var nextTime = 0;
  var timer = null;
  var intensity = 0;
  var targetIntensity = 0;

  // A minor: Am - F - C - G
  var ROOTS = [55.00, 43.65, 32.70, 49.00];
  var LEAD  = [440.00, 493.88, 523.25, 659.25];

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = MASTER;

    // a gentle ceiling so nothing ever stabs
    var squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -22;
    squash.knee.value = 26;
    squash.ratio.value = 4;
    squash.attack.value = 0.006;
    squash.release.value = 0.25;

    // no content above ~7 kHz reaches the speakers at all
    var tame = ctx.createBiquadFilter();
    tame.type = 'lowpass';
    tame.frequency.value = 7000;
    tame.Q.value = 0.0001;

    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    // the music sits even further back and darker than the effects
    var musicTone = ctx.createBiquadFilter();
    musicTone.type = 'lowpass';
    musicTone.frequency.value = 4200;
    musicTone.Q.value = 0.0001;

    sfxBus = ctx.createGain();
    sfxBus.gain.value = SFX_LEVEL;

    musicBus.connect(musicTone);
    musicTone.connect(master);
    sfxBus.connect(master);
    master.connect(squash);
    squash.connect(tame);
    tame.connect(ctx.destination);
    return ctx;
  }

  // ── tiny helpers ───────────────────────────────────────────────────
  function osc(type, freq, t) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    return o;
  }

  function env(t, a, d, peak, bus) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(bus || sfxBus);
    return g;
  }

  var noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    return s;
  }

  // ══ MUSIC ══════════════════════════════════════════════════════════
  function kick(t) {
    var o = osc('sine', 140, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.1);
    var g = env(t, 0.004, 0.2, 0.38, musicBus);
    o.connect(g); o.start(t); o.stop(t + 0.24);
  }

  function snare(t) {
    var n = noise();
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.5;
    var g = env(t, 0.004, 0.14, 0.075, musicBus);
    n.connect(bp); bp.connect(g); n.start(t); n.stop(t + 0.18);
  }

  function hat(t) {
    // deliberately dull and quiet — this was the part that hurt
    var n = noise();
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.8;
    var g = env(t, 0.002, 0.03, 0.016, musicBus);
    n.connect(bp); bp.connect(g); n.start(t); n.stop(t + 0.06);
  }

  function bass(t, freq, dur) {
    var o = osc('triangle', freq, t);
    var o2 = osc('sine', freq * 0.5, t);
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300 + intensity * 500, t);
    lp.frequency.exponentialRampToValueAtTime(150, t + dur);
    lp.Q.value = 1.6;
    var g = env(t, 0.01, dur, 0.20, musicBus);
    o.connect(lp); o2.connect(lp); lp.connect(g);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  function pad(t, root, dur) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.038, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(340, t);
    lp.frequency.linearRampToValueAtTime(900, t + dur * 0.6);
    lp.connect(g); g.connect(musicBus);
    [1, 1.5, 2.005].forEach(function (mult, i) {
      var o = osc('triangle', root * 4 * mult * (1 + (i - 1) * 0.0014), t);
      o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    });
  }

  function lead(t, freq) {
    var o = osc('triangle', freq, t);
    var g = env(t, 0.01, 0.12, 0.022 * intensity, musicBus);
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1800;
    o.connect(lp); lp.connect(g);
    o.start(t); o.stop(t + 0.18);
  }

  function schedule(s, t) {
    var bar = Math.floor(s / 16) % 4;
    var b = s % 16;
    var root = ROOTS[bar];

    if (b === 0) pad(t, root, SPB * 4);
    if (intensity < 0.5) return;          // menu: pad only

    if (b % 4 === 0) kick(t);
    if (b === 4 || b === 12) snare(t);
    if (b % 4 === 2) hat(t);              // 8ths, not 16ths

    var pattern = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    if (pattern[b]) {
      var mult = (b === 11) ? 2 : (b === 5 ? 1.5 : 1);
      bass(t, root * 2 * mult, STEP * 1.6);
    }
    if (intensity > 0.9 && (b === 6 || b === 14)) lead(t, LEAD[(bar + b) % 4]);
  }

  function tick() {
    if (!ctx) return;
    intensity += (targetIntensity - intensity) * 0.06;
    var want = (muted || !musicOn) ? 0 : (MUSIC_BASE + intensity * MUSIC_RANGE);
    musicBus.gain.setTargetAtTime(want, ctx.currentTime, 0.5);

    while (nextTime < ctx.currentTime + 0.12) {
      if (musicOn) schedule(step, nextTime);
      step++;
      nextTime += STEP;
    }
  }

  // ══ SFX ════════════════════════════════════════════════════════════
  var SFX = {
    jump: function (t) {
      var o = osc('triangle', 300, t);
      o.frequency.exponentialRampToValueAtTime(620, t + 0.08);
      var g = env(t, 0.005, 0.08, 0.085);
      o.connect(g); o.start(t); o.stop(t + 0.12);
    },
    land: function (t, power) {
      var n = noise();
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 520;
      var g = env(t, 0.003, 0.06 + power * 0.04, 0.03 + power * 0.07);
      n.connect(lp); lp.connect(g); n.start(t); n.stop(t + 0.16);
      var o = osc('sine', 88, t);
      o.frequency.exponentialRampToValueAtTime(50, t + 0.07);
      var og = env(t, 0.003, 0.08, 0.07 * (0.4 + power));
      o.connect(og); o.start(t); o.stop(t + 0.11);
    },
    bounce: function (t) {
      var o = osc('sine', 180, t);
      o.frequency.exponentialRampToValueAtTime(760, t + 0.18);
      var g = env(t, 0.006, 0.2, 0.11);
      o.connect(g); o.start(t); o.stop(t + 0.26);
    },
    boom: function (t) {
      var n = noise();
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, t);
      lp.frequency.exponentialRampToValueAtTime(160, t + 0.45);
      var g = env(t, 0.006, 0.5, 0.22);
      n.connect(lp); lp.connect(g); n.start(t); n.stop(t + 0.65);
      var o = osc('sine', 110, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.36);
      var og = env(t, 0.004, 0.4, 0.26);
      o.connect(og); o.start(t); o.stop(t + 0.55);
    },
    die: function (t) {
      [0, 0.08].forEach(function (d, i) {
        var o = osc('triangle', 380 - i * 130, t + d);
        o.frequency.exponentialRampToValueAtTime(80, t + d + 0.28);
        var g = env(t + d, 0.005, 0.26, 0.075);
        o.connect(g); o.start(t + d); o.stop(t + d + 0.32);
      });
    },
    splash: function (t) {
      var n = noise();
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(700, t);
      bp.frequency.exponentialRampToValueAtTime(1600, t + 0.28);
      bp.Q.value = 1.1;
      var g = env(t, 0.008, 0.35, 0.10);
      n.connect(bp); bp.connect(g); n.start(t); n.stop(t + 0.45);
    },
    door: function (t) {
      [392.0, 523.25, 659.25].forEach(function (f, i) {
        var o = osc('triangle', f, t + i * 0.08);
        var g = env(t + i * 0.08, 0.01, 0.28, 0.075);
        o.connect(g); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.34);
      });
    },
    win: function (t) {
      [261.63, 329.63, 392.0, 523.25, 659.25].forEach(function (f, i) {
        var d = i * 0.13;
        var o = osc('triangle', f, t + d);
        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1600;
        var g = env(t + d, 0.02, 0.85 - i * 0.05, 0.07);
        o.connect(lp); lp.connect(g); o.start(t + d); o.stop(t + d + 1);
      });
    },
    ui: function (t) {
      var o = osc('sine', 620, t);
      var g = env(t, 0.004, 0.05, 0.035);
      o.connect(g); o.start(t); o.stop(t + 0.07);
    },
    era: function (t) {
      var o = osc('triangle', 700, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.2);
      var g = env(t, 0.006, 0.22, 0.06);
      o.connect(g); o.start(t); o.stop(t + 0.28);
    }
  };

  // ══ public API ═════════════════════════════════════════════════════
  PR.audio = {
    /** Must be called from a user gesture — browsers require it. */
    start: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (started) return;
      started = true;
      nextTime = ctx.currentTime + 0.08;
      timer = setInterval(tick, 25);
    },
    setIntensity: function (v) { targetIntensity = v; },
    play: function (name, arg) {
      if (!ctx || muted || !SFX[name]) return;
      try { SFX[name](ctx.currentTime, arg || 0); } catch (e) { /* audio is never fatal */ }
    },
    mute: function (v) {
      muted = v;
      if (master) master.gain.setTargetAtTime(v ? 0 : MASTER, ctx.currentTime, 0.05);
    },
    isMuted: function () { return muted; },
    /** Music is opt-in and stays quiet. */
    setMusic: function (v) { musicOn = !!v; },
    isMusicOn: function () { return musicOn; }
  };
})(window.PR = window.PR || {});
