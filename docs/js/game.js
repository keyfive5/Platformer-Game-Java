/* ══════════════════════════════════════════════════════════════════════
   game.js — Prison Revelations 2.0

   The physics in here is not "inspired by" the 2019 Java. It is the same
   numbers, in the same order, taken out of:

     Entity.java   update(delta, g)     gravity, collision, hazards, doors
     Porter.java   update / moveX       jump impulse, hold-boost, run speed
     GMap.java     doesRectCollideWith* the tile-rect sweep
     TileType.java the id table

   gravity  = -9.8 * weight(20)  = -196 px/s²
   run      = 80 px/s
   jump     = 5 * 20 = +100 px/s, +100 px/s² more while held and rising
   slime    = velocityY hard-set to 200
   Porter   = a 9 x 7 pixel rectangle

   Everything else — light, weather, particles, camera easing — is paint on
   top and is switched off entirely by the 2019 build toggle.
   ══════════════════════════════════════════════════════════════════════ */
(function (PR) {
  'use strict';

  var TILE = PR.TILE;
  var fx = PR.fx;

  // ── TileType.java, verbatim ────────────────────────────────────────
  var T = {
    GRASS: 1, SLIME: 2, SKY: 3, WATER: 4, CLOUD: 5, STONE: 6,
    WALL: 7, BOMB: 8, SPIKES: 9, WINDOW: 10, DOORD: 11, DOOR: 31
  };
  var COLLIDABLE = {};
  COLLIDABLE[T.GRASS] = COLLIDABLE[T.SLIME] = COLLIDABLE[T.CLOUD] =
    COLLIDABLE[T.STONE] = COLLIDABLE[T.BOMB] = COLLIDABLE[T.SPIKES] = true;

  // ── Porter's numbers ───────────────────────────────────────────────
  var GRAVITY = -9.8, WEIGHT = 20, SPEED = 80, JUMP_VELOCITY = 5;
  var SLIME_LAUNCH = 200, PW = 9, PH = 7;
  var MAIN_LAYER = 1;               // TiledGMap: getLayers().get(1)

  // ── per-level mood (remaster only) ─────────────────────────────────
  var MOOD = [
    { ambient: [124, 130, 152], rain: 150, wind: 1.1, sky: ['#0a1024', '#16233f', '#2b3c5e'] },
    { ambient: [128, 120, 138], rain: 70,  wind: 0.5, sky: ['#0b0a18', '#181530', '#2e2748'] },
    { ambient: [138, 126, 130], rain: 40,  wind: 0.3, sky: ['#12101e', '#2a1f33', '#5c3a45'] }
  ];

  /* ════════════════════════════════════════════════════════════════════
     LEVEL — map data, collision queries, and the pre-rendered art
     ════════════════════════════════════════════════════════════════════ */
  function Level(def, tileset) {
    this.def = def;
    this.tileset = tileset;
    this.w = def.width;
    this.h = def.height;
    this.pxW = this.w * TILE;
    this.pxH = this.h * TILE;
    this.layers = def.gids.length;

    // flatten to typed arrays; index = row * w + col, row 0 = floor
    this.g = [];
    this.d = [];
    for (var l = 0; l < this.layers; l++) {
      var ga = new Int16Array(this.w * this.h);
      var da = new Int16Array(this.w * this.h);
      for (var r = 0; r < this.h; r++) {
        for (var c = 0; c < this.w; c++) {
          ga[r * this.w + c] = def.gids[l][r][c];
          da[r * this.w + c] = def.draw[l][r][c];
        }
      }
      this.g.push(ga);
      this.d.push(da);
    }

    this.collectFeatures();
    this.prerender();
  }

  Level.prototype.at = function (layer, col, row) {
    if (col < 0 || row < 0 || col >= this.w || row >= this.h) return 0;
    return this.g[layer][row * this.w + col];
  };

  /** Topmost non-empty tile — what you actually see in that cell. */
  Level.prototype.visible = function (col, row) {
    for (var l = this.layers - 1; l >= 0; l--) {
      var v = this.at(l, col, row);
      if (v) return v;
    }
    return 0;
  };

  Level.prototype.solidAt = function (col, row) {
    for (var l = 0; l < this.layers; l++) {
      if (COLLIDABLE[this.at(l, col, row)]) return true;
    }
    return false;
  };

  /** Lights, hazards and doors, gathered once so the renderer never scans. */
  Level.prototype.collectFeatures = function () {
    this.doors = []; this.bombs = []; this.slimes = [];
    this.windows = []; this.waterTops = []; this.torches = [];
    for (var r = 0; r < this.h; r++) {
      for (var c = 0; c < this.w; c++) {
        var v = this.visible(c, r);
        var p = { c: c, r: r, x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
        if (v === T.DOOR || v === T.DOORD) this.doors.push(p);
        else if (v === T.BOMB) this.bombs.push(p);
        else if (v === T.SLIME) this.slimes.push(p);
        else if (v === T.WINDOW) this.windows.push(p);
        else if (v === T.WATER && this.visible(c, r + 1) !== T.WATER) this.waterTops.push(p);
        else if (v === T.WALL && c % 3 === 0 &&
                 this.visible(c, r + 1) === T.WALL && this.visible(c, r - 1) === T.WALL &&
                 fx.hash(c, r, 11) > 0.965) {
          // Remaster-only set dressing: a sconce bolted to the brickwork.
          // Purely light — it has no collision and never touches the map data.
          p.seed = fx.hash(c, r, 12) * 6.28;
          this.torches.push(p);
        }
      }
    }
  };

  // ── GMap.java collision, kept rect-for-rect ────────────────────────
  Level.prototype.rectCollidesMap = function (x, y, w, h) {
    if (x < 0 || y < 0 || x + w > this.pxW || y + h > this.pxH) return true;
    for (var row = (y / TILE) | 0; row < Math.ceil((y + h) / TILE); row++) {
      for (var col = (x / TILE) | 0; col < Math.ceil((x + w) / TILE); col++) {
        if (this.solidAt(col, row)) return true;
      }
    }
    return false;
  };

  /** doesRectCollideWithSpikes / Water / Slime / Bomb / Door, generalised. */
  Level.prototype.rectHits = function (x, y, w, h, test) {
    for (var row = (y / TILE) | 0; row < Math.ceil((y + h) / TILE); row++) {
      for (var col = (x / TILE) | 0; col < Math.ceil((x + w) / TILE); col++) {
        for (var l = 0; l < this.layers; l++) {
          var g = this.at(l, col, row);
          if (g && test(g)) return { c: col, r: row };
        }
      }
    }
    return null;
  };

  var isSpike = function (g) { return g === T.SPIKES; };
  var isWater = function (g) { return g === T.WATER; };
  var isSlime = function (g) { return g === T.SLIME; };
  var isBomb  = function (g) { return g === T.BOMB; };
  var isDoor  = function (g) { return g === T.DOOR || g === T.DOORD; };

  // ── static art ─────────────────────────────────────────────────────
  Level.prototype.prerender = function () {
    var cv = document.createElement('canvas');
    cv.width = this.pxW; cv.height = this.pxH;
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    this.canvas = cv; this.ctx = c;

    var plain = document.createElement('canvas');
    plain.width = this.pxW; plain.height = this.pxH;
    var pc = plain.getContext('2d');
    pc.imageSmoothingEnabled = false;
    this.plainCanvas = plain; this.plainCtx = pc;   // the 2019 look, undecorated

    for (var r = 0; r < this.h; r++) {
      for (var col = 0; col < this.w; col++) {
        this.paintCell(col, r);
      }
    }
  };

  /** screen-space y of a tile row (row 0 is the floor) */
  Level.prototype.rowY = function (row) { return (this.h - 1 - row) * TILE; };

  Level.prototype.paintCell = function (col, row) {
    var x = col * TILE, y = this.rowY(row);
    var c = this.ctx, pc = this.plainCtx, l, g, idx;

    // 1. the original tiles, in layer order
    for (l = 0; l < this.layers; l++) {
      g = this.at(l, col, row);
      if (!g) continue;
      idx = this.d[l][row * this.w + col];
      if (idx < 0) continue;
      pc.drawImage(this.tileset, idx * TILE, 0, TILE, TILE, x, y, TILE, TILE);
      // SKY is a flat blue fill in the original; the remaster lets the
      // parallax storm show through instead.
      if (g !== T.SKY) c.drawImage(this.tileset, idx * TILE, 0, TILE, TILE, x, y, TILE, TILE);
    }

    var solid = this.solidAt(col, row);
    var vis = this.visible(col, row);

    // 2. grime on the background brickwork
    if (!solid && vis === T.WALL) {
      c.fillStyle = 'rgba(0,0,0,.12)';
      c.fillRect(x, y, TILE, TILE);
      var n = fx.hash(col, row, 3);
      if (n > 0.82) {                       // damp streak running down the wall
        var sw = 1 + ((n * 10) | 0) % 2;
        var sx = x + ((fx.hash(col, row, 4) * 14) | 0);
        var grd = c.createLinearGradient(0, y, 0, y + TILE);
        grd.addColorStop(0, 'rgba(0,0,0,.20)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = grd;
        c.fillRect(sx, y, sw, TILE);
      }
    }

    if (solid) {
      // 3. rim light where a solid tile meets open air above
      if (!this.solidAt(col, row + 1)) {
        c.fillStyle = 'rgba(255,246,222,.16)';
        c.fillRect(x, y, TILE, 1);
        c.fillStyle = 'rgba(255,246,222,.06)';
        c.fillRect(x, y + 1, TILE, 1);
      }
      // 4. weathering, stable per tile
      var h1 = fx.hash(col, row, 7);
      if (h1 > 0.88) {
        c.fillStyle = 'rgba(0,0,0,.20)';
        c.fillRect(x + ((h1 * 13) | 0), y + 3 + ((fx.hash(col, row, 8) * 10) | 0), 1, 2);
      }
      // 5. base shading so floors read as ground, not wallpaper
      c.fillStyle = 'rgba(6,8,16,.16)';
      c.fillRect(x, y + TILE - 2, TILE, 2);
    } else {
      // 6. ambient occlusion cast by neighbouring solids
      var grd2;
      if (this.solidAt(col, row + 1)) {
        grd2 = c.createLinearGradient(0, y, 0, y + 7);
        grd2.addColorStop(0, 'rgba(0,0,0,.40)');
        grd2.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = grd2; c.fillRect(x, y, TILE, 7);
      }
      if (this.solidAt(col - 1, row)) {
        grd2 = c.createLinearGradient(x, 0, x + 5, 0);
        grd2.addColorStop(0, 'rgba(0,0,0,.28)');
        grd2.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = grd2; c.fillRect(x, y, 5, TILE);
      }
      if (this.solidAt(col + 1, row)) {
        grd2 = c.createLinearGradient(x + TILE, 0, x + TILE - 5, 0);
        grd2.addColorStop(0, 'rgba(0,0,0,.28)');
        grd2.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = grd2; c.fillRect(x + TILE - 5, y, 5, TILE);
      }
      if (this.solidAt(col, row - 1)) {
        grd2 = c.createLinearGradient(0, y + TILE, 0, y + TILE - 4);
        grd2.addColorStop(0, 'rgba(0,0,0,.22)');
        grd2.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = grd2; c.fillRect(x, y + TILE - 4, TILE, 4);
      }
    }
  };

  /** Entity.java: the bomb deletes the cell under Porter from mainLayer. */
  Level.prototype.destroy = function (col, row) {
    if (col < 0 || row < 0 || col >= this.w || row >= this.h) return false;
    var i = row * this.w + col;
    if (!this.g[MAIN_LAYER][i]) return false;
    this.g[MAIN_LAYER][i] = 0;
    this.d[MAIN_LAYER][i] = -1;

    // repaint the 3x3 around it — the neighbours' shading changed too
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var cc = col + dc, rr = row + dr;
        if (cc < 0 || rr < 0 || cc >= this.w || rr >= this.h) continue;
        var x = cc * TILE, y = this.rowY(rr);
        this.ctx.clearRect(x, y, TILE, TILE);
        this.plainCtx.clearRect(x, y, TILE, TILE);
        this.paintCell(cc, rr);
      }
    }
    this.collectFeatures();
    return true;
  };

  /* ════════════════════════════════════════════════════════════════════
     GAME
     ════════════════════════════════════════════════════════════════════ */
  function Game(canvas, assets, hooks) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.assets = assets;
    this.hooks = hooks || {};

    this.vw = canvas.width;
    this.vh = canvas.height;

    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.bloom = document.createElement('canvas');
    this.bctx = this.bloom.getContext('2d');
    this.canFilter = typeof this.bctx.filter === 'string';

    this.particles = new fx.Particles();
    this.rain = new fx.Rain(190);

    this.keys = {};
    this.touch = { left: false, right: false, jump: false };
    this.era = false;          // true = raw 2019 build
    this.crt = true;
    this.running = false;
    this.paused = false;

    this.levelIndex = 0;
    this.levels = [];
    this.time = 0;
    this.deaths = 0;
    this.t = 0;                // wall clock for animation
    this.shake = 0;
    this.hitstop = 0;
    this.flash = 0;
    this.flashCol = '255,255,255';
    this.fade = 0;
    this.acc = 0;
    this.lastFrame = 0;

    this.player = {
      x: 0, y: 0, vy: 0, grounded: false, dir: 1,
      coyote: 0, buffer: 0, wasGrounded: false, squash: 1, dead: 0, run: 0
    };

    var self = this;
    this.loop = function (ts) { self.frame(ts); };
  }

  Game.prototype.resize = function (w, h) {
    this.vw = w; this.vh = h;
    this.cv.width = w; this.cv.height = h;
    this.ctx.imageSmoothingEnabled = false;
    this.light.width = w; this.light.height = h;
    this.bloom.width = Math.max(1, w >> 2);
    this.bloom.height = Math.max(1, h >> 2);
  };

  Game.prototype.level = function () { return this.levels[this.levelIndex]; };

  Game.prototype.buildLevels = function () {
    this.levels = [];
    for (var i = 0; i < PR.LEVELS.length; i++) {
      this.levels.push(new Level(PR.LEVELS[i], this.assets.tileset));
    }
  };

  Game.prototype.start = function (index) {
    this.buildLevels();
    this.levelIndex = index || 0;
    this.time = 0;
    this.deaths = 0;
    this.enterLevel(this.levelIndex);
    this.running = true;
    this.paused = false;
    this.lastFrame = 0;
    requestAnimationFrame(this.loop);
  };

  Game.prototype.enterLevel = function (i) {
    this.levelIndex = i;
    var L = this.level();
    this.particles.clear();
    this.respawn(true);
    this.camX = this.player.x - this.vw / 2;
    this.camY = this.player.y + this.vh / 2;
    this.fade = 1;
    if (this.hooks.onLevel) this.hooks.onLevel(i, L.def);
  };

  Game.prototype.respawn = function (silent) {
    var L = this.level();
    var p = this.player;
    p.x = L.def.spawn.x;
    p.y = L.def.spawn.y;
    p.vy = 0;
    p.grounded = false;
    p.dead = 0;
    p.coyote = 0;
    p.buffer = 0;
    p.squash = 1;
    if (!silent) this.fade = 0.75;
  };

  // ── input ──────────────────────────────────────────────────────────
  Game.prototype.wantsLeft = function () {
    return !!(this.keys.ArrowLeft || this.keys.KeyA || this.touch.left);
  };
  Game.prototype.wantsRight = function () {
    return !!(this.keys.ArrowRight || this.keys.KeyD || this.touch.right);
  };
  Game.prototype.wantsJump = function () {
    return !!(this.keys.ArrowUp || this.keys.KeyW || this.keys.Space || this.touch.jump);
  };

  /* ── the port ───────────────────────────────────────────────────────
     Order of operations copied from Porter.update -> Entity.update so the
     quirks survive: you can still bunny-hop by holding jump in 2019 mode,
     the bomb still checks four pixels to the left, and landing still snaps
     you to a whole pixel.                                                */
  Game.prototype.step = function (dt) {
    var L = this.level(), p = this.player;

    if (p.dead > 0) {
      p.dead -= dt;
      if (p.dead <= 0) this.respawn(false);
      return;
    }

    var jumpHeld = this.wantsJump();
    var canJump = this.era ? p.grounded : (p.grounded || p.coyote > 0);

    // Porter.update: jump impulse, then the hold-boost while still rising
    if (this.era) {
      if (jumpHeld && p.grounded) p.vy += JUMP_VELOCITY * WEIGHT;
      else if (jumpHeld && !p.grounded && p.vy > 0) p.vy += JUMP_VELOCITY * WEIGHT * dt;
    } else {
      // remaster: one jump per press, with coyote time and an input buffer
      if (this.jumpEdge) { p.buffer = 0.11; this.jumpEdge = false; }
      p.buffer -= dt;
      p.coyote -= dt;
      if (p.buffer > 0 && canJump) {
        p.vy += JUMP_VELOCITY * WEIGHT;
        p.buffer = 0; p.coyote = 0;
        p.squash = 1.35;
        fx.Burst.jump(this.particles, p.x + PW / 2, p.y);
        PR.audio.play('jump');
      } else if (jumpHeld && !p.grounded && p.vy > 0) {
        p.vy += JUMP_VELOCITY * WEIGHT * dt;
      }
    }

    // Entity.update: gravity, then the vertical sweep
    var newY = p.y;
    p.vy += GRAVITY * dt * WEIGHT;
    newY += p.vy * dt;

    var landed = false;
    if (L.rectCollidesMap(p.x, newY, PW, PH)) {
      if (p.vy < 0) {
        p.y = Math.floor(p.y);
        if (!p.grounded) landed = true;
        p.grounded = true;
      }
      p.vy = 0;
    } else {
      p.y = newY;
      if (p.grounded && !this.era) p.coyote = 0.09;
      p.grounded = false;
    }

    if (landed && !this.era) {
      var power = fx.clamp(this.lastFallSpeed / 190, 0, 1);
      p.squash = 1 - fx.clamp(power * 0.42, 0, 0.45);
      fx.Burst.dust(this.particles, p.x + PW / 2, p.y, power);
      PR.audio.play('land', power);
      if (power > 0.55) this.shake = Math.max(this.shake, power * 1.6);
    }
    this.lastFallSpeed = p.vy < 0 ? -p.vy : 0;

    // hazards, in the order Entity.update checks them
    if (L.rectHits(p.x, newY, PW, PH, isSpike)) return this.kill('spike');
    if (L.rectHits(p.x, newY + 8, PW, PH, isWater)) return this.kill('water');

    if (L.rectHits(p.x, newY, PW, PH, isSlime)) {
      p.vy = SLIME_LAUNCH;
      p.grounded = false;
      if (!this.era) {
        p.squash = 1.5;
        fx.Burst.bounce(this.particles, p.x + PW / 2, p.y);
        PR.audio.play('bounce');
        this.shake = Math.max(this.shake, 0.8);
      }
    }

    if (L.rectHits(p.x - 4, newY, PW, PH, isBomb)) {
      var bc = (p.x / TILE) | 0;
      var br = Math.ceil(p.y / TILE) - 1;
      if (L.destroy(bc, br)) {
        if (!this.era) {
          fx.Burst.boom(this.particles, bc * TILE + TILE / 2, br * TILE + TILE / 2);
          PR.audio.play('boom');
          this.shake = 2.6;
          this.hitstop = 0.05;
          this.flash = 0.5; this.flashCol = '255,190,120';
        }
      }
    }

    if (L.rectHits(p.x, newY, PW, PH, isDoor)) return this.nextLevel();

    // Porter.moveX — horizontal is resolved after everything else
    var move = 0;
    if (this.wantsLeft()) move -= SPEED * dt;
    if (this.wantsRight()) move += SPEED * dt;
    if (move !== 0) {
      p.dir = move < 0 ? -1 : 1;
      var newX = p.x + move;
      if (!L.rectCollidesMap(newX, p.y, PW, PH)) p.x = newX;
      p.run += dt;
      if (!this.era && p.grounded && p.run > 0.12) {
        p.run = 0;
        fx.Burst.trail(this.particles, p.x + PW / 2, p.y + 1, move * 60);
      }
    }

    p.squash += (1 - p.squash) * fx.clamp(dt * 12, 0, 1);
  };

  Game.prototype.kill = function (cause) {
    var p = this.player;
    this.deaths++;
    if (this.era) { this.respawn(true); return; }
    p.dead = 0.42;
    p.vy = 0;
    fx.Burst.death(this.particles, p.x + PW / 2, p.y + PH / 2,
      cause === 'water' ? '#8fd4ff' : '#ff6a4d');
    if (cause === 'water') { fx.Burst.splash(this.particles, p.x + PW / 2, p.y); PR.audio.play('splash'); }
    PR.audio.play('die');
    this.shake = 2.2;
    this.hitstop = 0.07;
    this.flash = 0.45;
    this.flashCol = cause === 'water' ? '150,210,255' : '255,110,80';
    if (this.hooks.onDeath) this.hooks.onDeath(this.deaths);
  };

  Game.prototype.nextLevel = function () {
    var last = this.levelIndex >= this.levels.length - 1;
    if (!this.era) {
      PR.audio.play(last ? 'win' : 'door');
      fx.Burst.win(this.particles, this.player.x + PW / 2, this.player.y + PH / 2);
      this.flash = 0.7; this.flashCol = '255,225,160';
    }
    if (last) {
      this.running = false;
      if (this.hooks.onWin) this.hooks.onWin(this.time, this.deaths);
      return;
    }
    this.enterLevel(this.levelIndex + 1);
  };

  /* ════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════ */
  Game.prototype.updateCamera = function (dt) {
    var p = this.player, L = this.level();
    var cx = p.x + PW / 2, cy = p.y + PH / 2;

    if (this.era) {
      // OrthographicCamera.position.set(Porter.pos.x, Porter.pos.y, 0)
      this.camX = p.x - this.vw / 2;
      this.camY = p.y + this.vh / 2;
      return;
    }

    var lead = fx.clamp((this.wantsRight() ? 1 : 0) - (this.wantsLeft() ? 1 : 0), -1, 1) * 22;
    var tx = cx + lead - this.vw / 2;
    var ty = cy + 8 + this.vh / 2;
    var k = fx.clamp(dt * 7.5, 0, 1);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;

    // keep the level on screen when it is bigger than the view
    if (L.pxW > this.vw) this.camX = fx.clamp(this.camX, 0, L.pxW - this.vw);
    else this.camX = (L.pxW - this.vw) / 2;
    if (L.pxH > this.vh) this.camY = fx.clamp(this.camY, this.vh, L.pxH);
    else this.camY = L.pxH / 2 + this.vh / 2;
  };

  Game.prototype.drawSky = function (c, camX, camY, mood) {
    var g = c.createLinearGradient(0, 0, 0, this.vh);
    g.addColorStop(0, mood.sky[0]);
    g.addColorStop(0.55, mood.sky[1]);
    g.addColorStop(1, mood.sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, this.vw, this.vh);

    // stars: fixed to a slow parallax layer
    var t = this.t;
    for (var i = 0; i < 46; i++) {
      var sx = (i * 97.13 % 1) * 1.0;
      var bx = ((i * 61) % 320) - camX * 0.08;
      var by = ((i * 37) % 90) + camY * 0.05;
      var x = ((bx % (this.vw + 20)) + this.vw + 20) % (this.vw + 20) - 10;
      var y = ((by % (this.vh * 0.7)) + this.vh) % (this.vh * 0.7);
      var tw = 0.35 + 0.35 * Math.sin(t * 2 + i);
      c.fillStyle = 'rgba(200,220,255,' + (tw * (0.35 + sx * 0.3)).toFixed(3) + ')';
      c.fillRect(x | 0, y | 0, 1, 1);
    }

    // moon
    var mx = this.vw - 46 - camX * 0.05, my = 26 + camY * 0.03;
    mx = ((mx % (this.vw + 120)) + this.vw + 120) % (this.vw + 120) - 60;
    var mg = c.createRadialGradient(mx, my, 1, mx, my, 26);
    mg.addColorStop(0, 'rgba(226,236,255,.95)');
    mg.addColorStop(0.28, 'rgba(190,208,240,.35)');
    mg.addColorStop(1, 'rgba(150,180,240,0)');
    c.fillStyle = mg;
    c.beginPath(); c.arc(mx, my, 26, 0, 6.2832); c.fill();

    // the prison itself, two silhouette layers deep
    var base = this.vh * 0.72;
    var k, tx2, hgt;

    c.fillStyle = 'rgba(10,14,26,.55)';
    for (k = -1; k < 10; k++) {
      tx2 = k * 64 - (camX * 0.09) % 64;
      hgt = 34 + ((k * 41) % 30);
      c.fillRect(tx2, base - hgt - 12, 26, hgt + this.vh);
    }

    c.fillStyle = 'rgba(5,7,14,.88)';
    for (k = -1; k < 8; k++) {
      tx2 = k * 78 - (camX * 0.16) % 78;
      hgt = 22 + ((k * 53) % 26);
      c.fillRect(tx2, base - hgt, 30, hgt + this.vh);
      c.fillRect(tx2 + 34, base - hgt * 0.6, 16, hgt + this.vh);
      // a few cells still have someone awake in them
      for (var wy = 0; wy < 3; wy++) {
        if (fx.hash(k, wy, 21) < 0.35) continue;
        var lit = 0.25 + 0.2 * Math.sin(t * 0.7 + k * 2.1 + wy);
        c.fillStyle = 'rgba(255,196,110,' + lit.toFixed(3) + ')';
        c.fillRect(tx2 + 9 + (wy % 2) * 8, base - hgt + 8 + wy * 11, 3, 4);
        c.fillStyle = 'rgba(5,7,14,.88)';
      }
    }

    // watchtower searchlight, sweeping the yard
    var sweep = Math.sin(t * 0.42);
    var ox = this.vw * 0.18 - (camX * 0.16) % 78;
    var oy = base - 40;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.translate(ox, oy);
    c.rotate(0.6 + sweep * 0.5);
    var beam = c.createLinearGradient(0, 0, 0, 210);
    beam.addColorStop(0, 'rgba(210,228,255,.16)');
    beam.addColorStop(1, 'rgba(210,228,255,0)');
    c.fillStyle = beam;
    c.beginPath();
    c.moveTo(-3, 0); c.lineTo(3, 0); c.lineTo(52, 210); c.lineTo(-52, 210);
    c.closePath(); c.fill();
    c.restore();
    c.fillStyle = 'rgba(230,240,255,.5)';
    c.fillRect(ox - 1, oy - 1, 2, 2);
  };

  Game.prototype.drawAnimatedTiles = function (c, camX, camY, L) {
    var t = this.t, i, o, sx, sy;

    // water surface
    for (i = 0; i < L.waterTops.length; i++) {
      o = L.waterTops[i];
      sx = o.c * TILE - camX; sy = camY - (o.r * TILE + TILE);
      if (sx < -TILE || sx > this.vw || sy < -TILE || sy > this.vh) continue;
      for (var px = 0; px < TILE; px += 2) {
        var wv = Math.sin((o.c * TILE + px) * 0.35 + t * 2.4) * 1.1;
        c.fillStyle = 'rgba(190,235,255,.5)';
        c.fillRect(sx + px, sy + 1 + Math.round(wv), 2, 1);
      }
      c.fillStyle = 'rgba(120,190,255,.18)';
      c.fillRect(sx, sy + 2, TILE, 3);
    }

    // slime, breathing
    for (i = 0; i < L.slimes.length; i++) {
      o = L.slimes[i];
      sx = o.x - camX; sy = camY - o.y;
      if (sx < -TILE || sx > this.vw + TILE || sy < -TILE || sy > this.vh + TILE) continue;
      var pulse = 0.35 + 0.3 * Math.sin(t * 3 + o.c);
      c.fillStyle = 'rgba(120,255,140,' + (pulse * 0.35).toFixed(3) + ')';
      c.fillRect(sx - TILE / 2, sy - TILE / 2, TILE, TILE);
      if (Math.random() < 0.02) {
        this.particles.spawn({
          x: o.x + (Math.random() - 0.5) * 12, y: o.y + 4,
          vx: (Math.random() - 0.5) * 6, vy: 6 + Math.random() * 10,
          life: 0.7, size: 1, g: -6, drag: 0.99, glow: true, kind: 3, col: '#9dff8a'
        });
      }
    }

    // bombs, ticking
    for (i = 0; i < L.bombs.length; i++) {
      o = L.bombs[i];
      sx = o.x - camX; sy = camY - o.y;
      if (sx < -TILE || sx > this.vw + TILE || sy < -TILE || sy > this.vh + TILE) continue;
      var beat = Math.pow(Math.max(0, Math.sin(t * 4 + o.c * 0.7)), 6);
      c.fillStyle = 'rgba(255,70,40,' + (0.15 + beat * 0.55).toFixed(3) + ')';
      c.fillRect(sx - 3, sy - 3, 6, 6);
    }

    // wall sconces — remaster paint, no collision, no map data touched
    for (i = 0; i < L.torches.length; i++) {
      o = L.torches[i];
      sx = o.x - camX; sy = camY - o.y;
      if (sx < -20 || sx > this.vw + 20 || sy < -20 || sy > this.vh + 20) continue;
      var f = 0.7 + 0.3 * Math.sin(t * 11 + o.seed) + 0.15 * Math.sin(t * 26.4 + o.seed * 2);
      c.fillStyle = '#3a3128';
      c.fillRect(sx - 1, sy + 1, 2, 4);                    // bracket
      c.fillStyle = 'rgba(255,180,70,' + (0.75 + f * 0.2).toFixed(3) + ')';
      c.fillRect(sx - 1, sy - 2 - f, 2, 3 + f);            // flame body
      c.fillStyle = 'rgba(255,240,190,.9)';
      c.fillRect(sx, sy - 1, 1, 1);                        // hot centre
      if (Math.random() < 0.12) {
        this.particles.spawn({
          x: o.x + (Math.random() - 0.5) * 2, y: o.y + 3,
          vx: (Math.random() - 0.5) * 5, vy: 10 + Math.random() * 12,
          life: 0.5 + Math.random() * 0.5, size: 1, g: 6, drag: 0.98,
          glow: true, kind: 3, col: '#ffca6a', col2: '#c4571d'
        });
      }
    }

    // doors, the only good news in the level
    for (i = 0; i < L.doors.length; i++) {
      o = L.doors[i];
      sx = o.x - camX; sy = camY - o.y;
      if (sx < -30 || sx > this.vw + 30 || sy < -40 || sy > this.vh + 40) continue;
      var bob = 0.5 + 0.5 * Math.sin(t * 2.2);
      c.save();
      c.globalCompositeOperation = 'lighter';
      var dg = c.createRadialGradient(sx, sy, 1, sx, sy, 16 + bob * 4);
      dg.addColorStop(0, 'rgba(255,208,120,.55)');
      dg.addColorStop(1, 'rgba(255,170,60,0)');
      c.fillStyle = dg;
      c.fillRect(sx - 22, sy - 22, 44, 44);
      c.restore();
      if (Math.random() < 0.25) fx.Burst.doorGlow(this.particles, o.x, o.y);
    }
  };

  Game.prototype.drawLights = function (camX, camY, L, mood) {
    var c = this.lctx, i, o, sx, sy;
    var a = mood.ambient;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')';
    c.fillRect(0, 0, this.vw, this.vh);
    c.globalCompositeOperation = 'lighter';

    function lamp(x, y, r, col, alpha) {
      if (x < -r || y < -r || x > this.vw + r || y > this.vh + r) return;
      var g = c.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, 'rgba(' + col + ',' + alpha + ')');
      g.addColorStop(0.45, 'rgba(' + col + ',' + (alpha * 0.42).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + col + ',0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    lamp = lamp.bind(this);

    var t = this.t;

    // windows leak cold light and a soft shaft
    for (i = 0; i < L.windows.length; i++) {
      o = L.windows[i];
      sx = o.x - camX; sy = camY - o.y;
      if (sx < -60 || sx > this.vw + 60 || sy < -60 || sy > this.vh + 60) continue;
      lamp(sx, sy, 34, '150,190,255', 0.55);
      // dust drifting through the shaft
      if (Math.random() < 0.06) {
        this.particles.spawn({
          x: o.x + (Math.random() - 0.4) * 18, y: o.y - Math.random() * 34,
          vx: 3 + Math.random() * 5, vy: -4 - Math.random() * 5,
          life: 1.4 + Math.random(), size: 1, g: 0, drag: 1, a: 0.5,
          glow: true, kind: 3, col: '#cfe2ff'
        });
      }
      c.save();
      c.beginPath();
      c.moveTo(sx - 5, sy);
      c.lineTo(sx + 5, sy);
      c.lineTo(sx + 26, sy + 46);
      c.lineTo(sx + 10, sy + 46);
      c.closePath();
      var sg = c.createLinearGradient(sx, sy, sx + 20, sy + 46);
      sg.addColorStop(0, 'rgba(150,190,255,.30)');
      sg.addColorStop(1, 'rgba(150,190,255,0)');
      c.fillStyle = sg;
      c.fill();
      c.restore();
    }

    for (i = 0; i < L.torches.length; i++) {
      o = L.torches[i];
      var tf = 0.86 + 0.1 * Math.sin(t * 11 + o.seed) + 0.06 * Math.sin(t * 26.4 + o.seed * 2);
      lamp(o.x - camX, camY - o.y, 52 * tf, '255,176,88', 0.92);
    }
    for (i = 0; i < L.doors.length; i++) {
      o = L.doors[i];
      lamp(o.x - camX, camY - o.y, 46 + Math.sin(t * 2.2) * 4, '255,200,110', 0.95);
    }
    for (i = 0; i < L.bombs.length; i++) {
      o = L.bombs[i];
      var beat = Math.pow(Math.max(0, Math.sin(t * 4 + o.c * 0.7)), 6);
      lamp(o.x - camX, camY - o.y, 20 + beat * 12, '255,80,45', 0.35 + beat * 0.5);
    }
    for (i = 0; i < L.slimes.length; i++) {
      o = L.slimes[i];
      lamp(o.x - camX, camY - o.y, 22, '110,255,140', 0.5);
    }
    for (i = 0; i < L.waterTops.length; i++) {
      o = L.waterTops[i];
      lamp(o.x - camX, camY - o.y, 18, '90,170,255', 0.32);
    }

    // Porter's own lamp, with a nervous flicker: a hot core inside a wide spill
    var p = this.player;
    var flick = 0.9 + Math.sin(t * 21) * 0.035 + Math.sin(t * 7.3) * 0.05;
    if (p.dead <= 0) {
      var px = p.x + PW / 2 - camX, py = camY - (p.y + PH / 2);
      lamp(px, py, 78 * flick, '255,206,140', 0.62);
      lamp(px, py, 26 * flick, '255,232,190', 0.95);
    }

    // explosions and sparks light the room too
    var P = this.particles.p;
    for (i = 0; i < P.length; i++) {
      var q = P[i];
      if (!q.on || !q.glow) continue;
      var lt = q.life / q.max;
      lamp(q.x - camX, camY - q.y, 10 + q.size * 6 * lt, '255,190,120', lt * 0.5);
    }

    c.globalCompositeOperation = 'source-over';
  };

  Game.prototype.drawPlayer = function (c, camX, camY) {
    var p = this.player;
    if (p.dead > 0 && !this.era) return;

    var img = this.assets.porter;
    var sx = p.x - camX, sy = camY - p.y;

    if (this.era) {
      // b.draw(img, pos.x, pos.y, getWidth(), getHeight())
      c.drawImage(img, sx, sy - PH, PW, PH);
      return;
    }

    var w = 13, h = 11;
    var sq = fx.clamp(p.squash, 0.55, 1.5);
    var dw = w / sq, dh = h * sq;
    var cx = sx + PW / 2;

    // contact shadow
    if (p.grounded) {
      c.globalAlpha = 0.35;
      c.fillStyle = '#000';
      c.fillRect(cx - 5, sy - 1, 10, 1);
      c.globalAlpha = 1;
    }

    c.save();
    c.translate(cx, sy);
    c.scale(p.dir, 1);
    c.drawImage(img, -dw / 2, -dh, dw, dh);
    c.restore();
  };

  Game.prototype.render = function () {
    var c = this.ctx, L = this.level();
    var mood = MOOD[Math.min(this.levelIndex, MOOD.length - 1)];

    var shakeX = 0, shakeY = 0;
    if (this.shake > 0.01 && !this.era) {
      shakeX = (Math.random() - 0.5) * this.shake * 2.4;
      shakeY = (Math.random() - 0.5) * this.shake * 2.4;
    }
    var camX = Math.round(this.camX + shakeX);
    var camY = Math.round(this.camY + shakeY);

    // ── the 2019 build: white void, flat tiles, nothing else ─────────
    if (this.era) {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, this.vw, this.vh);
      c.drawImage(L.plainCanvas, -camX, -(L.pxH - camY));
      this.drawPlayer(c, camX, camY);
      return;
    }

    // ── remaster ─────────────────────────────────────────────────────
    this.drawSky(c, camX, camY, mood);
    this.rain.draw(c, this.vw, this.vh, this.t, camX, camY, mood.wind);

    c.drawImage(L.canvas, -camX, -(L.pxH - camY));

    this.drawAnimatedTiles(c, camX, camY, L);
    this.particles.draw(c, camX, camY, this.vw, this.vh);

    // lighting
    this.drawLights(camX, camY, L, mood);
    c.globalCompositeOperation = 'multiply';
    c.drawImage(this.light, 0, 0);
    c.globalCompositeOperation = 'source-over';

    // Porter is drawn after the light pass: he is carrying the lamp, so he is
    // the one thing in the frame that never falls into shadow.
    this.drawPlayer(c, camX, camY);

    // bloom — blur the light map back over the frame
    if (this.crt && this.canFilter) {
      var b = this.bctx;
      b.clearRect(0, 0, this.bloom.width, this.bloom.height);
      b.filter = 'blur(1.6px)';
      b.drawImage(this.light, 0, 0, this.bloom.width, this.bloom.height);
      b.filter = 'none';
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.26;
      c.drawImage(this.bloom, 0, 0, this.vw, this.vh);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }

    // glowing particles punch back through the darkness
    c.globalCompositeOperation = 'lighter';
    this.particles.drawGlow(c, camX, camY, this.vw, this.vh);
    c.globalCompositeOperation = 'source-over';

    // vignette + scanlines
    if (this.crt) {
      var vg = c.createRadialGradient(this.vw / 2, this.vh / 2, this.vh * 0.28,
                                      this.vw / 2, this.vh / 2, this.vh * 0.86);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,.40)');
      c.fillStyle = vg;
      c.fillRect(0, 0, this.vw, this.vh);
      c.fillStyle = 'rgba(0,0,0,.09)';
      for (var y = 0; y < this.vh; y += 2) c.fillRect(0, y, this.vw, 1);
    }

    if (this.flash > 0.01) {
      c.fillStyle = 'rgba(' + this.flashCol + ',' + (this.flash * 0.6).toFixed(3) + ')';
      c.fillRect(0, 0, this.vw, this.vh);
    }
    if (this.fade > 0.01) {
      c.fillStyle = 'rgba(3,4,8,' + this.fade.toFixed(3) + ')';
      c.fillRect(0, 0, this.vw, this.vh);
    }
  };

  // ── main loop ──────────────────────────────────────────────────────
  Game.prototype.frame = function (ts) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);

    if (!this.lastFrame) this.lastFrame = ts;
    // clamped both ways: a backgrounded tab can hand back a stale timestamp
    var dt = fx.clamp((ts - this.lastFrame) / 1000, 0, 0.05);
    this.lastFrame = ts;

    if (this.paused) { this.render(); return; }

    this.t += dt;
    this.time += dt;

    if (this.hitstop > 0) {
      this.hitstop -= dt;
    } else {
      this.acc += dt;
      var steps = 0;
      while (this.acc >= 1 / 120 && steps < 6) {
        this.step(1 / 120);
        this.acc -= 1 / 120;
        steps++;
        if (!this.running) break;                 // won mid-step
      }
      if (!this.running) { this.render(); return; }
    }

    this.particles.update(dt);
    this.updateCamera(dt);

    this.shake += (0 - this.shake) * fx.clamp(dt * 6, 0, 1);
    this.flash += (0 - this.flash) * fx.clamp(dt * 7, 0, 1);
    this.fade += (0 - this.fade) * fx.clamp(dt * 3.2, 0, 1);

    this.render();
    if (this.hooks.onTick) this.hooks.onTick(this.time, this.deaths);
  };

  PR.Game = Game;
  PR.Level = Level;
  PR.T = T;
})(window.PR = window.PR || {});
