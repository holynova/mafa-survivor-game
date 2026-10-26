import Phaser from 'phaser';
import { game, WORLD } from './game';
import type { Enemy } from './types';

export interface Manifest {
  animations: Record<string, string[]>;
  frames: Record<string, { dx: number; dy: number; width: number; height: number }>;
  rightsStatus?: string;
}

export let assets: Manifest | null = null;
let rendererReady = false;
export const readyListeners = new Set<() => void>();
export const isReady = () => rendererReady;
export let frameMS = 0;

class BattleScene extends Phaser.Scene {
  private bodies = new Map<string, Phaser.GameObjects.Image>();
  private pool: Phaser.GameObjects.Image[] = [];
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private gfx!: Phaser.GameObjects.Graphics;
  private groundGfx!: Phaser.GameObjects.Graphics;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private accumulator = 0;
  private lastRun = '';
  private seen = new Set<string>();
  private drag: { id: number; x: number; y: number } | null = null;
  private corpses: { kind: string; dir: number; x: number; y: number; at: number }[] = [];
  private lastEnemies = new Map<number, Enemy>();
  private useSprites = false;

  constructor() {
    super('battle');
  }

  preload() {
    // Attempt loading atlas; fallback cleanly if absent
    this.load.atlas('mir', '/assets/mir/atlas.png', '/assets/mir/atlas.json');
    this.load.json('manifest', '/assets/mir/manifest.json');

    this.load.on('loaderror', (file: any) => {
      if (file.key === 'mir' || file.key === 'manifest') {
        this.useSprites = false;
      }
    });
  }

