/*:
 * @target MV MZ
 * @plugindesc v1.1 Triangle d'armes simple (bonus/malus de hit & dégâts selon l'arme de l'ennemi) compatible SRPG Core.
 * @author Johan & ChatGPT
 *
 * @help
 * ----------------------------------------------------------------------------
 * UTILISATION
 * ----------------------------------------------------------------------------
 * Sur une arme :
 *
 *    <WeaponTriangle: Cible, hit%, dmg%>
 *
 * Exemple :
 *    <WeaponTriangle: Épée, 15, 0>
 *    <WeaponTriangle: Lance, -15, 0; Hache, 15, 0>
 *
 * Cible = nom EXACT du type d'arme (dans Types d'Armes) ou son ID.
 * hit = bonus/malus de toucher (en %)
 * dmg = bonus/malus de dégâts (en %)
 *
 * Exemple pour Ice Emblem :
 *    Griffes battent Lance → <WeaponTriangle: Lance, 15, 0>
 *
 * ----------------------------------------------------------------------------
 * REMARQUES
 * ----------------------------------------------------------------------------
 * - Le triangle ne s'applique que si :
 *       l'attaque est physique,
 *       l'attaquant a une arme,
 *       la cible a une arme.
 *
 * - Compatible SRPG Core :
 *       Acteurs : on lit weapons()
 *       Ennemis : on lit <srpgWeapon:x> dans l'ennemi
 *
 * ----------------------------------------------------------------------------
 */

(function() {
  "use strict";

  // ---------------------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------------------

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  // Trouve un wtypeId depuis "Épée" ou "1"
  function weaponTypeIdFromToken(token) {
    if (!token) return 0;
    token = String(token).trim();

    // ID numérique
    if (/^\d+$/.test(token)) {
      return Number(token);
    }

    // Nom d'un type d'arme
    if ($dataSystem && Array.isArray($dataSystem.weaponTypes)) {
      return $dataSystem.weaponTypes.indexOf(token);
    }

    return 0;
  }

  // ---------------------------------------------------------------------------
  // Lecture des WeaponTriangle dans les armes
  // ---------------------------------------------------------------------------

  const _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
  DataManager.isDatabaseLoaded = function() {
    if (!_DataManager_isDatabaseLoaded.call(this)) return false;

    if (!this._weaponTriangleParsed) {
      parseWeaponTriangleNotes();
      this._weaponTriangleParsed = true;
    }
    return true;
  };

  function parseWeaponTriangleNotes() {
    if (!$dataWeapons) return;

    $dataWeapons.forEach(w => {
      if (!w) return;

      w._weaponTriangle = []; // { wtypeId, hit, dmg }

      const note = w.note || "";
      const regex = /<WeaponTriangle\s*:\s*([^>]+)>/gi;
      let match;

      while ((match = regex.exec(note)) !== null) {
        const content = match[1]; 
        const entries = content.split(";");

        for (let entry of entries) {
          entry = entry.trim();
          if (!entry) continue;

          const parts = entry.split(",").map(p => p.trim());
          if (parts.length < 3) continue;

          const targetToken = parts[0];
          const hit = Number(parts[1] || 0);
          const dmg = Number(parts[2] || 0);
          const wtypeId = weaponTypeIdFromToken(targetToken);

          if (wtypeId > 0) {
            w._weaponTriangle.push({ wtypeId, hit, dmg });
          }
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Récupération correcte de l'arme d'un battler (Actor ou Enemy SRPG)
  // ---------------------------------------------------------------------------

  function srpgMainWeapon(battler) {
    if (!battler) return null;

    // ---------------------------
    // ACTOR
    // ---------------------------
    if (battler.isActor && battler.isActor()) {

      // Arme équipée classique
      if (battler.weapons && battler.weapons().length > 0) {
        return battler.weapons()[0];
      }

      // Arme définie par <srpgWeapon:x> dans l'Actor
      const actorData = battler.actor && battler.actor();
      if (actorData && actorData.meta && actorData.meta.srpgWeapon) {
        const wid = Number(actorData.meta.srpgWeapon);
        return $dataWeapons[wid] || null;
      }

      return null;
    }

    // ---------------------------
    // ENEMY (SRPG Core)
    // ---------------------------
    if (battler.isEnemy && battler.isEnemy()) {
      const enemyData = battler.enemy && battler.enemy();
      if (enemyData && enemyData.meta && enemyData.meta.srpgWeapon) {
        const wid = Number(enemyData.meta.srpgWeapon);
        return $dataWeapons[wid] || null;
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Calcul du bonus triangle
  // ---------------------------------------------------------------------------

  const HITTYPE_PHYSICAL = (typeof Game_Action !== "undefined" &&
    Game_Action.HITTYPE_PHYSICAL !== undefined)
      ? Game_Action.HITTYPE_PHYSICAL
      : 0;

  Game_Action.prototype.weaponTriangleBonus = function(target) {
    const item = this.item();
    if (!item) return { hit: 0, dmg: 0 };

    // Pas de triangle pour les attaques non physiques
    if (item.hitType !== HITTYPE_PHYSICAL) return { hit: 0, dmg: 0 };

    const subject = this.subject();
    if (!subject || !target) return { hit: 0, dmg: 0 };

    const atkWeapon = srpgMainWeapon(subject);
    const defWeapon = srpgMainWeapon(target);

    if (!atkWeapon || !defWeapon) return { hit: 0, dmg: 0 };
    if (!atkWeapon._weaponTriangle || atkWeapon._weaponTriangle.length === 0) {
      return { hit: 0, dmg: 0 };
    }

    const defType = defWeapon.wtypeId || 0;
    if (defType === 0) return { hit: 0, dmg: 0 };

    const entry = atkWeapon._weaponTriangle.find(e => e.wtypeId === defType);
    if (!entry) return { hit: 0, dmg: 0 };

    return { hit: entry.hit || 0, dmg: entry.dmg || 0 };
  };

  // ---------------------------------------------------------------------------
  // Application du bonus sur le HIT
  // ---------------------------------------------------------------------------

  const _Game_Action_itemHit = Game_Action.prototype.itemHit;
  Game_Action.prototype.itemHit = function(target) {
    let base = _Game_Action_itemHit.call(this, target);
    const bonus = this.weaponTriangleBonus(target);

    if (bonus.hit) {
      base += bonus.hit / 100;
      base = clamp01(base);
    }
    return base;
  };

  // ---------------------------------------------------------------------------
  // Application du bonus sur les dégâts
  // ---------------------------------------------------------------------------

  const _Game_Action_makeDamageValue = Game_Action.prototype.makeDamageValue;
  Game_Action.prototype.makeDamageValue = function(target, critical) {
    let value = _Game_Action_makeDamageValue.call(this, target, critical);
    const bonus = this.weaponTriangleBonus(target);

    if (bonus.dmg && value !== 0) {
      value += Math.floor(value * bonus.dmg / 100);
    }

    return value;
  };

})();
