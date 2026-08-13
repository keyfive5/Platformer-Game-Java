package net.hasanbilal.pr.entities;

import java.util.HashMap;

//Large part of this class was inspired by HollowBit
//This class defines the snapshot and all its information of an entity

public class EntitySnapshot {

	private float x, y;
	private HashMap<String, String> data;
	String type;

	// We had to put this or they would be a compiling error
	public EntitySnapshot() {
	}

	/**
	 * Constructor for the entitySnapshot
	 * 
	 * @param type The name of the snapshot as formatted in the .entities and .json
	 *             file
	 * @param x    the starting spawn x-coordinate position
	 * @param y    x the starting spawn y-coordinate position
	 */
	public EntitySnapshot(String type, float x, float y) {
		this.type = type;
		this.x = x;
		this.y = y;
	}

	// Returns the x coordinate of the spawning place of the player
	public float getX() {
		return x;
	}

	// Used to move the x-coordinate of the entity
	public void setX(float x) {
		this.x = x;
	}

	// Returns the y coordinate of the spawning place of the player
	public float getY() {
		return y;
	}

	// Used to move the y-coordinate of the entity
	public void setY(float y) {
		this.y = y;
	}

	// returns the name of the entity in the .json file
	public String getType() {
		return type;
	}

	// changes the name of the entity in the .json file
	public void setType(String type) {
		this.type = type;
	}

	// A float that stores data for the entity
	public void putFloat(String key, float value) {
		data.put(key, "" + value);
	}

	// A int that stores data for the entity
	public void putInt(String key, int value) {
		data.put(key, "" + value);
	}

	// A boolean that stores data for the entity
	public void putBoolean(String key, boolean value) {
		data.put(key, "" + value);
	}

	// A string that stores data for the entity
	public void putString(String key, String value) {
		data.put(key, "" + value);
	}

	// Gets the float placed by the developer in the entity
	public float getFloat(String key, float defaultValue) {
		if (data.containsKey(key)) {
			try {
				return Float.parseFloat(data.get(key));
			} catch (Exception e) {
				return defaultValue;
			}
		} else
			return defaultValue;
	}

	// Gets the INT placed by the developer in the entity
	public int getInt(String key, int defaultValue) {
		if (data.containsKey(key)) {
			try {
				return Integer.parseInt(data.get(key));
			} catch (Exception e) {
				return defaultValue;
			}
		} else
			return defaultValue;
	}

	// Gets the boolean placed by the developer in the entity
	public boolean getBoolean(String key, boolean defaultValue) {
		if (data.containsKey(key)) {
			try {
				return Boolean.parseBoolean(data.get(key));
			} catch (Exception e) {
				return defaultValue;
			}
		} else
			return defaultValue;
	}

	// Gets the String placed by the developer in the entity
	public String getString(String key, String defaultValue) {
		if (data.containsKey(key)) {
			return data.get(key);

		} else
			return defaultValue;
	}

}
