/*:
 * @target MV MZ
 * @plugindesc [SRPG] Réactions limitées à la portée des armes + preview propre v1.6-FIX (acteurs + ennemis OK)
 * @author Johan & GPT
 * @help
 * Place ce plugin SOUS SRPG_core et SOUS tous les plugins SRPG_Gear / SRPG_BattleUI.
 *
 * Principe :
 * - La portée d'une unité dépend EXCLUSIVEMENT de son arme :
 *     <srpgRange:x> → portée max
 *     <srpgMinRange:x> → portée min (optionnel)
 *
 * - Héros :
 *       portée lue via battler.weapons()
 *
 * - Ennemis :
 *       portée lue via <srpgWeapon:ID> dans leurs notes
 *
 * - Si la distance sujet → cible dépasse la portée :
 *       → action ANNULÉE = unité “éteinte”
 *
 * - Preview :
 *       → si le défenseur ne peut pas réagir :
 *            on affiche la compétence ID2 (Garde) côté défenseur
 *            avec hit = 0, dmg = 0, crit/range/etc. = 0
 */

(function() {
  console.log("SRPG_ReactionRangePatch v1.6-FIX : init");

  // =========================================================
  // Helpers SRPG
  // =========================================================

  function srpgPos(battler) {
    if (!battler || !battler.event || !battler.event()) return null;
    var ev = battler.event();
    return { x: ev.posX(), y: ev.posY() };
  }

  function srpgDistance(a, b) {
    var pa = srpgPos(a);
    var pb = srpgPos(b);
    if (!pa || !pb) return Infinity;
    return Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
  }

  /**
   * Portée (min,max) en fonction de l'arme.
   * - ACTEURS : on lit battler.weapons()
   * - ENNEMIS : on lit <srpgWeapon:ID> ou <srpgWeaponEquip:ID>
   * - Si rien trouvé → 1–1
   */
  function battlerWeaponRange(battler) {
    var range = { min: 1, max: 1 };
    if (!battler) return range;

    var weapons = [];

    // --- HÉROS : armes équipées ---
    if (battler.isActor && battler.isActor()) {
      weapons = battler.weapons ? battler.weapons() : [];
    }

    // --- ENNEMIS : <srpgWeapon:x> ---
    else if (battler.isEnemy && battler.isEnemy()) {
      var enemy = battler.enemy ? battler.enemy() : null;
      if (enemy && enemy.meta) {
        var tag = enemy.meta.srpgWeapon || enemy.meta.srpgWeaponEquip;
        if (tag) {
          var id = Number(String(tag).split(",")[0].trim());
          if (id > 0 && $dataWeapons[id]) {
            weapons.push($dataWeapons[id]);
          }
        }
      }
    }

    // Aucune arme trouvée → 1-1
    if (!weapons.length) return range;

    var maxRange = 1;
    var minRange = 1;

    weapons.forEach(function(w) {
      if (!w || !w.meta) return;

      if (w.meta.srpgRange) {
        var rMax = Number(w.meta.srpgRange);
        if (rMax > maxRange) maxRange = rMax;
      }
      if (w.meta.srpgMinRange) {
        var rMin = Number(w.meta.srpgMinRange);
        if (rMin >= 1) minRange = rMin;
      }
    });

    range.min = minRange;
    range.max = maxRange;
    return range;
  }

  function canBattlerReach(battler, target) {
    if (!battler || !target) return true;
    var dist = srpgDistance(battler, target);
    if (!isFinite(dist)) return true;

    var r = battlerWeaponRange(battler);
    var ok = dist >= r.min && dist <= r.max;

    if (!ok) {
      console.log(
        "[SRPG_ReactionRangePatch] Action hors portée :",
        battler.name ? battler.name() : battler,
        "→",
        target.name ? target.name() : target,
        "| dist =", dist,
        "| range =", r.min + "-" + r.max
      );
    }

    return ok;
  }

  // =========================================================
  // 1) BLOQUER TOUTE ACTION (attaque + contre) HORS PORTÉE
  // =========================================================

  var _GA_apply = Game_Action.prototype.apply;
  Game_Action.prototype.apply = function(target) {
    if ($gameSystem && $gameSystem.isSRPGMode && $gameSystem.isSRPGMode()) {
      var subject = this.subject();

      if (!canBattlerReach(subject, target)) {
        return; // unité “éteinte”
      }
    }

    _GA_apply.call(this, target);
  };

})();
