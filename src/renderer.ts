import Phaser from 'phaser';
import { game, WORLD } from './game';
import { SCENERY, getItem } from './content';
import { sound } from './audio';
import type { Enemy, Fx, Minion, Projectile, Manifest } from './types';
import { assetUrl } from './utils';
import { onManifestLoaded } from './assetLoader';

export type { Manifest };

export let assets: Manifest | null = null;
export function setAssetManifest(m: Manifest) {
  assets = m;
}

onManifestLoaded((m) => {
  assets = m;
});
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
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private accumulator = 0;
  private lastRun = '';
  private seen = new Set<string>();
  private drag: { id: number; x: number; y: number } | null = null;
  private corpses: { kind: string; dir: number; x: number; y: number; at: number }[] = [];
  private lastEnemies = new Map<number, Enemy>();
  private useSprites = false;
  private groundImages: Phaser.GameObjects.Image[] = [];
  private mapObjects: { image: Phaser.GameObjects.Image; alpha: number }[] = [];
  private nextFootstep = 0;

  constructor() {
    super('battle');
  }

  preload() {
    if (assets?.pages) {
      for (const page of assets.pages) {
        this.load.atlas(page.key, assetUrl('assets/mir/' + page.image), assetUrl('assets/mir/' + page.data));
      }
    } else {
      this.load.json('manifest', assetUrl('assets/mir/manifest.json'));
    }

    this.load.on('loaderror', (file: any) => {
      console.warn('Load error for asset:', file?.key);
    });
  }

  create() {
    (window as any).__scene = this;
    console.log('[BattleScene.create] assets present?', !!assets, 'pages:', assets?.pages?.length);
    if (!assets) {
      const cached = this.cache.json.get('manifest') as Manifest | undefined;
      if (cached) {
        assets = cached;
        setAssetManifest(cached);
        for (const page of cached.pages) {
          if (!this.textures.exists(page.key)) {
            this.load.atlas(page.key, assetUrl('assets/mir/' + page.image), assetUrl('assets/mir/' + page.data));
          }
        }
        this.load.once('complete', () => {
          this.useSprites = true;
          this.paintGround();
          game.emit();
        });
        this.load.start();
      }
    }
    this.useSprites = !!assets;

    this.cameras.main.setBounds(0, 0, WORLD.w, WORLD.h);
    this.cameras.main.setZoom(this.zoom());

    this.groundGfx = this.add.graphics().setDepth(-100);
    this.gfx = this.add.graphics().setDepth(5000);

    this.paintGround();

    this.keys = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addCapture(['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);

    this.input.keyboard!.on('keydown-ESC', () => game.pause());
    this.input.keyboard!.on('keydown-P', () => game.pause());
    this.input.keyboard!.on('keydown-M', () => sound.toggleMute());

    // Spacebar to trigger teleport (if Mage) or savage charge (if Warrior)
    this.spaceKey.on('down', () => {
      if (game.phase === 'battle') {
        const tp = game.skills.find((s) => s.id === 'teleport');
        if (tp && tp.cd === 0) game.cast(tp);
        const charge = game.skills.find((s) => s.id === 'savage_charge');
        if (charge && charge.cd === 0) game.cast(charge);
      }
    });

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

  paintGround() {
    for (const img of this.groundImages) img.destroy();
    this.groundImages = [];
    this.mapObjects = [];
    this.groundGfx.clear();

    const map = assets?.world;
    if (this.useSprites && map && assets) {
      let texture: Phaser.Textures.CanvasTexture | null = null;
      if (this.textures.exists('terrain')) {
        texture = this.textures.get('terrain') as Phaser.Textures.CanvasTexture;
      } else {
        texture = this.textures.createCanvas('terrain', WORLD.w, WORLD.h);
      }
      if (texture && texture.context) {
        const context = texture.context;
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, WORLD.w, WORLD.h);
        const paint = (key: string, x: number, y: number, bottom = false) => {
          const meta = assets?.frames[key];
          if (!meta) return;
          if (!this.textures.exists(meta.texture)) return;
          const f = this.textures.getFrame(meta.texture, key);
          if (!f || !f.source?.image) return;
          context.drawImage(
            f.source.image as CanvasImageSource,
            f.cutX,
            f.cutY,
            f.cutWidth,
            f.cutHeight,
            x,
            bottom ? y - f.cutHeight : y,
            f.cutWidth,
            f.cutHeight
          );
        };

        for (const tile of map.tiles) {
          paint('map/' + tile.texture.toString(16).toUpperCase().padStart(8, '0'), tile.x, tile.y);
        }
        for (const o of map.objects) {
          if (o.depth === 0) {
            paint('map/' + o.texture.toString(16).toUpperCase().padStart(8, '0'), o.x, o.y, true);
          }
        }
        texture.refresh();
        const terrainImg = this.add.image(0, 0, 'terrain').setOrigin(0).setDepth(-100);
        this.groundImages.push(terrainImg);

        for (const o of map.objects) {
          if (o.depth === 0) continue;
          const key = 'map/' + o.texture.toString(16).toUpperCase().padStart(8, '0');
          const f = assets.frames[key];
          if (!f) continue;
          if (!this.textures.exists(f.texture)) continue;
          const image = this.add
            .image(o.x, o.y, f.texture, key)
            .setOrigin(0, 1)
            .setDepth(o.depth === 3 ? 2000 : o.y + (o.depth === 1 ? -1 : 0))
            .setAlpha(o.alpha ? 0.38 : 1);
          this.groundImages.push(image);
          this.mapObjects.push({ image, alpha: o.alpha ? 0.38 : 1 });
        }
      }
    } else {
      const fallback = 'ground/3';
      if (this.useSprites && assets?.frames[fallback]) {
        const tile = assets.frames[fallback];
        const w = tile.width;
        const h = tile.height;
        for (let y = 0; y < WORLD.h; y += h) {
          for (let x = 0; x < WORLD.w; x += w) {
            const img = this.add
              .image(x, y, tile.texture, fallback)
              .setOrigin(0)
              .setDepth(-100);
            this.groundImages.push(img);
          }
        }

        for (const object of SCENERY) {
          const frame = 'scenery/' + object.id;
          const f = assets.frames[frame];
          if (f) {
            const img = this.add
              .image(object.x, object.y, f.texture, frame)
              .setOrigin(0.5, 1)
              .setDepth(object.y);
            this.groundImages.push(img);
          }
        }
      } else {
        const tileSize = 64;
        const chap = game.chapter;
        for (let y = 0; y < WORLD.h; y += tileSize) {
          for (let x = 0; x < WORLD.w; x += tileSize) {
            const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            const noise = hash - Math.floor(hash);
            const color =
              chap === 'temple'
                ? noise > 0.6
                  ? 0x2e1a1a
                  : 0x221313
                : chap === 'mine'
                  ? noise > 0.6
                    ? 0x28282b
                    : 0x1e1e21
                  : noise > 0.6
                    ? 0x253227
                    : 0x1d271f;
            this.groundGfx.fillStyle(color, 1);
            this.groundGfx.fillRect(x, y, tileSize, tileSize);
          }
        }
      }
    }

    const chap = game.chapter;
    const borderColor = chap === 'temple' ? 0xd87864 : chap === 'mine' ? 0x94a3b8 : 0xd8c894;
    this.groundGfx.lineStyle(2, borderColor, 0.5);
    this.groundGfx.strokeRect(20, 30, WORLD.w - 40, WORLD.h - 50);
  }

  private draw(key: string, frame: string, x: number, y: number, depth: number, alpha = 1, scale = 1, offset = true): boolean {
    if (!this.useSprites || !assets?.frames[frame]) return false;
    const f = assets.frames[frame];
    if (!this.textures.exists(f.texture)) return false;
    this.seen.add(key);
    let image = this.bodies.get(key);
    if (!image) {
      image = this.pool.pop() ?? this.add.image(0, 0, f.texture, frame);
      this.bodies.set(key, image);
    }
    const ox = (f.originX ?? 0) * scale;
    const oy = (f.originY ?? 0) * scale;
    image
      .setTexture(f.texture, frame)
      .setVisible(true)
      .setOrigin(offset ? 0 : 0.5)
      .setPosition(offset ? x - ox : x, offset ? y - oy : y)
      .setDepth(depth)
      .setAlpha(alpha)
      .setScale(scale)
      .clearTint();
    return true;
  }

  private drawAnim(
    key: string,
    animName: string,
    progress: number,
    x: number,
    y: number,
    depth: number,
    alpha = 1,
    scale = 1,
    loop = false
  ): boolean {
    if (!this.useSprites || !assets?.animations[animName]) return false;
    const frames = assets.animations[animName];
    if (!frames || !frames.length) return false;
    const idx = loop
      ? Math.floor(progress * 10) % frames.length
      : Math.min(frames.length - 1, Math.max(0, Math.floor(progress * frames.length)));
    this.draw(key, frames[idx], x, y, depth, alpha, scale);
    return true;
  }

  private resolveAnimName(name: string): string {
    if (name.startsWith('boss')) return 'boss';
    if (name.startsWith('orc')) return 'orc';
    if (name.startsWith('skeleton')) return 'skeleton';
    if (name === 'zombie') return 'zombie';
    if (name.startsWith('woma') || name.startsWith('zuma')) return 'orc';
    if (name === 'maggot') return 'cat';
    if (name === 'spider') return 'scarecrow';
    if (name === 'shinsu') return 'beast';
    if (name === 'summonedSkeleton') return 'summonedSkeleton';
    return name;
  }

  private actor(key: string, name: string, motion: string, dir: number, x: number, y: number, time: number, depth: number, alpha = 1, scale = 1) {
    if (this.useSprites && assets) {
      const mapped = this.resolveAnimName(name);
      const frames = assets.animations[`${mapped}/${motion}/${dir}`] ?? assets.animations[`${mapped}/idle/${dir}`];
      if (frames?.length) {
        this.draw(key, frames[Math.floor(time * 9) % frames.length], x, y, depth, alpha, scale);
        return;
      }
    }
    this.drawProceduralActor(name, dir, x, y, motion, alpha, scale);
  }

  private drawProceduralActor(name: string, dir: number, x: number, y: number, motion: string, alpha: number, scale: number) {
    const isBoss = name.startsWith('boss');
    const isPlayer = ['hero', 'wizard', 'warrior', 'taoist'].includes(name);

    // Shadow
    this.gfx.fillStyle(0x0a0c0a, 0.45 * alpha);
    this.gfx.fillEllipse(x, y + 4, (isBoss ? 48 : 26) * scale, (isBoss ? 24 : 12) * scale);

    if (isPlayer) {
      const cls = game.heroClass;

      if (cls === 'wizard') {
        // Wizard: Blue Robe, Pointed Hat, Staff
        this.gfx.fillStyle(0x2b4c7e, alpha);
        this.gfx.fillRect(x - 9 * scale, y - 24 * scale, 18 * scale, 24 * scale);
        this.gfx.fillStyle(0xd4af37, alpha);
        this.gfx.fillRect(x - 8 * scale, y - 4 * scale, 16 * scale, 3 * scale);

        // Hat
        this.gfx.fillStyle(0x1a2e4d, alpha);
        this.gfx.fillTriangle(x - 12 * scale, y - 24 * scale, x + 12 * scale, y - 24 * scale, x, y - 42 * scale);

        // Staff
        const staffAngle = (dir * Math.PI) / 4;
        const sx = x + Math.cos(staffAngle) * 16 * scale;
        const sy = y - 12 * scale + Math.sin(staffAngle) * 14 * scale;
        this.gfx.lineStyle(2 * scale, 0x8b5a2b, alpha);
        this.gfx.strokeLineShape(new Phaser.Geom.Line(x, y - 10 * scale, sx, sy));
        this.gfx.fillStyle(0x5eead4, alpha);
        this.gfx.fillCircle(sx, sy, 4 * scale);
      } else if (cls === 'taoist') {
        // Taoist: White/Yellow Daoist Robe, Taiji Seal
        this.gfx.fillStyle(0xfef08a, alpha);
        this.gfx.fillRect(x - 9 * scale, y - 24 * scale, 18 * scale, 24 * scale);
        this.gfx.fillStyle(0x38bdf8, alpha);
        this.gfx.fillRect(x - 9 * scale, y - 14 * scale, 18 * scale, 4 * scale);

        // Daoist Cap
        this.gfx.fillStyle(0x1e293b, alpha);
        this.gfx.fillRect(x - 7 * scale, y - 32 * scale, 14 * scale, 8 * scale);

        // Whisk / Talisman
        const ang = (dir * Math.PI) / 4;
        const tx = x + Math.cos(ang) * 15 * scale;
        const ty = y - 10 * scale + Math.sin(ang) * 15 * scale;
        this.gfx.fillStyle(0xf59e0b, alpha);
        this.gfx.fillRect(tx - 3 * scale, ty - 5 * scale, 6 * scale, 10 * scale);
      } else {
        // Warrior: Heavy Steel Armor, Red Cape, Broadsword
        this.gfx.fillStyle(0xef4444, alpha); // Red Cape
        this.gfx.fillRect(x - 11 * scale, y - 22 * scale, 22 * scale, 20 * scale);

        this.gfx.fillStyle(0x475569, alpha); // Steel Plate
        this.gfx.fillRect(x - 9 * scale, y - 24 * scale, 18 * scale, 24 * scale);

        // Helmet
        this.gfx.fillStyle(0x334155, alpha);
        this.gfx.fillRect(x - 8 * scale, y - 34 * scale, 16 * scale, 10 * scale);

        // Giant Broadsword
        const swordAngle = (dir * Math.PI) / 4;
        const ex = x + Math.cos(swordAngle) * 22 * scale;
        const ey = y - 8 * scale + Math.sin(swordAngle) * 20 * scale;
        this.gfx.lineStyle(4 * scale, 0xcbd5e1, alpha);
        this.gfx.strokeLineShape(new Phaser.Geom.Line(x, y - 10 * scale, ex, ey));
        this.gfx.lineStyle(2 * scale, 0xef4444, alpha);
        this.gfx.strokeLineShape(new Phaser.Geom.Line(x, y - 10 * scale, ex, ey));
      }
    } else if (isBoss) {
      if (name === 'boss_bichon' || name === 'boss') {
        // Crimson Skeleton Elf
        this.gfx.fillStyle(0xb91c1c, alpha);
        this.gfx.fillCircle(x, y - 36 * scale, 14 * scale);
        this.gfx.lineStyle(3 * scale, 0x7f1d1d, alpha);
        this.gfx.strokeLineShape(new Phaser.Geom.Line(x - 8 * scale, y - 44 * scale, x - 18 * scale, y - 56 * scale));
        this.gfx.strokeLineShape(new Phaser.Geom.Line(x + 8 * scale, y - 44 * scale, x + 18 * scale, y - 56 * scale));
        this.gfx.fillStyle(0x991b1b, alpha);
        this.gfx.fillRect(x - 16 * scale, y - 24 * scale, 32 * scale, 24 * scale);
        this.gfx.fillStyle(0xfacc15, alpha);
        this.gfx.fillCircle(x - 4 * scale, y - 37 * scale, 2.5 * scale);
        this.gfx.fillCircle(x + 4 * scale, y - 37 * scale, 2.5 * scale);
        this.gfx.lineStyle(3 * scale, 0xef4444, alpha);
        this.gfx.strokeLineShape(new Phaser.Geom.Line(x - 20 * scale, y - 26 * scale, x - 28 * scale, y - 6 * scale));
        this.gfx.strokeLineShape(new Phaser.Geom.Line(x + 20 * scale, y - 26 * scale, x + 28 * scale, y - 6 * scale));
      } else if (name === 'boss_mine') {
        // Zombie King (尸王) - Massive green undead with iron shackles
        this.gfx.fillStyle(0x166534, alpha);
        this.gfx.fillCircle(x, y - 40 * scale, 18 * scale);
        this.gfx.fillRect(x - 20 * scale, y - 26 * scale, 40 * scale, 28 * scale);
        this.gfx.lineStyle(4 * scale, 0x94a3b8, alpha); // Chains
        this.gfx.strokeCircle(x - 18 * scale, y - 10 * scale, 8 * scale);
        this.gfx.strokeCircle(x + 18 * scale, y - 10 * scale, 8 * scale);
        this.gfx.fillStyle(0xef4444, alpha); // Eyes
        this.gfx.fillCircle(x - 6 * scale, y - 42 * scale, 3 * scale);
        this.gfx.fillCircle(x + 6 * scale, y - 42 * scale, 3 * scale);
      } else {
        // Woma Master (沃玛教主) - Winged beast with electric horns
        this.gfx.fillStyle(0x78350f, alpha);
        this.gfx.fillCircle(x, y - 42 * scale, 18 * scale);
        this.gfx.fillRect(x - 22 * scale, y - 26 * scale, 44 * scale, 28 * scale);
        // Wings
        this.gfx.fillStyle(0x451a03, alpha * 0.8);
        this.gfx.fillTriangle(x - 22 * scale, y - 26 * scale, x - 55 * scale, y - 55 * scale, x - 18 * scale, y);
        this.gfx.fillTriangle(x + 22 * scale, y - 26 * scale, x + 55 * scale, y - 55 * scale, x + 18 * scale, y);
        // Lightning horns
        this.gfx.lineStyle(3 * scale, 0x38bdf8, alpha);
        this.gfx.strokeLineShape(new Phaser.Geom.Line(x - 8 * scale, y - 50 * scale, x - 22 * scale, y - 70 * scale));
        this.gfx.strokeLineShape(new Phaser.Geom.Line(x + 8 * scale, y - 50 * scale, x + 22 * scale, y - 70 * scale));
      }
    } else {
      // Normal Monsters
      let color = 0x854d0e;
      if (name.includes('cat')) color = 0xd97706;
      if (name.includes('orc')) color = 0x15803d;
      if (name.includes('skeleton')) color = 0xe2e8f0;
      if (name.includes('zombie')) color = 0x3f6212;
      if (name.includes('spider')) color = 0x701a75;
      if (name.includes('woma')) color = 0xb45309;
      if (name.includes('zuma')) color = 0x64748b;

      this.gfx.fillStyle(color, alpha);
      this.gfx.fillRect(x - 8 * scale, y - 22 * scale, 16 * scale, 22 * scale);
      this.gfx.fillCircle(x, y - 27 * scale, 7 * scale);
      this.gfx.fillStyle(0xfef08a, alpha);
      this.gfx.fillRect(x - 4 * scale, y - 28 * scale, 2 * scale, 2 * scale);
      this.gfx.fillRect(x + 2 * scale, y - 28 * scale, 2 * scale, 2 * scale);
    }
  }

  private drawMinion(m: Minion, time: number) {
    if (this.useSprites && assets) {
      const animActor =
        m.kind === 'skeleton' ? 'summonedSkeleton' : m.kind === 'shinsu' ? 'beast' : 'cat';
      const motion = m.attackCD > 0.6 ? 'attack' : 'walk';
      const scale = m.kind === 'shinsu' ? 1.15 : 1;
      this.actor(`minion-${m.id}`, animActor, motion, m.dir, m.x, m.y, time, m.y, 1, scale);

      // Flame breath for Shinsu
      if (m.kind === 'shinsu' && m.breathUntil && time < m.breathUntil) {
        const p = Math.max(0, Math.min(1, 1 - (m.breathUntil - time) / 0.6));
        this.drawAnim(
          `minion-flame-${m.id}`,
          `beastflame/${m.dir}`,
          p,
          m.x,
          m.y,
          m.y + 10,
          1,
          1.2,
          false
        );
      }
      return;
    }

    // Shadow
    this.gfx.fillStyle(0x0a0c0a, 0.4);
    this.gfx.fillEllipse(m.x, m.y + 4, m.kind === 'shinsu' ? 36 : 22, m.kind === 'shinsu' ? 18 : 10);

    if (m.kind === 'skeleton') {
      // Skeleton Minion: Grey bone body, battleaxe
      this.gfx.fillStyle(0xe2e8f0, 1);
      this.gfx.fillRect(m.x - 6, m.y - 20, 12, 20);
      this.gfx.fillCircle(m.x, m.y - 25, 6);
      this.gfx.fillStyle(0x38bdf8, 1); // Blue eyes
      this.gfx.fillCircle(m.x - 3, m.y - 26, 1.5);
      this.gfx.fillCircle(m.x + 3, m.y - 26, 1.5);
      // Battleaxe
      this.gfx.lineStyle(2, 0x94a3b8, 1);
      this.gfx.strokeLineShape(new Phaser.Geom.Line(m.x + 8, m.y - 18, m.x + 14, m.y - 2));
    } else if (m.kind === 'shinsu') {
      // Shinsu (Divine Beast): Crimson/Gold muscular beast
      this.gfx.fillStyle(0xd97706, 1);
      this.gfx.fillCircle(m.x, m.y - 18, 16);
      this.gfx.fillRect(m.x - 14, m.y - 14, 28, 16);
      this.gfx.fillStyle(0xef4444, 1);
      this.gfx.fillCircle(m.x, m.y - 26, 12);
      this.gfx.fillStyle(0xfacc15, 1); // Gold horn
      this.gfx.fillTriangle(m.x - 4, m.y - 36, m.x + 4, m.y - 36, m.x, m.y - 48);

      // Flame breath effect if breathing
      if (m.breathUntil && time < m.breathUntil) {
        const ang = (m.dir * Math.PI) / 4;
        const fx = m.x + Math.cos(ang) * 45;
        const fy = m.y + Math.sin(ang) * 45;
        this.gfx.fillStyle(0xf97316, 0.7);
        this.gfx.fillCircle(fx, fy, 28);
        this.gfx.fillStyle(0xfacc15, 0.9);
        this.gfx.fillCircle(fx, fy, 14);
      }
    } else {
      // Enticed Charmed Monster: Golden halo
      this.gfx.fillStyle(0xa16207, 1);
      this.gfx.fillRect(m.x - 7, m.y - 20, 14, 20);
      this.gfx.fillCircle(m.x, m.y - 25, 6);
      this.gfx.lineStyle(2, 0xfacc15, 0.85);
      this.gfx.strokeCircle(m.x, m.y - 35, 8);
    }

    // Minion Health Bar
    if (m.hp < m.maxHp) {
      this.gfx.fillStyle(0x140e0c, 0.8).fillRect(m.x - 16, m.y - 38, 32, 3);
      this.gfx.fillStyle(0x22c55e, 1).fillRect(m.x - 16, m.y - 38, 32 * (m.hp / m.maxHp), 3);
    }
  }

  update(_time: number, delta: number) {
    if (!rendererReady) return;
    frameMS = frameMS * 0.95 + delta * 0.05;

    const forceDebug =
      game.debugAssets ||
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('debugAssets') === 'true');
    const nextUseSprites = !forceDebug && !!assets;
    if (this.useSprites !== nextUseSprites) {
      this.useSprites = nextUseSprites;
      this.paintGround();
    }

    if (this.lastRun !== game.runId) {
      this.lastRun = game.runId;
      this.clearInput();
      this.corpses = [];
      this.lastEnemies.clear();
      this.accumulator = 0;
      this.paintGround();
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

    for (const object of this.mapObjects) {
      const i = object.image;
      i.setAlpha(object.alpha);
    }

    if (game.phase === 'battle') {
      if (game.player.moving && game.clock >= this.nextFootstep) {
        sound.play('step', 0.25);
        this.nextFootstep = game.clock + 0.34;
      }
    }

    if (game.phase === 'lobby') {
      this.cameras.main.centerOn(WORLD.w / 2, WORLD.h / 2);
      this.actor('hero', game.heroClass, 'idle', 5, WORLD.w / 2, WORLD.h / 2, _time / 1000, 100);
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

      // Corpses
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

      // Render Minions (随从)
      for (const m of game.minions) {
        this.drawMinion(m, t);
      }

      // Render Enemies
      for (const e of game.enemies) {
        const motion = e.windup > 0 ? 'attack' : t - e.hitAt < 0.17 ? 'hurt' : 'walk';
        const isBoss = e.kind.startsWith('boss');
        const scale = isBoss ? 1.6 : e.elite ? 1.3 : 1;
        this.actor(`enemy-${e.id}`, e.kind, motion, e.dir, e.x, e.y, t - e.born, e.y, 1, scale);

        // Status Indicators (Poison / Paralyze)
        if (t < e.status.poisonedUntil) {
          this.gfx.fillStyle(0x22c55e, 0.4).fillCircle(e.x, e.y - 15, 16 * scale);
        }
        if (t < e.status.paralyzedUntil) {
          this.gfx.lineStyle(2, 0xfacc15, 0.85).strokeCircle(e.x, e.y - 15, 18 * scale);
        }

        // Health bars
        if (e.elite || isBoss || e.hp < e.maxHp) {
          const w = isBoss ? 80 : 32;
          this.gfx.fillStyle(0x140e0c, 0.85).fillRect(e.x - w / 2, e.y - 54 * scale, w, 4);
          this.gfx
            .fillStyle(isBoss ? 0xd97706 : e.elite ? 0xeab308 : 0xef4444, 1)
            .fillRect(e.x - w / 2, e.y - 54 * scale, w * Math.max(0, e.hp / e.maxHp), 4);
        }

        // Windup telegraph
        if (e.windup > 0) {
          this.gfx
            .lineStyle(2, 0xf97316, 0.75)
            .strokeEllipse(e.x, e.y + 2, isBoss ? 140 : 54, isBoss ? 70 : 26);
        }
      }

      // Render Drops
      for (const d of game.drops) {
        if (d.item) {
          // Legendary Equipment Drop: Golden/Violet Pillar of Light & Ground Halo
          const isHighTier = (d.item.tier ?? 1) >= 3;
          const beamColor = isHighTier ? 0xa855f7 : 0xf59e0b;
          const coreColor = isHighTier ? 0xe9d5ff : 0xfef08a;

          // Vertical Light Pillar
          this.gfx.fillStyle(beamColor, 0.45).fillRect(d.x - 3, d.y - 42, 6, 42);
          this.gfx.fillStyle(coreColor, 0.75).fillRect(d.x - 1, d.y - 48, 2, 48);

          // Ground Pulsing Ring
          this.gfx.lineStyle(1.5, beamColor, 0.85).strokeEllipse(d.x, d.y + 2, 18, 9);
          if (d.item.icon) {
            this.draw(`drop-item-${d.id}`, d.item.icon, d.x, d.y - 4, d.y, 1, 0.8, false);
          } else {
            this.gfx.fillStyle(beamColor, 0.95).fillCircle(d.x, d.y - 2, 6);
            this.gfx.fillStyle(coreColor, 1).fillCircle(d.x, d.y - 2, 2.5);
          }
        } else if (d.isChest) {
          // Golden Treasure Chest
          this.gfx.fillStyle(0xf59e0b, 0.35).fillRect(d.x - 2, d.y - 32, 4, 32);
          this.gfx.lineStyle(1.5, 0xfbbf24, 0.8).strokeEllipse(d.x, d.y + 4, 20, 10);
          // Chest Base
          this.gfx.fillStyle(0x78350f, 1).fillRect(d.x - 8, d.y - 6, 16, 11);
          // Chest Lid
          this.gfx.fillStyle(0xd97706, 1).fillRect(d.x - 9, d.y - 10, 18, 5);
          // Golden Trim & Keyhole
          this.gfx.fillStyle(0xfde047, 1).fillRect(d.x - 2, d.y - 5, 4, 5);
        } else {
          // Authentic Mir 2 Gold Coin Sprite (item/金币（小）)
          const drawn = this.draw(`drop-${d.id}`, 'item/金币（小）', d.x, d.y, d.y, 1, 1, false);
          if (!drawn) {
            this.gfx.fillStyle(0xfacc15, 0.95).fillCircle(d.x, d.y, 4);
            this.gfx.fillStyle(0xfde047, 1).fillCircle(d.x, d.y, 2);
          }
        }
      }

      // Render Projectiles
      for (const p of game.projectiles) {
        if (p.isEnemy) {
          // Enemy Projectile (Spider poison or arrow)
          if (p.kind === 'enemy_poison') {
            this.gfx.fillStyle(0x22c55e, 0.9).fillCircle(p.x, p.y, 5);
          } else {
            this.gfx.lineStyle(2, 0xe2e8f0, 1);
            this.gfx.strokeLineShape(new Phaser.Geom.Line(p.x, p.y, p.x - p.vx * 0.05, p.y - p.vy * 0.05));
          }
        } else if (p.kind === 'soul_fireball') {
          // Authentic Taoist Talisman
          const dir16 = p.dir ?? 0;
          const drawn = this.drawAnim(`proj-${p.id}`, `talisman/${dir16}`, t * 12, p.x, p.y, p.y + 5, 1, 1, true);
          if (!drawn) {
            this.gfx.fillStyle(0x38bdf8, 0.95).fillRect(p.x - 4, p.y - 4, 8, 8);
            this.gfx.fillStyle(0xffffff, 1).fillCircle(p.x, p.y, 2);
          }
        } else {
          // Authentic Wizard Fireball
          const dir16 = p.dir ?? 0;
          const drawn = this.drawAnim(`proj-${p.id}`, `fireball/${dir16}`, t * 12, p.x, p.y, p.y + 5, 1, 1, true);
          if (!drawn) {
            this.gfx.fillStyle(0xf97316, 0.9).fillCircle(p.x, p.y, 7);
            this.gfx.fillStyle(0xfde047, 1).fillCircle(p.x, p.y, 3.5);
          }
        }
      }

      // Render Area Effects (Laser, Firewall, Ice Storm, Slashes)
      for (const f of game.effects) {
        const progress = Math.max(0, Math.min(1, 1 - f.life / f.total));
        if (f.kind === 'firewall') {
          // Natural flame cycle ~8 FPS (not hyperactive 80 FPS)
          const fireAnimTime = (f.total - f.life) * 0.8;
          // Cluster of flame pillars covering the expanded firewall area
          const cluster = [
            [0, 0, 1.3],
            [-46, 12, 1.15],
            [46, 12, 1.15],
            [-24, -22, 1.05],
            [24, -22, 1.05],
          ];
          for (let ci = 0; ci < cluster.length; ci++) {
            const [ox, oy, sc] = cluster[ci];
            const drawn = this.drawAnim(
              `effect-${f.id}-${ci}`,
              'firewall',
              fireAnimTime + ci * 0.15,
              f.x + ox,
              f.y + oy,
              f.y + oy,
              0.95,
              sc,
              true
            );
            if (!drawn) {
              this.gfx.fillStyle(0xea580c, 0.45);
              this.gfx.fillCircle(f.x + ox, f.y + oy, 32);
              this.gfx.fillStyle(0xfacc15, 0.75);
              this.gfx.fillCircle(f.x + ox, f.y + oy, 16);
            }
          }
        } else if (f.kind === 'hellfire') {
          // Wizard Hellfire: Linear piercing flame cone
          const drawn = this.drawAnim(`effect-${f.id}`, 'hellfire', progress, f.x, f.y, f.y + 10, 1, 1.35, false);
          if (!drawn && f.angle !== undefined) {
            const ex = f.x + Math.cos(f.angle) * f.radius;
            const ey = f.y + Math.sin(f.angle) * f.radius;
            this.gfx.lineStyle(12, 0xea580c, 0.85);
            this.gfx.strokeLineShape(new Phaser.Geom.Line(f.x, f.y, ex, ey));
            this.gfx.lineStyle(4, 0xfde047, 1);
            this.gfx.strokeLineShape(new Phaser.Geom.Line(f.x, f.y, ex, ey));
          }
        } else if (f.kind === 'holy_armor') {
          // Taoist Holy Armor one-shot cast effect (plays once, ~0.8s)
          this.drawAnim(`effect-${f.id}`, 'armor', progress, f.x, f.y, f.y + 2, 0.95, 1, false);
        } else if (f.kind === 'spirit_shield') {
          // Taoist Spirit Shield one-shot cast effect (plays once, ~0.8s)
          this.drawAnim(`effect-${f.id}`, 'ghost', progress, f.x, f.y, f.y + 2, 0.95, 1, false);
        } else if (f.kind === 'lightning') {
          const drawn = this.drawAnim(`effect-${f.id}`, 'lightning', progress, f.x, f.y, f.y + 10, 1, 1, false);
          if (!drawn) {
            this.gfx.lineStyle(3, 0x38bdf8, 1);
            this.gfx.strokeLineShape(new Phaser.Geom.Line(f.x, f.y - 320, f.x, f.y));
            this.gfx.lineStyle(1.5, 0xffffff, 1);
            this.gfx.strokeLineShape(new Phaser.Geom.Line(f.x, f.y - 320, f.x, f.y));
            this.gfx.fillStyle(0x7dd3fc, 0.6);
            this.gfx.fillCircle(f.x, f.y, 18);
          }
        } else if (f.kind === 'laser') {
          const drawn = this.drawAnim(`effect-${f.id}`, `beam/${game.player.dir}`, progress, f.x, f.y, f.y + 10, 1, 1, false);
          if (!drawn && f.angle !== undefined) {
            const ex = f.x + Math.cos(f.angle) * f.radius;
            const ey = f.y + Math.sin(f.angle) * f.radius;
            this.gfx.lineStyle(6, 0x38bdf8, 0.8);
            this.gfx.strokeLineShape(new Phaser.Geom.Line(f.x, f.y, ex, ey));
            this.gfx.lineStyle(2, 0xffffff, 1);
            this.gfx.strokeLineShape(new Phaser.Geom.Line(f.x, f.y, ex, ey));
          }
        } else if (f.kind === 'ice_storm') {
          const drawn = this.drawAnim(`effect-${f.id}`, 'ice', progress, f.x, f.y, f.y + 10, 1, 1.2, false);
          if (!drawn) {
            this.gfx.fillStyle(0x38bdf8, 0.35);
            this.gfx.fillCircle(f.x, f.y, f.radius);
            this.gfx.lineStyle(2, 0xe0f2fe, 0.8);
            this.gfx.strokeCircle(f.x, f.y, f.radius * (f.life / f.total));
          }
        } else if (f.kind === 'holy_word') {
          const drawn = this.drawAnim(`effect-${f.id}`, 'holy', progress, f.x, f.y, f.y + 10, 1, 1, false);
          if (!drawn) {
            this.gfx.fillStyle(0xfde047, 0.5);
            this.gfx.fillCircle(f.x, f.y, 30);
          }
        } else if (f.kind === 'half_moon_sweep') {
          const drawn = this.drawAnim(`effect-${f.id}`, `cleave/${game.player.dir}`, progress, f.x, f.y, f.y + 10, 1, 1.2, false);
          if (!drawn) {
            this.gfx.lineStyle(4, 0x93c5fd, 0.9);
            this.gfx.strokeCircle(f.x, f.y, f.radius);
          }
        } else if (f.kind === 'fire_slash') {
          const drawn = this.drawAnim(`effect-${f.id}`, `firesword/${game.player.dir}`, progress, f.x, f.y, f.y + 10, 1, 1.3, false);
          if (!drawn) {
            this.gfx.lineStyle(6, 0xef4444, 0.9);
            this.gfx.strokeCircle(f.x, f.y, f.radius);
          }
        } else if (f.kind === 'ring_of_fire') {
          const drawn = this.drawAnim(`effect-${f.id}`, 'repulse', progress, f.x, f.y, f.y + 10, 1, 1.2, false);
          if (!drawn) {
            this.gfx.lineStyle(3, 0xf97316, 0.9);
            this.gfx.strokeCircle(f.x, f.y, f.radius * (1 - f.life / f.total));
          }
        } else if (f.kind === 'poison_cloud') {
          const drawn = this.drawAnim(`effect-${f.id}`, 'poison', progress, f.x, f.y, f.y + 10, 1, 1, false);
          if (!drawn) {
            this.gfx.fillStyle(0x22c55e, 0.35);
            this.gfx.fillCircle(f.x, f.y, f.radius);
          }
        }
      }

      // Render Player
      this.actor(
        'hero',
        game.heroClass,
        game.phase === 'dead' ? 'death' : game.player.moving ? 'walk' : t < game.player.castUntil ? 'cast' : 'idle',
        game.player.dir,
        game.player.x,
        game.player.y,
        t,
        game.player.y + 0.5,
        t < game.player.hitUntil ? 0.65 : 1
      );

      // Render Player Dynamic Weapon and Armor Appearance
      const equippedWpn = game.equipment.weapon ? getItem(game.equipment.weapon.itemId) : null;
      const equippedArm = game.equipment.armor ? getItem(game.equipment.armor.itemId) : null;

      // Armor Appearance & Sheen
      if (equippedArm) {
        if (equippedArm.id === 'arm-war-god') {
          // 战神盔甲: Golden warlord shoulder plate and aura
          this.gfx.fillStyle(0xf59e0b, 0.75).fillCircle(game.player.x - 10, game.player.y - 22, 4);
          this.gfx.fillStyle(0xf59e0b, 0.75).fillCircle(game.player.x + 10, game.player.y - 22, 4);
          this.gfx.lineStyle(2, 0xfde047, 0.6).strokeEllipse(game.player.x, game.player.y + 4, 34, 16);
        } else if (equippedArm.id === 'arm-devil-robe') {
          // 恶魔长袍: Arcane violet embroidery sheen
          this.gfx.fillStyle(0xa855f7, 0.7).fillCircle(game.player.x - 9, game.player.y - 20, 3.5);
          this.gfx.fillStyle(0xa855f7, 0.7).fillCircle(game.player.x + 9, game.player.y - 20, 3.5);
          this.gfx.lineStyle(2, 0xc084fc, 0.55).strokeEllipse(game.player.x, game.player.y + 4, 32, 15);
        } else if (equippedArm.id === 'arm-ghost-robe') {
          // 幽灵战衣: Luminous jade celestial daoist aura
          this.gfx.fillStyle(0x38bdf8, 0.7).fillCircle(game.player.x - 9, game.player.y - 20, 3.5);
          this.gfx.fillStyle(0x38bdf8, 0.7).fillCircle(game.player.x + 9, game.player.y - 20, 3.5);
          this.gfx.lineStyle(2, 0x38bdf8, 0.6).strokeEllipse(game.player.x, game.player.y + 4, 32, 15);
        } else if (equippedArm.id === 'arm-heavy-armor') {
          // 重盔甲: Steel cuirass sheen
          this.gfx.fillStyle(0x94a3b8, 0.65).fillCircle(game.player.x - 9, game.player.y - 20, 3);
          this.gfx.fillStyle(0x94a3b8, 0.65).fillCircle(game.player.x + 9, game.player.y - 20, 3);
        }
      }

      // Weapon Appearance in Hand
      if (equippedWpn) {
        const dir = game.player.dir;
        const handOffsets: [number, number][] = [
          [10, -18],  // 0: Up
          [16, -14],  // 1: Up-Right
          [18, -8],   // 2: Right
          [14, -2],   // 3: Down-Right
          [8, 0],     // 4: Down
          [-8, 0],    // 5: Down-Left
          [-18, -8],  // 6: Left
          [-14, -16], // 7: Up-Left
        ];
        const [hox, hoy] = handOffsets[dir] ?? [8, 0];
        const wx = game.player.x + hox;
        const wy = game.player.y + hoy;
        const wDepth = (dir === 0 || dir === 7) ? game.player.y - 0.2 : game.player.y + 1.2;

        if (equippedWpn.icon) {
          this.draw('hero-weapon', equippedWpn.icon, wx, wy, wDepth, 0.95, 0.5, false);
        }

        // Elemental Weapon Glow
        if (equippedWpn.id === 'wpn-judgment') {
          this.gfx.fillStyle(0x38bdf8, 0.85).fillCircle(wx, wy - 4, 3.5);
        } else if (equippedWpn.id === 'wpn-dragon-sword') {
          this.gfx.fillStyle(0x4ade80, 0.85).fillCircle(wx, wy - 4, 3.5);
        } else if (equippedWpn.id === 'wpn-bone-staff') {
          this.gfx.fillStyle(0xef4444, 0.85).fillCircle(wx, wy - 4, 3.5);
        } else if (equippedWpn.id === 'wpn-purgatory') {
          this.gfx.fillStyle(0xdc2626, 0.85).fillCircle(wx, wy - 4, 4);
        }
      }

      // Player Shields & Buff Auras
      if (t < game.player.shieldUntil) {
        const drawn = this.drawAnim('player-shield', 'shield', t * 5, game.player.x, game.player.y, game.player.y + 2, 0.9, 1, true);
        if (!drawn) {
          this.gfx.lineStyle(2.5, 0xfacc15, 0.85);
          this.gfx.strokeCircle(game.player.x, game.player.y - 10, 26);
          this.gfx.fillStyle(0xfef08a, 0.15);
          this.gfx.fillCircle(game.player.x, game.player.y - 10, 26);
        }
      }
      if (t < game.player.holyArmorUntil) {
        this.gfx.lineStyle(1.5, 0x3b82f6, 0.45).strokeCircle(game.player.x, game.player.y - 10, 28);
      }
      if (t < game.player.spiritShieldUntil) {
        this.gfx.lineStyle(1.5, 0xa855f7, 0.45).strokeCircle(game.player.x, game.player.y - 10, 30);
      }

      // Base ring
      this.gfx.lineStyle(1.5, 0xd4af37, 0.7).strokeEllipse(game.player.x, game.player.y + 3, 30, 15);

      // Render Touch Joystick if active
      if (this.drag && this.input.activePointer.isDown) {
        const wp = this.cameras.main.getWorldPoint(this.drag.x, this.drag.y);
        const cur = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
        this.gfx.lineStyle(2, 0xd4af37, 0.65).strokeCircle(wp.x, wp.y, 40);
        this.gfx.fillStyle(0x0a0c0a, 0.35).fillCircle(wp.x, wp.y, 40);
        this.gfx.fillStyle(0xfacc15, 0.85).fillCircle(cur.x, cur.y, 16);
      }

      // Floating Labels
      for (const f of game.floating) {
        let label = this.labels.get(f.id);
        if (!label) {
          const isCrit = f.type === 'crit';
          const fontSize = isCrit ? '18px' : f.type === 'heal' ? '16px' : '14px';
          label = this.add
            .text(0, 0, '', {
              fontFamily: 'serif, sans-serif',
              fontSize,
              fontStyle: isCrit ? '900' : 'bold',
              stroke: '#0f0e0c',
              strokeThickness: isCrit ? 4 : 3,
            })
            .setOrigin(0.5)
            .setDepth(6000);
          this.labels.set(f.id, label);
        }
        const scale = f.scale ?? (f.type === 'crit' ? 1.25 : 1);
        label
          .setPosition(f.x, f.y)
          .setText(f.text)
          .setColor(f.color)
          .setScale(scale)
          .setAlpha(Math.min(1, f.life * 2));
      }
    }

    // Clean up
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
  (window as any).__engine = engine;
}
