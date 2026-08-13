package net.hasanbilal.pr.world;

import com.badlogic.gdx.graphics.OrthographicCamera;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.maps.tiled.TiledMap;
import com.badlogic.gdx.maps.tiled.TiledMapTile;
import com.badlogic.gdx.maps.tiled.TiledMapTileLayer;
import com.badlogic.gdx.maps.tiled.TiledMapTileLayer.Cell;
import com.badlogic.gdx.maps.tiled.TmxMapLoader;
import com.badlogic.gdx.maps.tiled.renderers.OrthogonalTiledMapRenderer;

import net.hasanbilal.pr.PrisonRevelations;
import net.hasanbilal.pr.entities.Entity;
import net.hasanbilal.pr.entities.Porter;

//This class is for the actual map in the game made in Tiled

public class TiledGMap extends GMap {

	public static TiledMap lvl1;
	public static OrthogonalTiledMapRenderer otmr;
	public static TiledMapTileLayer mainLayer;

	//Constructor for the map. It shows that the game starts at level one
	public TiledGMap() {

		lvl1 = new TmxMapLoader().load("level1.tmx");

		otmr = new OrthogonalTiledMapRenderer(lvl1);
		mainLayer = (TiledMapTileLayer) lvl1.getLayers().get(1);

	}

	//Renders the map
	@Override
	public void render(OrthographicCamera c, SpriteBatch b) {
		otmr.setView(c);
		otmr.render();

		b.setProjectionMatrix(c.combined);
		b.begin();
		super.render(c, b);
		b.end();

	}

	//Updates the map so it doesn't remain static
	@Override
	public void update(float deltaTime) {
		super.update(deltaTime);

	}

	//required to show the map
	@Override
	public void dispose() {
		lvl1.dispose();

	}

	//Gets the tile by coordinate so we could debug and use for collision detection
	@Override
	public TileType getByCoordinate(int layer, int col, int row) {
		Cell cell = ((TiledMapTileLayer) lvl1.getLayers().get(layer)).getCell(col, row);

		if (cell != null) {
			TiledMapTile t = cell.getTile();

			if (t != null) {
				int id = t.getId();
				return TileType.getTileTypeById(id);
			}
		}
		return null;
	}

	//Gets the width of the map in tiles
	@Override
	public int getWidth() {

		return ((TiledMapTileLayer) lvl1.getLayers().get(0)).getWidth();
	}

	//Gets the height of the map in tiles
	@Override
	public int getHeight() {

		return ((TiledMapTileLayer) lvl1.getLayers().get(0)).getHeight();
	}

	//Gets the amount of layers of the Map made in the software Tiled
	@Override
	public int getLayers() {

		return lvl1.getLayers().getCount();
	}

}
