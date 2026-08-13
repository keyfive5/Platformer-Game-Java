package net.hasanbilal.pr.entities;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input.Keys;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.math.Vector2;

import net.hasanbilal.pr.world.GMap;

//The class for the actual player.

public class Porter extends Entity {

	private static final int SPEED = 80;
	private static final int JUMP_VELOCITY = 5;
	Texture img;
	public int direction = 2; // left is 1, right is 2

	// Takes the player from the Json file and adds him to the game
	public void create(EntitySnapshot snapshot, EntityType type, GMap map) {
		super.create(snapshot, type, map);
		img = new Texture("porter.png");

	}

	// Renders and draws the player into the game
	@Override
	public void render(SpriteBatch b) {
		b.draw(img, pos.x, pos.y, getWidth(), getHeight());

	}

	//Updates the character when it moves or affected by gravity
	public void update(float delta, float g) {
		if (Gdx.input.isKeyPressed(Keys.UP) && grounded)
			this.velocityY += JUMP_VELOCITY * getWeight();
		else if (Gdx.input.isKeyPressed(Keys.UP) && !grounded && this.velocityY > 0)
			this.velocityY += JUMP_VELOCITY * getWeight() * delta;

		super.update(delta, g);

		if (Gdx.input.isKeyPressed(Keys.LEFT)) {
			moveX(-SPEED * delta);

		}

		if (Gdx.input.isKeyPressed(Keys.RIGHT))
			moveX(SPEED * delta);

	}

	//The method that moves player left and right
	protected void moveX(float amount) {
		float newX = pos.x + amount;
		if (!m.doesRectCollideWithMap(newX, pos.y, getWidth(), getHeight()))
			Porter.pos.x = newX;
	}

}
