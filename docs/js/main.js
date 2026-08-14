/* ══════════════════════════════════════════════════════════════════════
   main.js — asset loading, screens, persistence and input plumbing.
   ══════════════════════════════════════════════════════════════════════ */
(function (PR) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORE = 'prisonRevelations2';

  var assets = {};
  var game = null;
  var screenName = 'boot';
  var bannerTimer = null, toastTimer = null;

  // ── persistence ────────────────────────────────────────────────────
  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORE)) || {};
    } catch (e) { return {}; }
  }
  function save(d) {
    try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) { /* private mode */ }
  }
  var stats = load();
  stats.runs = stats.runs || 0;
  stats.deaths = stats.deaths || 0;
  stats.levelBest = stats.levelBest || {};

  // Builds before v2 painted every overlay on load (the [hidden] CSS bug), which
  // left the pause menu's checkboxes invisible but clickable — a stray click
  // could silently turn on the 2019 render or the music and persist it. Any
  // preference written by those builds is untrustworthy, so reset the toggles
  // and keep only the things worth keeping.
  if (stats.v !== 2) {
    delete stats.era;
    stats.sfx = true;
    stats.music = false;
    stats.v = 2;
    save(stats);
  }
  // sound effects on, music off, unless the player has said otherwise
  if (stats.sfx === undefined) stats.sfx = true;
  if (stats.music === undefined) stats.music = false;

  function fmt(s) {
    if (s === undefined || s === null || !isFinite(s)) return '—';
    if (s < 0) s = 0;
    var m = Math.floor(s / 60);
    var r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2);
  }

  // ── screens ────────────────────────────────────────────────────────
  function show(name) {
    screenName = name;
    var all = document.querySelectorAll('[data-screen]');
    for (var i = 0; i < all.length; i++) {
      all[i].hidden = all[i].getAttribute('data-screen') !== name;
    }
    if (name === 'title') {
      $('stat-best').textContent = fmt(stats.best);
      $('stat-runs').textContent = stats.runs;
      $('stat-deaths').textContent = stats.deaths;
      PR.audio.setIntensity(0);
    }
    if (name === 'game') PR.audio.setIntensity(1);
    if (name === 'levels') buildLevelList();
  }

  function buildLevelList() {
    var ul = $('level-list');
    ul.innerHTML = '';
    PR.LEVELS.forEach(function (L, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.innerHTML =
        '<span class="n">0' + (i + 1) + '</span>' +
        '<span class="t">' + L.name + '<span class="s">' + L.subtitle + '</span></span>' +
        '<span class="best">' + (stats.levelBest[i] ? fmt(stats.levelBest[i]) : '—') + '</span>';
      b.addEventListener('click', function () { PR.audio.play('ui'); startGame(i); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = true;
    void t.offsetWidth;      // restart the animation
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 1800);
  }

  function banner(i, def) {
    var b = $('banner');
    $('banner-n').textContent = 'Level 0' + (i + 1);
    $('banner-t').textContent = def.name;
    $('banner-s').textContent = def.subtitle;
    b.hidden = true;
    void b.offsetWidth;
    b.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { b.hidden = true; }, 2400);
  }

  // ── canvas fitting: integer scale, pixels stay square ──────────────
  function fit() {
    if (!game) return;
    var stage = $('stage');
    var cv = $('screen');

    // Collapse the canvas before measuring. It is a grid item inside a flex
    // item, so leaving it at its old size lets the previous frame's dimensions
    // hold the stage open — and each call would then measure its own output
    // and grow again.
    cv.style.width = '0px';
    cv.style.height = '0px';

    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;

    var scale = Math.max(2, Math.min(6, Math.round(h / 190)));
    var vw = Math.min(560, Math.floor(w / scale));
    var vh = Math.min(320, Math.floor(h / scale));
    vw -= vw % 2; vh -= vh % 2;
    if (vw < 80 || vh < 60) { scale = 1; vw = Math.min(560, w); vh = Math.min(320, h); }

    game.resize(vw, vh);
    cv.style.width = (vw * scale) + 'px';
    cv.style.height = (vh * scale) + 'px';
  }

  // ── game lifecycle ─────────────────────────────────────────────────
  function startGame(levelIndex) {
    show('game');
    PR.audio.start();
    stats.runs++;
    save(stats);
    $('win').hidden = true;
    $('pause').hidden = true;
    // The remaster is always what you get on a fresh run. The 2019 render is a
    // thing you reach for with T, not a setting that follows you around.
    game.era = false;
    $('era-badge').hidden = true;
    $('opt-era').checked = false;
    fit();
    game.start(levelIndex || 0);
  }

  function quit() {
    if (game) { game.running = false; game.paused = false; }
    $('pause').hidden = true;
    $('win').hidden = true;
    show('title');
  }

  function setPaused(v) {
    if (!game || !game.running) return;
    game.paused = v;
    $('pause').hidden = !v;
    PR.audio.setIntensity(v ? 0 : 1);
  }

  function toggleEra() {
    if (!game) return;
    game.era = !game.era;
    $('era-badge').hidden = !game.era;
    $('opt-era').checked = game.era;
    PR.audio.play('era');
    toast(game.era ? 'original 2019 build' : 'remastered build');
  }

  // ── input ──────────────────────────────────────────────────────────
  var JUMP_KEYS = { ArrowUp: 1, KeyW: 1, Space: 1 };
  var BLOCK = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1 };

  window.addEventListener('keydown', function (e) {
    if (BLOCK[e.code]) e.preventDefault();
    if (!game) return;

    if (!e.repeat) {
      if (JUMP_KEYS[e.code]) game.jumpEdge = true;
      PR.audio.start();
    }
    game.keys[e.code] = true;

    if (e.repeat) return;

    if (screenName === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      startGame(0);
      return;
    }
    if (screenName !== 'game') {
      if (e.code === 'Escape') show('title');
      return;
    }

    switch (e.code) {
      case 'KeyT': toggleEra(); break;
      case 'KeyR':
        if (game.running) { game.deaths++; game.respawn(false); toast('level restarted'); }
        break;
      case 'KeyP':
      case 'Escape':
        if (!$('win').hidden) break;
        setPaused(!game.paused);
        break;
      case 'KeyM':
        PR.audio.mute(!PR.audio.isMuted());
        $('opt-audio').checked = !PR.audio.isMuted();
        toast(PR.audio.isMuted() ? 'muted' : 'sound on');
        break;
      case 'KeyF': toggleFullscreen(); break;
    }
  });

  window.addEventListener('keyup', function (e) {
    if (game) game.keys[e.code] = false;
  });

  window.addEventListener('blur', function () {
    if (game) { game.keys = {}; game.touch = { left: false, right: false, jump: false }; }
  });

  function toggleFullscreen() {
    var el = document.documentElement;
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    }
  }

  // touch
  function wireTouch() {
    var btns = document.querySelectorAll('[data-touch]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        var key = btn.getAttribute('data-touch');
        var down = function (e) {
          e.preventDefault();
          PR.audio.start();
          if (!game) return;
          game.touch[key] = true;
          if (key === 'jump') game.jumpEdge = true;
        };
        var up = function (e) {
          e.preventDefault();
          if (game) game.touch[key] = false;
        };
        btn.addEventListener('touchstart', down, { passive: false });
        btn.addEventListener('touchend', up, { passive: false });
        btn.addEventListener('touchcancel', up, { passive: false });
        btn.addEventListener('mousedown', down);
        btn.addEventListener('mouseup', up);
        btn.addEventListener('mouseleave', up);
      })(btns[i]);
    }
    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    $('touch').hidden = !isTouch;
  }

  // gamepad, polled from the render loop
  function pollPad() {
    if (!game || !navigator.getGamepads) return;
    var pads = navigator.getGamepads();
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i];
      if (!p) continue;
      var ax = p.axes[0] || 0;
      var left = ax < -0.35 || (p.buttons[14] && p.buttons[14].pressed);
      var right = ax > 0.35 || (p.buttons[15] && p.buttons[15].pressed);
      var jump = (p.buttons[0] && p.buttons[0].pressed) || (p.buttons[12] && p.buttons[12].pressed);
      game.touch.left = left;
      game.touch.right = right;
      if (jump && !game._padJump) game.jumpEdge = true;
      game._padJump = jump;
      game.touch.jump = jump;
      return;
    }
  }

  // ── buttons ────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el) return;
    var a = el.getAttribute('data-action');
    PR.audio.start();
    if (a !== 'play' && a !== 'again') PR.audio.play('ui');

    switch (a) {
      case 'play':    startGame(0); break;
      case 'again':   startGame(0); break;
      case 'levels':  show('levels'); break;
      case 'how':     show('how'); break;
      case 'back':    show('title'); break;
      case 'resume':  setPaused(false); break;
      case 'restart':
        setPaused(false);
        game.deaths++;
        game.respawn(false);
        break;
      case 'quit':    quit(); break;
    }
  });

  $('opt-era').addEventListener('change', function () {
    if (game && game.era !== this.checked) toggleEra();
  });
  $('opt-crt').addEventListener('change', function () {
    if (game) game.crt = this.checked;
  });
  $('opt-audio').addEventListener('change', function () {
    PR.audio.mute(!this.checked);
    stats.sfx = this.checked;
    save(stats);
  });
  $('opt-music').addEventListener('change', function () {
    PR.audio.setMusic(this.checked);
    stats.music = this.checked;
    save(stats);
    toast(this.checked ? 'music on' : 'music off');
  });

  window.addEventListener('resize', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);

  // ── boot ───────────────────────────────────────────────────────────
  function img(src) {
    return new Promise(function (res, rej) {
      var i = new Image();
      i.onload = function () { res(i); };
      i.onerror = function () { rej(new Error('could not load ' + src)); };
      i.src = src;
    });
  }

  Promise.all([img('assets/newTileSet.png'), img('assets/porter.png')])
    .then(function (r) {
      assets.tileset = r[0];
      assets.porter = r[1];

      game = new PR.Game($('screen'), assets, {
        onLevel: function (i, def) {
          $('hud-level').textContent = (i + 1) + ' / ' + PR.LEVELS.length;
          $('hud-name').textContent = def.name;
          banner(i, def);
          game._levelStart = game.time;
        },
        onDeath: function () {
          stats.deaths++;
          save(stats);
        },
        onTick: function (time, deaths) {
          $('hud-time').textContent = fmt(time);
          $('hud-deaths').textContent = deaths;
          pollPad();
        },
        onWin: function (time, deaths) {
          var best = stats.best;
          if (best === undefined || time < best) { stats.best = time; best = time; }
          save(stats);
          $('win-time').textContent = fmt(time);
          $('win-deaths').textContent = deaths;
          $('win-best').textContent = fmt(best);
          $('win').hidden = false;
          PR.audio.setIntensity(0);
        }
      });

      // per-level bests: recorded as you pass each door
      var origEnter = game.enterLevel;
      game.enterLevel = function (i) {
        if (this._levelStart !== undefined && this.levelIndex < i) {
          var seg = this.time - this._levelStart;
          var prev = stats.levelBest[this.levelIndex];
          if (prev === undefined || seg < prev) stats.levelBest[this.levelIndex] = seg;
          save(stats);
        }
        origEnter.call(this, i);
      };
      var origWin = game.hooks.onWin;
      game.hooks.onWin = function (time, deaths) {
        if (game._levelStart !== undefined) {
          var seg = time - game._levelStart;
          var prev = stats.levelBest[game.levelIndex];
          if (prev === undefined || seg < prev) stats.levelBest[game.levelIndex] = seg;
        }
        origWin(time, deaths);
      };

      PR.game = game;          // handy from the console
      PR.audio.mute(!stats.sfx);
      PR.audio.setMusic(stats.music);
      $('opt-audio').checked = stats.sfx;
      $('opt-music').checked = stats.music;
      wireTouch();
      document.body.classList.remove('is-booting');
      setTimeout(function () { show('title'); }, 350);
    })
    .catch(function (err) {
      document.querySelector('.boot__label').textContent = err.message;
      console.error(err);
    });
})(window.PR = window.PR || {});
