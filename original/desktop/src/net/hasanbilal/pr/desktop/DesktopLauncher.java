package net.hasanbilal.pr.desktop;

import com.badlogic.gdx.backends.lwjgl.LwjglApplication;
import com.badlogic.gdx.backends.lwjgl.LwjglApplicationConfiguration;
import net.hasanbilal.pr.PrisonRevelations;

/**
 * START HERE- Beginning Class
 * To run the game, go on this class and click 'Run' Make sure it is ran as a
 * Desktop app or desktop launcher
 * 
 * @author Hasan Zafar
 * @author Bilal Junejo
 *
 */
public class DesktopLauncher {
	public static void main(String[] arg) {
		LwjglApplicationConfiguration config = new LwjglApplicationConfiguration();
		new LwjglApplication(new PrisonRevelations(), config);
	}
}
