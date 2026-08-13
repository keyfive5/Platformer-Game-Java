package net.hasanbilal.pr.world;

import java.util.HashMap;

//This enuk is where all the tiles are defined

public enum TileType {

	GRASS(1, true, "Grass"),
	SLIME(2, true, "Slime"),
	SKY(3, false, "Sky"),
	WATER(4, false, "Water"),
	CLOUD(5, true, "Cloud"),
	STONE(6, true, "Stone"), 
	WALL(7, false, "Wall"),
	BOMB(8, true, "Bomb"),
	SPIKES(9, true, "Spikes"),
	WINDOW(10, false, "Window"), 
	DOOR(31, false, "Door"),
	DOORD(11, false, "Door"); // A duplicate of door had to be made because Tiled kept interchanging the IDs with '11' and '31'... strange																					

	public static final int TILE_SIZE = 16;

	private int id;
	private boolean collidable;
	private String name;
	private float damage;

	//Constructor so we can add the Tiles in an easier way to Tiled's algorithm
	private TileType(int id, boolean collidable, String name) {
		this(id, collidable, name, 0);
	}

	//Damage added just incase the spikes or water tile break
	private TileType(int id, boolean collidable, String name, float damage) {
		this.id = id;
		this.collidable = collidable;
		this.name = name;
		this.damage = damage;
	}

	//Gets the ID of the tile
	public int getId() {
		return id;
	}

	//Checks if the tile is collidable or not
	public boolean isCollidable() {
		return collidable;
	}

	//Gets the name of the tile
	public String getName() {
		return name;
	}

	//Gets the damage of the tile if needed
	public float getDamage() {
		return damage;
	}

	//makes the tiled map into a hashmap
	private static HashMap<Integer, TileType> tMap;

	//Intializes the hashmap
	static {
		tMap = new HashMap<Integer, TileType>();
		for (TileType tType : TileType.values()) {
			tMap.put(tType.getId(), tType);
		}
	}

	//Easier way to get the Tile by ID
	public static TileType getTileTypeById(int i) {
		return tMap.get(i);
	}

}
