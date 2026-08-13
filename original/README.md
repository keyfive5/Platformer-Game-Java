# The original 2019 project

This directory is the game as it existed in 2019, kept for its own sake. Nothing in here
has been refactored, reformatted or "cleaned up" — the static fields, the repeated
respawn `if`s and the typo-adjacent comments are all where we left them.

```
core/
  src/net/hasanbilal/pr/
    PrisonRevelations.java       ApplicationAdapter — camera, sprite batch, music
    entities/Entity.java         gravity, collision, hazards, level transitions
    entities/Porter.java         the player: SPEED, JUMP_VELOCITY, moveX
    entities/EntityType.java     enum: id, class, 9x7 size, weight 20
    entities/EntityLoader.java   reads/writes maps/basic.entities
    entities/EntitySnapshot.java the JSON shape
    world/GMap.java              doesRectCollideWith{Map,Spikes,Water,Bomb,Slime,Door}
    world/TiledGMap.java         the Tiled-backed implementation
    world/TileType.java          the tile id table
  assets/                        level1.tmx, level2.tmx, level3.1.tmx, newTileSet.png,
                                 porter.png, bridges.png, entities.json
desktop/
  src/.../DesktopLauncher.java   main() — the comment says "START HERE"
  maps/basic.entities            the saved player snapshot
```

## What was removed, and why

**`core/bin/` and `desktop/bin/`** — compiled `.class` output from the 2019 Eclipse
workspace. Fully derived from the `.java` files that are still here.

**`.gradle/`** — Gradle 4.3 and 6.0 lock files and binary caches.

**`Watch Dogs Police Chase Music OST.mp3`** — a 6 MB rip of a Ubisoft soundtrack. It was
never ours to publish, so it is not in this repository. `PrisonRevelations.java` still
loads it:

```java
wd = Gdx.audio.newMusic(Gdx.files.internal("Watch Dogs Police Chase Music OST.mp3"));
```

The game will throw on startup until a file with that exact name exists in
`core/assets/`. Any mp3 works — the game only loops it.

## Running it today

This was an Eclipse + Buildship project and the root Gradle files (`settings.gradle`, the
wrapper, the libGDX dependency block) were not in the archive we recovered — only `core/`
and `desktop/` survived. So there is no one-command build here, and rather than ship a
guessed-at build script that has never been run, here is what it actually needs:

1. **A libGDX 1.9.x classpath.** `gdx`, `gdx-platform` (natives), `gdx-backend-lwjgl`.
   The `.classpath` files reference an Eclipse user library literally named `libGDX`.
2. **Java 8.** The sources are `sourceCompatibility = 1.7` and the desktop backend is
   the old LWJGL 2 one, which does not get along with modern JDKs.
3. **Working directory set to `core/assets`** — `desktop/build.gradle` did this via
   `workingDir = project.assetsDir`, and every asset is loaded by bare filename.
4. **An mp3 at the path above.**

Then run `net.hasanbilal.pr.desktop.DesktopLauncher`.

If you just want to play the game, [the browser version](../docs/) is the same three
levels on the same physics, and it needs none of this.
