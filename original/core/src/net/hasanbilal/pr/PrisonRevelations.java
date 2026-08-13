package net.hasanbilal.pr;

import java.io.FileInputStream;
import java.io.InputStream;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input.TextInputListener;
import com.badlogic.gdx.audio.Music;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.OrthographicCamera;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.glutils.ShapeRenderer;
import com.badlogic.gdx.graphics.glutils.ShapeRenderer.ShapeType;
import com.badlogic.gdx.math.Circle;
import com.badlogic.gdx.math.Vector3;

import net.hasanbilal.pr.entities.Porter;
import net.hasanbilal.pr.world.GMap;
import net.hasanbilal.pr.world.TileType;
import net.hasanbilal.pr.world.TiledGMap;

// This is the "GAME" Class. This is the root of all classes. It has the camera, the sprites, the music, and all the over-powering factors of the game

public class PrisonRevelations extends ApplicationAdapter {

	OrthographicCamera c;
	SpriteBatch b;
	private Music wd; //wd is an acronym for "Watch Dogs" it refers to the soundtrack from the WATCH_DOGS video game
	GMap gm;
	public static int level;
	String win;

	@Override

	/**
	 * Starts off the first level. Plays the music
	 */
	public void create() {

		level = 1;

		b = new SpriteBatch();

		c = new OrthographicCamera();

		c.setToOrtho(false, Gdx.graphics.getWidth() / 3, Gdx.graphics.getHeight() / 3);

		wd = Gdx.audio.newMusic(Gdx.files.internal("Watch Dogs Police Chase Music OST.mp3"));
		wd.setLooping(true);
		wd.play();

		c.update();
		gm = new TiledGMap();

	}

	/**
	 * Renders everything Positions the camera to the main character "Porter"
	 */

	@Override
	public void render() {
		Gdx.gl.glClearColor(255, 255, 255, 1);
		Gdx.gl.glBlendFunc(GL20.GL_SRC_ALPHA, GL20.GL_ONE_MINUS_SRC_ALPHA);
		Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);

		c.position.set(Porter.pos.x, Porter.pos.y, 0);

		c.update();
		gm.update(Gdx.graphics.getDeltaTime());
		gm.render(c, b);
	}

	/**
	 * Disposing the spritebatch and the gamemap was crucial to make the game screen
	 * appear
	 */

	@Override
	public void dispose() {
		b.dispose();
		gm.dispose();

	}

}
