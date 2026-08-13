package net.hasanbilal.pr.entities;

import java.util.HashMap;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.utils.reflect.ClassReflection;
import com.badlogic.gdx.utils.reflect.ReflectionException;

import net.hasanbilal.pr.world.GMap;

//This enum has the id, class, and size of the players

@SuppressWarnings("rawtypes")
public enum EntityType {

	PLAYER("player", Porter.class, 9, (int) 7.5, 20);

	private String id;

	private Class loaderClass;
	int width;

	private int height;
	private float weight;

	/**
	 * Constructor for the EntityType.
	 * 
	 * @param id          is how the entity gets identified. You can pretend this is
	 *                    the name of the entity
	 * @param loaderClass What class is the entity corrospondent to. Like how the
	 *                    entity Porter is corrospondent to class Porter.java
	 * @param width       The pixel width of the entity
	 * @param height      The pixel height of the entity
	 * @param weight      The weight of the entity. Only used to influence the
	 *                    gravity affect on the entity
	 */
	private EntityType(String id, Class loaderClass, int width, int height, float weight) {
		this.id = id;
		this.loaderClass = loaderClass;
		this.width = width;
		this.height = height;
		this.weight = weight;
	}

	// Returns the id/name of the entity
	public String getId() {
		return id;
	}

	// Returns the pixel width of the entity
	public int getWidth() {
		return width;
	}

	// Returns the pixel height of the entity
	public int getHeight() {
		return height;
	}

	// Returns the weight of the entity
	public float getWeight() {
		return weight;
	}

	/**
	 * Creates Entity in-game when found in .json and .entities
	 * 
	 * @param entitySnapshot refers to the entitysnapshot class
	 * @param map            refers to the superclass of the Tiled Map
	 * @return entity if the creation is successful
	 */
	public static Entity createEntityUsingSnapshot(EntitySnapshot entitySnapshot, GMap map) {
		EntityType type = entityTypes.get(entitySnapshot.type);
		try {
			@SuppressWarnings("unchecked")
			Entity entity = ClassReflection.newInstance(type.loaderClass);
			entity.create(entitySnapshot, type, map);
			return entity;
		} catch (ReflectionException e) {
			Gdx.app.error("Entity Loader", "Could not load entity of type " + type.id);
			return null;
		}
	}

	private static HashMap<String, EntityType> entityTypes;

	// Puts entityTypes in a Hashmap to make thing simpler
	static {
		entityTypes = new HashMap<String, EntityType>();
		for (EntityType type : EntityType.values())
			entityTypes.put(type.id, type);
	}

}
