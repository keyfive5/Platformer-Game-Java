package net.hasanbilal.pr.entities;

import java.util.ArrayList;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Json;

import net.hasanbilal.pr.world.GMap;

//This Class is used to make loading in entities easier. Instead of adding them in the code, you can just add them in the .json file

public class EntityLoader {

	private static Json json = new Json();
	
	//Adds the entities in the the .entities into the game 
	public static ArrayList<Entity> loadEntities(String id, GMap map, ArrayList<Entity> currentEntities) {
		Gdx.files.local("maps/").file().mkdirs();
		FileHandle file = Gdx.files.local("maps/" + id + ".entities");

		if (file.exists()) {
			EntitySnapshot[] snapshots = json.fromJson(EntitySnapshot[].class, file.readString());
			ArrayList<Entity> entities = new ArrayList<Entity>();
			for (EntitySnapshot snapshot : snapshots) {

				entities.add(EntityType.createEntityUsingSnapshot(snapshot, map));
			}
			return entities;
		} else {
			saveEntities(id, currentEntities);
			return currentEntities;
		}
	}

	//When the game runs, it saves a snapshot of the player
	public static void saveEntities(String id, ArrayList<Entity> entities) {
		ArrayList<EntitySnapshot> snapshots = new ArrayList<EntitySnapshot>();

		for (Entity entity : entities)
			snapshots.add(entity.getSaveSnapshot());

		Gdx.files.local("maps/").file().mkdirs();
		FileHandle file = Gdx.files.local("maps/" + id + ".entities");
		file.writeString(json.prettyPrint(snapshots), false);
	}

}