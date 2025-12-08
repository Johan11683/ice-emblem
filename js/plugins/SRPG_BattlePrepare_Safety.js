/*:
 * @plugindesc Safety wrapper for SRPG_BattlePrepare allMembers crash (events of null).
 * @author ChatGPT
 */

(function() {

  const _srpgAllMembers = Game_Party.prototype.allMembers;

  Game_Party.prototype.allMembers = function() {
    try {
      // On essaie d'utiliser la version du plugin
      return _srpgAllMembers.call(this);
    } catch (e) {
      console.error('SRPG_BattlePrepare allMembers error, fallback to normal party:', e);

      // Fallback : on retourne juste les acteurs du groupe classique
      return this._actors.map(id => $gameActors.actor(id));
    }
  };

})();
