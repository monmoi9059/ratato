import './setup_globals.js';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Rat, WEAPONS, CHARACTERS } from './ratato_logic.mjs';

describe('Rat.addWeapon Logic', () => {
    let rat;

    beforeEach(() => {
        // Use a standard character
        // We need to ensure 'standard' exists in CHARACTERS, or use a known key.
        // Checking ratato.html previously, keys were 'standard', 'fast', 'tank', etc.
        // Let's assume 'standard' exists or use the first key from CHARACTERS if dynamic.
        const charKey = Object.keys(CHARACTERS)[0];
        rat = new Rat(charKey);

        // Reset weapons for clean state
        rat.weapons = [];
        rat.weaponTimers = {};
        rat.maxWeapons = 2; // Set a small limit for testing
    });

    test('should add a new weapon when slots are available', () => {
        rat.addWeapon('shuriken');
        assert.strictEqual(rat.weapons.length, 1);
        assert.strictEqual(rat.weapons[0].key, 'shuriken');
    });

    test('should stack an existing weapon (duplicate type)', () => {
        rat.addWeapon('shuriken');
        rat.addWeapon('shuriken');

        assert.strictEqual(rat.weapons.length, 2);
        assert.strictEqual(rat.weapons[0].key, 'shuriken');
        assert.strictEqual(rat.weapons[1].key, 'shuriken');
    });

    test('should prevent adding a NEW weapon type if slots are full', () => {
        rat.addWeapon('shuriken');
        rat.addWeapon('crossbow');

        // Slots are now full (2 unique types)
        assert.strictEqual(rat.weapons.length, 2);

        // Try to add a 3rd unique type
        rat.addWeapon('minigun');

        // Should still be 2
        assert.strictEqual(rat.weapons.length, 2);
        assert.strictEqual(rat.weapons.find(w => w.key === 'minigun'), undefined);
    });

    test('should allow adding a DUPLICATE weapon type even if slots are seemingly "full" of types', () => {
        rat.addWeapon('shuriken');
        rat.addWeapon('crossbow');

        // Slots are full (2 unique types)

        // Try to add another shuriken (stacking)
        rat.addWeapon('shuriken');

        // Should have 3 weapons total, but still only 2 unique types
        assert.strictEqual(rat.weapons.length, 3);
        const shurikens = rat.weapons.filter(w => w.key === 'shuriken');
        assert.strictEqual(shurikens.length, 2);
    });

    test('should initialize buffs correctly', () => {
        assert.deepStrictEqual(rat.buffs, {
            explosiveBullets: 0,
            iceAura: 0,
            extremeSpeed: 0
        });
    });

    test('should handle bounce count initialization for relevant weapons', () => {
        // Shuriken has bounceCount > 0
        rat.addWeapon('shuriken');
        const weapon = rat.weapons[0];
        // If shuriken definition has bounceCount, it should be copied to currentBounces
        if (weapon.bounceCount > 0) {
            assert.strictEqual(weapon.currentBounces, weapon.bounceCount);
        }
    });
});
