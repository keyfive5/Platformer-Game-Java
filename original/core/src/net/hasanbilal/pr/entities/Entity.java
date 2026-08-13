package net.hasanbilal.pr.entities;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input.Keys;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.maps.tiled.TiledMapTileLayer;
import com.badlogic.gdx.maps.tiled.TmxMapLoader;
import com.badlogic.gdx.maps.tiled.renderers.OrthogonalTiledMapRenderer;
import com.badlogic.gdx.math.Vector2;

import net.hasanbilal.pr.PrisonRevelations;
import net.hasanbilal.pr.world.GMap;
import net.hasanbilal.pr.world.TileType;
import net.hasanbilal.pr.world.TiledGMap;

//This class is to be the abstract class of the Player, where its position, type, and conditon in the air is defined

public abstract class Entity {

	public static Vector2 pos;
	protected EntityType t;
	protected static float velocityY = 0;
	protected GMap m;
	protected boolean grounded = false;

	/**
	 * This method was made by help from Stack Overflow user Constantin Trepadus
	 * 
	 * @param snapshot used to import the character in the game in an easier way
	 * @param type     refers to the enum 'EntityType' which gets the id and size of
	 *                 the player
	 * @param map      Referencing the superclass of the Tiled Maps
	 */
	public void create(EntitySnapshot snapshot, EntityType type, GMap map) {
		this.pos = new Vector2(snapshot.getX(), snapshot.getY());
		this.t = type;
		this.m = map;
	}

	/***
	 * 
	 * @param delta uses time to accelerate the player with gravity
	 * @param g     represents gravity
	 */

	public void update(float delta, float g) {
		float newY = pos.y;

		// the longer you fall, the faster you get; gravity
		this.velocityY += g * delta * getWeight();
		newY += this.velocityY * delta;

		// The Player stops moving when he hits the side of the map or if he hits a
		// collidable object
		if (m.doesRectCollideWithMap(pos.x, newY, getWidth(), getHeight())) {
			if (velocityY < 0) {
				this.pos.y = (float) Math.floor(pos.y);
				grounded = true;
			}
			this.velocityY = 0;
		} else {
			this.pos.y = newY;
			grounded = false;
		}

		// Player Respawns when he hits the spikes

		if (m.doesRectCollideWithSpikes(pos.x, newY, getWidth(), getHeight())) {

			if (PrisonRevelations.level == 1) {
				Entity.pos.x = 40;
				Entity.pos.y = 90;
			} else if (PrisonRevelations.level == 2) {
				Entity.pos.x = 41 * TileType.TILE_SIZE;
				Entity.pos.y = 14 * TileType.TILE_SIZE;

			} else if (PrisonRevelations.level == 3) {
				Entity.pos.x = 37 * TileType.TILE_SIZE;
				Entity.pos.y = 5 * TileType.TILE_SIZE;

			}

		}

		// Player Respawns when he submerges in the water

		if (m.doesRectCollideWithWater(pos.x, newY + 8, getWidth(), getHeight())) {
			grounded = false;

			if (PrisonRevelations.level == 1) {
				Entity.pos.x = 40;
				Entity.pos.y = 90;
			} else if (PrisonRevelations.level == 2) {
				Entity.pos.x = 41 * TileType.TILE_SIZE;
				Entity.pos.y = 14 * TileType.TILE_SIZE;

			} else if (PrisonRevelations.level == 3) {
				Entity.pos.x = 37 * TileType.TILE_SIZE;
				Entity.pos.y = 5 * TileType.TILE_SIZE;

			}

		}

		// Launch the player when he hits the slime by increase his y velocity

		if (m.doesRectCollideWithSlime(pos.x, newY, getWidth(), getHeight())) {
			Entity.velocityY = 0; // this is here to stop the player from building up velocity by bouncing between
									// the bomb and slime
			Entity.velocityY = 200;

		}

		// Remove the block underneath you when collides with bomb
		// This essentially just makes the bomb an obstacle

		if (m.doesRectCollideWithBomb(pos.x - 4, newY, getWidth(), getHeight())) {

			if (PrisonRevelations.level == 1) {
				if (newY / TileType.TILE_SIZE > 4)
					TiledGMap.mainLayer.getCell((int) ((Porter.pos.x) / TileType.TILE_SIZE),
							(int) Math.ceil((Porter.pos.y / TileType.TILE_SIZE) - 1)).setTile(null);
				;
			} else {
				TiledGMap.mainLayer.getCell((int) ((Porter.pos.x) / TileType.TILE_SIZE),
						(int) Math.ceil((Porter.pos.y / TileType.TILE_SIZE) - 1)).setTile(null);
				;
			}

		}

		// Go to the next level when you collide with the door
		if (m.doesRectCollideWithDoor(pos.x, newY, getWidth(), getHeight())) {
			// System.out.println("Level was " + PrisonRevelations.level);
			PrisonRevelations.level += 1;
			// System.out.println("Level is now " + PrisonRevelations.level);

			if (PrisonRevelations.level == 2) {
				TiledGMap.lvl1 = new TmxMapLoader().load("level2.tmx");
				TiledGMap.otmr = new OrthogonalTiledMapRenderer(TiledGMap.lvl1);
				TiledGMap.mainLayer = (TiledMapTileLayer) TiledGMap.lvl1.getLayers().get(1);
				Entity.pos.x = 41 * TileType.TILE_SIZE;
				Entity.pos.y = 14 * TileType.TILE_SIZE;

			} else if (PrisonRevelations.level == 3) {
				TiledGMap.lvl1 = new TmxMapLoader().load("level3.1.tmx");
				TiledGMap.otmr = new OrthogonalTiledMapRenderer(TiledGMap.lvl1);
				TiledGMap.mainLayer = (TiledMapTileLayer) TiledGMap.lvl1.getLayers().get(1);
				Entity.pos.x = 37 * TileType.TILE_SIZE;
				Entity.pos.y = 5 * TileType.TILE_SIZE;
			} else if (PrisonRevelations.level == 4) {
				System.out.println("You escaped!! Yay!");
				System.exit(0);

			}

		}

	}

	public abstract void render(SpriteBatch b);

	// Saves the snapshot in the .json files
	public EntitySnapshot getSaveSnapshot() {
		return new EntitySnapshot(t.getId(), pos.x, pos.y);
	}

	// Gets the Vector2 Position of the Player
	public Vector2 getPos() {
		return pos;
	}

	// Gets the x-coordinate of the player
	public float getX() {
		return pos.x;
	}

	// Gets the y-coordinate of the player
	public float getY() {
		return pos.y;
	}

	// Gets the EntityType of the player
	public EntityType getT() {
		return t;
	}

	// Gets the y velocity of the player
	public float getVelocityY() {
		return velocityY;
	}

	// returns if the player is on the ground or not
	public boolean isGrounded() {
		return grounded;
	}

	// gets the width of the player
	public int getWidth() {
		return t.getWidth();
	}

	// gets the height of the player
	public int getHeight() {
		return t.getHeight();
	}

	// gets the weight of the player
	public float getWeight() {
		return t.getWeight();
	}

}
