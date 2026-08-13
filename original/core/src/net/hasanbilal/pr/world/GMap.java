package net.hasanbilal.pr.world;

import java.util.ArrayList;

import com.badlogic.gdx.graphics.OrthographicCamera;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;

import net.hasanbilal.pr.entities.Entity;
import net.hasanbilal.pr.entities.EntityLoader;
import net.hasanbilal.pr.entities.Porter;

//This is the superclass for the Tiled Maps It mainly handles what entities are in the map
//This was also inspired by HollowBit

public abstract class GMap {

	protected ArrayList<Entity> entities;

	// Constructor of GMap, it says to add the entities from the basic.entities file
	// in the map
	public GMap() {
		entities = new ArrayList<Entity>();
		entities.addAll(EntityLoader.loadEntities("basic", this, entities));
	}

	// Constructor of GMap, it says to add the entities from the basic.entities file
	// in the map
	public void render(OrthographicCamera c, SpriteBatch b) {
		for (Entity entity : entities) {
			entity.render(b);
		}
	}

	// Update method that calls the entity constructor and implements the gravity as
	// 9.8
	public void update(float deltaTime) {
		for (Entity entity : entities) {
			entity.update(deltaTime, -9.8f);
		}
	}

	// Disposing the entityloader was required to display the enitities
	public void dispose() {
		EntityLoader.saveEntities("basic", entities);
	}

	/**
	 * Gets a tile by location
	 * 
	 * @param layer Which Tiled Map Layer is the tile in
	 * @param x     What is the x -coordinate of the tile
	 * @param y     what is the y-coordinate of the tile
	 * @return The Tile by Coordinate
	 */
	public TileType getByLocation(int layer, float x, float y) {
		return this.getByCoordinate(layer, (int) (x / TileType.TILE_SIZE), (int) (y / TileType.TILE_SIZE));
	}

	// Gets the Tile by Coordinate
	public abstract TileType getByCoordinate(int layer, int col, int row);

	// Determines if the player collided with the side of the map or a collidable
	// object
	public boolean doesRectCollideWithMap(float x, float y, int width, int height) {
		if (x < 0 || y < 0 || x + width > getPixelWidth() || y + height > getPixelHeight())
			return true;

		for (int row = (int) (y / TileType.TILE_SIZE); row < Math.ceil((y + height) / TileType.TILE_SIZE); row++) {
			for (int col = (int) (x / TileType.TILE_SIZE); col < Math.ceil((x + width) / TileType.TILE_SIZE); col++) {
				for (int layer = 0; layer < getLayers(); layer++) {
					TileType type = getByCoordinate(layer, col, row);
					if (type != null && type.isCollidable())
						return true;
				}
			}
		}
		return false;
	}

	// Determines if the player collided with spikes
	public boolean doesRectCollideWithSpikes(float x, float y, int width, int height) {

		for (int row = (int) (y / TileType.TILE_SIZE); row < Math.ceil((y + height) / TileType.TILE_SIZE); row++) {
			for (int col = (int) (x / TileType.TILE_SIZE); col < Math.ceil((x + width) / TileType.TILE_SIZE); col++) {
				for (int layer = 0; layer < getLayers(); layer++) {
					TileType type = getByCoordinate(layer, col, row);
					if (type != null && type.isCollidable() && type.getId() == 9)
						return true;
				}
			}
		}
		return false;
	}

	// Determines if the player collided with water
	public boolean doesRectCollideWithWater(float x, float y, int width, int height) {

		for (int row = (int) (y / TileType.TILE_SIZE); row < Math.ceil((y + height) / TileType.TILE_SIZE); row++) {
			for (int col = (int) (x / TileType.TILE_SIZE); col < Math.ceil((x + width) / TileType.TILE_SIZE); col++) {
				for (int layer = 0; layer < getLayers(); layer++) {
					TileType type = getByCoordinate(layer, col, row);
					if (type != null && type.getId() == 4)
						return true;
				}
			}
		}
		return false;
	}

	// Determines if the player collided with the bomb
	public boolean doesRectCollideWithBomb(float x, float y, int width, int height) {

		for (int row = (int) (y / TileType.TILE_SIZE); row < Math.ceil((y + height) / TileType.TILE_SIZE); row++) {
			for (int col = (int) (x / TileType.TILE_SIZE); col < Math.ceil((x + width) / TileType.TILE_SIZE); col++) {
				for (int layer = 0; layer < getLayers(); layer++) {
					TileType type = getByCoordinate(layer, col, row);
					if (type != null && type.isCollidable() && type.getId() == 8)
						return true;
				}
			}
		}
		return false;
	}

	// Determines if the player collided with the slime/trampoline
	public boolean doesRectCollideWithSlime(float x, float y, int width, int height) {

		for (int row = (int) (y / TileType.TILE_SIZE); row < Math.ceil((y + height) / TileType.TILE_SIZE); row++) {
			for (int col = (int) (x / TileType.TILE_SIZE); col < Math.ceil((x + width) / TileType.TILE_SIZE); col++) {
				for (int layer = 0; layer < getLayers(); layer++) {
					TileType type = getByCoordinate(layer, col, row);
					if (type != null && type.isCollidable() && type.getId() == 2)
						return true;
				}
			}
		}
		return false;
	}

	// Determines if the player collided with the door
	public boolean doesRectCollideWithDoor(float x, float y, int width, int height) {

		for (int row = (int) (y / TileType.TILE_SIZE); row < Math.ceil((y + height) / TileType.TILE_SIZE); row++) {
			for (int col = (int) (x / TileType.TILE_SIZE); col < Math.ceil((x + width) / TileType.TILE_SIZE); col++) {
				for (int layer = 0; layer < getLayers(); layer++) {
					TileType type = getByCoordinate(layer, col, row);
					if (type != null)
						if (type.getId() == 31 || type.getId() == 11)
							return true;
				}
			}
		}
		return false;
	}

	public abstract int getWidth();

	public abstract int getHeight();

	public abstract int getLayers();

	// gets the pixel width of the map by taking the width in tiles and multiplying
	// it by tile size
	public int getPixelWidth() {
		return this.getWidth() * TileType.TILE_SIZE;
	}

	// gets the pixel height of the map by taking the height in tiles and
	// multiplying it by tile size
	public int getPixelHeight() {
		return this.getHeight() * TileType.TILE_SIZE;
	}

}
