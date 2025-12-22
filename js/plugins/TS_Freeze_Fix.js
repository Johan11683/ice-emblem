/*:
 * @pluginname Freeze Fix
 * @plugindesc Fixes the random screen freezes that can happen in RPG Maker MV. (Version: 1.0.0)
 *
 * @author Tamschi (tamschi.itch.io)
 *
 * @help
 *
 * This plugin fixes a common source of sporadic screen (graphics) freezes in
 * RPG Maker MV games.
 *
 * =======
 * The Bug
 * =======
 *
 * RPG Maker MV uses `DateTime.now()` to check how long rendering takes, to skip
 * frames accordingly if it takes too long. However, the skip count,
 * `Graphics._skipCount`, can become negative when `DateTime.now()` runs
 * backwards.
 *
 * This can happen for example when the system time is updated while rendering,
 * which can be caused manually, and also seems to happen sporadically.
 *
 * (The timing is fairly precise, so you may need a few hundred tries when trying
 * to cause a freeze manually. I was fortunate enough to run into the issue while
 * playtesting, so I could debug it then and there.)
 *
 * As the game only checks whether `Graphics._skipCount === 0`, and otherwise
 * decrements this counter, any negative value will cause indefinite frame skips.
 *
 * =======
 * The Fix
 * =======
 *
 * This plugin overrides `Graphics.render` to ensure `Graphics._skipCount >= 0`
 * after the original function runs.
 *
 * You could still write `Graphics._skipCount = Infinity` to cause a permanent
 * freeze, but that can't happen randomly with the 1.6.2 engine code, as it
 * clamps the calculated value to prevent too many skips in a row.
 *
 * =======
 * Logging
 * =======
 *
 * An info message is logged to the console whenever this plugin prevents a
 * freeze. This should happen very rarely, usually once every few hours.
 *
 * ==========
 * Load Order
 * ==========
 *
 * Load order usually doesn't matter for this plugin.
 * When in doubt, load TS_Freeze_Fix early/high in the plugin list.
 *
 * =============
 * License Grant
 * =============
 *
 * A license for this plugin can be acquired at
 * https://tamschi.itch.io/freeze-fix .
 *
 * Once you have acquired it, you may redistribute and sublicense this plugin
 * file as part of a game.
 *
 * You may modify this plugin when including it with your game, as long as the
 * attribution above and this license grant stay intact. If you do so, you must
 * add comments to indicate which changes you made from the original.
 *
 * =========
 * Changelog
 * =========
 *
 * -------------
 * Version 1.0.0
 * -------------
 *
 * 2022-07-22
 *
 * Initial release.
 */

(function () {
	'use strict';

	const oldRender = Graphics.render;
	Graphics.render = function () {
		const result = oldRender.apply(this, arguments);
		if (!(this._skipCount >= 0)) {
			const defectiveCount = this._skipCount;
			this._skipCount = 0;
			console.info("Freeze prevented. (Graphics._skipCount was ", defectiveCount, ".)");
		}
		return result;
	};
})();
