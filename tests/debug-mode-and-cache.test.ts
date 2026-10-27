import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../src/game';
import { getPreloadState, isAssetsReady, subscribePreload } from '../src/assetLoader';
import { fetchWithCache, getCachedAssetCount } from '../src/cache';

describe('Developer Test Mode & Cheats', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game();
    game.start('wizard', 'bichon', 'normal', 176);
  });

  it('should toggle debug mode and god mode', () => {
    expect(game.isInvincible).toBe(false);
    game.toggleInvincible();
    expect(game.isInvincible).toBe(true);
    expect(game.isSandbox).toBe(true);

    game.toggleDebugMode();
    expect(game.isDebugMode).toBe(true);
  });

  it('should toggle infinite cooldown (0 CD rapid fire)', () => {
    expect(game.infiniteCooldown).toBe(false);
    game.toggleInfiniteCooldown();
    expect(game.infiniteCooldown).toBe(true);
    // When enabled, all current skills have 0 cd
    for (const s of game.skills) {
      expect(s.cd).toBe(0);
    }
  });

  it('should support jumping to arbitrary waves', () => {
    expect(game.wave).toBe(1);
    game.jumpToWave(6);
    expect(game.wave).toBe(6);
    expect(game.waveTime).toBe(0);
    expect(game.isSandbox).toBe(true);

    // Jump to boss wave (12)
    game.jumpToWave(12);
    expect(game.wave).toBe(12);
    expect(game.bossSpawned).toBe(true);
    expect(game.enemies.some(e => e.kind.startsWith('boss'))).toBe(true);
  });

  it('should kill all enemies with screen wipe cheat', () => {
    game.spawnEnemy();
    game.spawnEnemy();
    expect(game.enemies.length).toBeGreaterThan(0);

    game.killAllEnemies();
    expect(game.enemies.every(e => e.hp <= 0)).toBe(true);
  });

  it('should adjust damage and speed multipliers', () => {
    expect(game.damageMultiplier).toBe(1);
    game.setDamageMultiplier(50);
    expect(game.damageMultiplier).toBe(50);

    expect(game.speedMultiplier).toBe(1);
    const baseSpeed = game.moveSpeed;
    game.setSpeedMultiplier(2);
    expect(game.speedMultiplier).toBe(2);
    expect(game.moveSpeed).toBeCloseTo(baseSpeed * 2);
  });

  it('should support adding and maxing skills directly', () => {
    game.addSkillDirectly('lightning', 5);
    const lightning = game.skills.find(s => s.id === 'lightning');
    expect(lightning).toBeDefined();
    expect(lightning?.rank).toBe(5);

    game.maxAllSkills();
    const fireball = game.skills.find(s => s.id === 'fireball');
    expect(fireball?.rank).toBe(8);
  });

  it('should support equipping items directly', () => {
    game.equipItemDirectly('wpn-judgment');
    expect(game.equipment.weapon?.itemId).toBe('wpn-judgment');
  });

  it('should support max level cheat', () => {
    game.maxLevelCheat();
    expect(game.level).toBe(30);
  });
});

describe('Asset Preload & Cache System', () => {
  it('should provide preload state with initial progress', () => {
    const state = getPreloadState();
    expect(state).toBeDefined();
    expect(typeof state.progress).toBe('number');
    expect(typeof state.loadedCount).toBe('number');
  });

  it('should allow subscribing to preload state changes', () => {
    let triggered = false;
    const unsub = subscribePreload(() => {
      triggered = true;
    });
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('should handle getCachedAssetCount safely', async () => {
    const count = await getCachedAssetCount();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