  create() {
    const cachedManifest = this.cache.json.get('manifest');
    if (cachedManifest && this.textures.exists('mir')) {
      assets = cachedManifest;
      this.useSprites = true;
    } else {
      this.useSprites = false;
    }

    this.cameras.main.setBounds(0, 0, WORLD.w, WORLD.h);
    this.cameras.main.setZoom(this.zoom());

    this.groundGfx = this.add.graphics().setDepth(-100);
    this.gfx = this.add.graphics().setDepth(5000);

    this.paintGround();

    this.keys = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture(['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);

    this.input.keyboard!.on('keydown-ESC', () => game.pause());
    this.input.keyboard!.on('keydown-P', () => game.pause());

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (game.phase === 'upgrade' && ['1', '2', '3'].includes(e.key)) {
        const c = game.choices[Number(e.key) - 1];
        if (c) game.choose(c.id);
      }
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (game.phase === 'battle' && p.downElement?.tagName === 'CANVAS') {
        this.drag = { id: p.id, x: p.x, y: p.y };
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.drag?.id === p.id) this.drag = null;
    });

    this.input.on('pointerupoutside', () => {
      this.drag = null;
    });

    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      this.clearInput();
      if (game.phase === 'battle') game.pause();
    });

    window.addEventListener('blur', () => this.clearInput());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearInput();
        if (game.phase === 'battle') game.pause();
      }
    });

    this.scale.on('resize', () => this.cameras.main.setZoom(this.zoom()));

    rendererReady = true;
    for (const f of readyListeners) f();
    game.emit();
  }

  private zoom() {
    return this.scale.width < 768 ? 1.15 : 1.45;
  }

  private clearInput() {
    this.drag = null;
    game.input = { x: 0, y: 0 };
    this.input.keyboard?.resetKeys();
  }

  private paintGround() {
    this.groundGfx.clear();
    const tileSize = 64;

    if (this.useSprites && assets) {
      const grass = ['ground/100', 'ground/150', 'ground/200', 'ground/250'].filter(
        (x) => assets!.frames[x]
      );
      const fallback = 'ground/3';
      const frameKey = grass[0] ?? fallback;
      const tile = assets.frames[frameKey];
      if (tile) {
        const w = tile.width;
        const h = tile.height;
        for (let y = 0; y < WORLD.h; y += h) {
          for (let x = 0; x < WORLD.w; x += w) {
            const key = grass[(Math.floor(x / w) * 13 + Math.floor(y / h) * 7) % grass.length] ?? fallback;
            this.add.image(x, y, 'mir', key).setOrigin(0).setDepth(-100);
          }
        }
      }
    } else {
      // Procedural retro wasteland earth & stone tilemap
      for (let y = 0; y < WORLD.h; y += tileSize) {
        for (let x = 0; x < WORLD.w; x += tileSize) {
          const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const noise = hash - Math.floor(hash);
          const color = noise > 0.7 ? 0x243026 : noise > 0.35 ? 0x1f2b21 : 0x1a241c;
          this.groundGfx.fillStyle(color, 1);
          this.groundGfx.fillRect(x, y, tileSize, tileSize);

          // Subtle grid dots
          this.groundGfx.fillStyle(0x2f3d32, 0.3);
          this.groundGfx.fillRect(x + 2, y + 2, 2, 2);
        }
      }
    }

    // World Boundary Border
    this.groundGfx.lineStyle(3, 0xc49e54, 0.65);
    this.groundGfx.strokeRect(20, 30, WORLD.w - 40, WORLD.h - 50);
  }

  private draw(key: string, frame: string, x: number, y: number, depth: number, alpha = 1, scale = 1, offset = true) {
    if (!this.useSprites || !assets?.frames[frame]) return;
    this.seen.add(key);
    let image = this.bodies.get(key);
    if (!image) {
      image = this.pool.pop() ?? this.add.image(0, 0, 'mir', frame);
      this.bodies.set(key, image);
    }
    const f = assets.frames[frame];
    image
      .setTexture('mir', frame)
      .setVisible(true)
      .setOrigin(offset ? 0 : 0.5)
      .setPosition(offset ? x + (f.dx - 24) * scale : x, offset ? y + (f.dy - 16) * scale : y)
      .setDepth(depth)
      .setAlpha(alpha)
      .setScale(scale)
      .clearTint();
  }

  private actor(key: string, name: string, motion: string, dir: number, x: number, y: number, time: number, depth: number, alpha = 1, scale = 1) {
    if (this.useSprites && assets) {
      const frames = assets.animations[`${name}/${motion}/${dir}`] ?? assets.animations[`${name}/idle/${dir}`];
      if (frames?.length) {
        this.draw(key, frames[Math.floor(time * 9) % frames.length], x, y, depth, alpha, scale);
        return;
      }
    }

    // Fallback: Procedural retro pixel actor
    this.drawProceduralActor(name, dir, x, y, motion, alpha, scale);
  }

  private drawProceduralActor(name: string, dir: number, x: number, y: number, motion: string, alpha: number, scale: number) {
    const isPlayer = name === 'hero' || name === 'wizard';
    const isBoss = name === 'boss';

    // Shadow
    this.gfx.fillStyle(0x0a0c0a, 0.45 * alpha);
    this.gfx.fillEllipse(x, y + 4, (isBoss ? 44 : 26) * scale, (isBoss ? 20 : 12) * scale);

    if (isPlayer) {
      // Wizard: Blue Robe, Hat, Staff
      this.gfx.fillStyle(0x2b4c7e, alpha); // Robe
      this.gfx.fillRect(x - 9 * scale, y - 24 * scale, 18 * scale, 24 * scale);

      this.gfx.fillStyle(0xd4af37, alpha); // Gold trim
      this.gfx.fillRect(x - 8 * scale, y - 4 * scale, 16 * scale, 3 * scale);

      // Wizard Hat
      this.gfx.fillStyle(0x1a2e4d, alpha);
      this.gfx.fillTriangle(
        x - 12 * scale,
        y - 24 * scale,
        x + 12 * scale,
        y - 24 * scale,
        x,
        y - 42 * scale
      );

      // Wizard Staff & Orb
      const staffAngle = (dir * Math.PI) / 4;
      const sx = x + Math.cos(staffAngle) * 16 * scale;
      const sy = y - 12 * scale + Math.sin(staffAngle) * 14 * scale;

      this.gfx.lineStyle(2 * scale, 0x8b5a2b, alpha);
      this.gfx.strokeLineShape(new Phaser.Geom.Line(x, y - 10 * scale, sx, sy));
      this.gfx.fillStyle(0x5eead4, alpha);
      this.gfx.fillCircle(sx, sy, 4 * scale);
    } else if (isBoss) {
      // Crimson Skeleton Elf (骷髅精灵)
      this.gfx.fillStyle(0xb91c1c, alpha);
      this.gfx.fillCircle(x, y - 36 * scale, 14 * scale); // Skull

      // Menacing Horns
      this.gfx.lineStyle(3 * scale, 0x7f1d1d, alpha);
      this.gfx.strokeLineShape(new Phaser.Geom.Line(x - 8 * scale, y - 44 * scale, x - 18 * scale, y - 56 * scale));
      this.gfx.strokeLineShape(new Phaser.Geom.Line(x + 8 * scale, y - 44 * scale, x + 18 * scale, y - 56 * scale));

      // Skeletal Ribs & Armor
      this.gfx.fillStyle(0x991b1b, alpha);
      this.gfx.fillRect(x - 16 * scale, y - 24 * scale, 32 * scale, 24 * scale);

      // Glowing Eyes
      this.gfx.fillStyle(0xfacc15, alpha);
      this.gfx.fillCircle(x - 4 * scale, y - 37 * scale, 2.5 * scale);
      this.gfx.fillCircle(x + 4 * scale, y - 37 * scale, 2.5 * scale);

      // Twin Curved Blades
      this.gfx.lineStyle(3 * scale, 0xef4444, alpha);
      this.gfx.strokeLineShape(new Phaser.Geom.Line(x - 20 * scale, y - 26 * scale, x - 28 * scale, y - 6 * scale));
      this.gfx.strokeLineShape(new Phaser.Geom.Line(x + 20 * scale, y - 26 * scale, x + 28 * scale, y - 6 * scale));
    } else {
      // Standard Monsters (稻草人, 多钩猫, 钉耙猫, 半兽人)
      let color = 0x854d0e; // Scarecrow default
      if (name === 'cat' || name === 'rakecat') color = 0xd97706; // Cats
      if (name === 'orc') color = 0x15803d; // Orc Green

      this.gfx.fillStyle(color, alpha);
      this.gfx.fillRect(x - 8 * scale, y - 22 * scale, 16 * scale, 22 * scale);

      // Head
      this.gfx.fillStyle(color, alpha);
      this.gfx.fillCircle(x, y - 27 * scale, 7 * scale);

      // Eyes
      this.gfx.fillStyle(0xfef08a, alpha);
      this.gfx.fillRect(x - 4 * scale, y - 28 * scale, 2 * scale, 2 * scale);
      this.gfx.fillRect(x + 2 * scale, y - 28 * scale, 2 * scale, 2 * scale);
    }
  }

  private fx(key: string, name: string, x: number, y: number, time: number, depth: number, scale = 1) {
    if (this.useSprites && assets) {
      const frames = assets.animations[name];
      if (frames?.length) {
        this.draw(key, frames[Math.floor(time * 10) % frames.length], x, y, depth, 1, scale);
        return;
      }
    }

    // Procedural Fallback FX
    if (name.startsWith('fireball')) {
      this.gfx.fillStyle(0xf97316, 0.9);
      this.gfx.fillCircle(x, y, 7 * scale);
      this.gfx.fillStyle(0xfde047, 1);
      this.gfx.fillCircle(x, y, 3.5 * scale);
    } else if (name === 'lightning') {
      this.gfx.lineStyle(3 * scale, 0x38bdf8, 1);
      this.gfx.strokeLineShape(new Phaser.Geom.Line(x, y - 300, x, y));
      this.gfx.lineStyle(1.5 * scale, 0xffffff, 1);
      this.gfx.strokeLineShape(new Phaser.Geom.Line(x, y - 300, x, y));
      this.gfx.fillStyle(0x7dd3fc, 0.6);
      this.gfx.fillCircle(x, y, 16 * scale);
    } else if (name === 'firewall') {
      this.gfx.fillStyle(0xea580c, 0.4);
      this.gfx.fillCircle(x, y, 36 * scale);
      this.gfx.fillStyle(0xfacc15, 0.7);
      this.gfx.fillCircle(x, y, 18 * scale);
    } else if (name === 'shield') {
      this.gfx.lineStyle(2 * scale, 0xfacc15, 0.8);
      this.gfx.strokeCircle(x, y - 10, 26 * scale);
      this.gfx.fillStyle(0xfef08a, 0.15);
      this.gfx.fillCircle(x, y - 10, 26 * scale);
    }
  }

  update(_time: number, delta: number) {
    if (!rendererReady) return;
    frameMS = frameMS * 0.95 + delta * 0.05;

    if (this.lastRun !== game.runId) {
      this.lastRun = game.runId;
      this.clearInput();
      this.corpses = [];
      this.lastEnemies.clear();
      this.accumulator = 0;
    }

    if (game.phase === 'battle') {
      let x =
        (this.wasd.D.isDown || this.keys.right.isDown ? 1 : 0) -
        (this.wasd.A.isDown || this.keys.left.isDown ? 1 : 0);
      let y =
        (this.wasd.S.isDown || this.keys.down.isDown ? 1 : 0) -
        (this.wasd.W.isDown || this.keys.up.isDown ? 1 : 0);

      const p = this.input.activePointer;
      if (this.drag && p.isDown) {
        x = Phaser.Math.Clamp((p.x - this.drag.x) / 45, -1, 1);
        y = Phaser.Math.Clamp((p.y - this.drag.y) / 45, -1, 1);
      }
      game.input = { x, y };

      this.accumulator += Math.min(delta / 1000, 0.1);
      while (this.accumulator >= 1 / 60) {
        game.step(1 / 60);
        this.accumulator -= 1 / 60;
      }
    } else {
      this.accumulator = 0;
      this.drag = null;
    }

    this.seen.clear();
    this.gfx.clear();
    const t = game.clock;

    if (game.phase === 'lobby') {
      this.cameras.main.centerOn(WORLD.w / 2, WORLD.h / 2);
      this.actor('hero', 'wizard', 'idle', 5, WORLD.w / 2, WORLD.h / 2, _time / 1000, 100);
      [
        ['scarecrow', 230, -140],
        ['cat', 300, 90],
        ['orc', -110, 160],
        ['rakecat', -210, -130],
      ].forEach(([name, ox, oy], i) => {
        this.actor(
          `lobby-${i}`,
          String(name),
          'idle',
          i,
          WORLD.w / 2 + Number(ox),
          WORLD.h / 2 + Number(oy),
          _time / 1000,
          Number(oy) + 100
        );
      });
    } else {
      this.cameras.main.centerOn(game.player.x, game.player.y);

      // Track corpses
      for (const [id, e] of this.lastEnemies) {
        if (!game.enemies.some((n) => n.id === id) && e.hp <= 0) {
          this.corpses.push({ kind: e.kind, dir: e.dir, x: e.x, y: e.y, at: t });
        }
      }
      this.lastEnemies = new Map(game.enemies.map((e) => [e.id, e]));
      this.corpses = this.corpses.filter((c) => t - c.at < 1);
      this.corpses.slice(-40).forEach((c, i) => {
        this.actor(
          `corpse-${i}`,
          c.kind,
          'death',
          c.dir,
          c.x,
          c.y,
          Math.min(0.9, t - c.at),
          c.y,
          1 - (t - c.at)
        );
      });

      // Render Enemies
      for (const e of game.enemies) {
        const motion = e.windup > 0 ? 'attack' : t - e.hitAt < 0.17 ? 'hurt' : 'walk';
        const scale = e.elite ? 1.25 : 1;
        this.actor(`enemy-${e.id}`, e.kind, motion, e.dir, e.x, e.y, t - e.born, e.y, 1, scale);

        // Health bars
        if (e.elite || e.hp < e.maxHp) {
          const w = e.kind === 'boss' ? 72 : 32;
          this.gfx.fillStyle(0x140e0c, 0.85).fillRect(e.x - w / 2, e.y - 52, w, 4);
          this.gfx
            .fillStyle(e.elite ? 0xeab308 : 0xef4444, 1)
            .fillRect(e.x - w / 2, e.y - 52, w * Math.max(0, e.hp / e.maxHp), 4);
        }

        // Windup telegraph
        if (e.windup > 0) {
          this.gfx
            .lineStyle(2, 0xf97316, 0.75)
            .strokeEllipse(e.x, e.y + 2, e.kind === 'boss' ? 140 : 54, e.kind === 'boss' ? 70 : 26);
        }
      }

      // Render Drops (Gems / Gold)
      for (const d of game.drops) {
        if (this.useSprites) {
          this.draw(`drop-${d.id}`, 'item/金币', d.x, d.y, 10, 1, 0.75, false);
        }
        if (!this.useSprites || !assets?.frames['item/金币']) {
          if (d.exp > 0) {
            // Blue Exp Gem
            this.gfx.fillStyle(0x38bdf8, 0.9).fillCircle(d.x, d.y, 4);
            this.gfx.fillStyle(0xf0f9ff, 1).fillCircle(d.x, d.y, 1.5);
          } else {
            // Gold Coin
            this.gfx.fillStyle(0xfacc15, 0.95).fillCircle(d.x, d.y, 3.5);
          }
        }
      }

      // Render Projectiles
      for (const p of game.projectiles) {
        this.fx(`p-${p.id}`, `fireball/${p.dir}`, p.x, p.y, t, 2200, 0.85);
      }

      // Render Firewalls & Lightning
      for (const f of game.effects) {
        if (f.kind === 'firewall') {
          const r = f.radius / 64;
          [[0, 0], [-28, 0], [28, 0], [0, -16], [0, 16]].forEach(([ox, oy], i) => {
            this.fx(`fx-${f.id}-${i}`, 'firewall', f.x + ox * r, f.y + oy * r, t + i * 0.1, 40, r);
          });
        } else if (f.kind === 'lightning') {
          this.fx(`fx-${f.id}`, 'lightning', f.x, f.y, f.total - f.life, 2100);
        }
      }

      // Render Player
      this.actor(
        'hero',
        'wizard',
        game.phase === 'dead' ? 'death' : game.player.moving ? 'walk' : t < game.player.castUntil ? 'cast' : 'idle',
        game.player.dir,
        game.player.x,
        game.player.y,
        t,
        game.player.y + 0.5,
        t < game.player.hitUntil ? 0.65 : 1
      );

      // Render Player Shield Aura
      if (t < game.player.shieldUntil) {
        this.fx('shield', 'shield', game.player.x, game.player.y, t, game.player.y + 1, 1);
      }

      // Player Base Ring
      this.gfx.lineStyle(1.5, 0xd4af37, 0.7).strokeEllipse(game.player.x, game.player.y + 3, 30, 15);

      // Floating Labels
      for (const f of game.floating) {
        let label = this.labels.get(f.id);
        if (!label) {
          label = this.add
            .text(0, 0, '', {
              fontFamily: 'serif, sans-serif',
              fontSize: '15px',
              fontStyle: 'bold',
              stroke: '#0f0e0c',
              strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(6000);
          this.labels.set(f.id, label);
        }
        label.setPosition(f.x, f.y).setText(f.text).setColor(f.color).setAlpha(Math.min(1, f.life * 2));
      }
    }

    // Clean up expired labels & bodies
    for (const [id, label] of this.labels) {
      if (!game.floating.some((f) => f.id === id)) {
        label.destroy();
        this.labels.delete(id);
      }
    }

    for (const [key, image] of this.bodies) {
      if (!this.seen.has(key)) {
        image.setVisible(false);
        this.pool.push(image);
        this.bodies.delete(key);
      }
    }
  }
}

let engine: Phaser.Game | null = null;

export function boot() {
  if (engine) return;
  engine = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'world',
    backgroundColor: '#161e18',
    pixelArt: true,
    antialias: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scene: [BattleScene],
    audio: { noAudio: true },
    render: { roundPixels: true },
    fps: { target: 60 },
  });
}
