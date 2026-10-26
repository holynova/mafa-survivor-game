import {
  ITEMS,
  MONSTERS,
  SKILLS,
  WAVE_BUDGET,
  getItem,
  getSkill,
} from './content';
import {
  Rng,
  clamp,
  combine,
  incomingDamage,
  rerollPrice,
  sellPrice,
  expNeeded,
  SpatialHash,
  effective,
} from './rules';
import { sound } from './audio';
import {
  SLOT_KEYS,
  type Bonuses,
  type SkillId,
  type StatKey,
  type Slot,
  type Item,
  type Phase,
  type Mode,
  type Enemy,
  type Projectile,
  type Drop,
  type Fx,
  type Floating,
  type Skill,
  type Upgrade,
  type Offer,
  type Equipped,
  type RunResult,
} from './types';

export const WORLD = { w: 2208, h: 1536 };

export class Game {
  phase: Phase = 'lobby';
  mode: Mode = 'normal';
  seed = 176;
  runId = '';
  rng = new Rng(176);
  clock = 0;
  wave = 1;
  waveTime = 0;
  kills = 0;
  gold = 0;
  level = 1;
  exp = 0;
  totalGold = 0;
  bossSpawned = false;
  bossKilled = false;
  damageDealt: Record<string, number> = {};

  player = {
    x: WORLD.w / 2,
    y: WORLD.h / 2,
    hp: 100,
    dir: 4,
    moving: false,
    hitUntil: 0,
    castUntil: 0,
    shieldUntil: 0,
  };

  skills: Skill[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  drops: Drop[] = [];
  effects: Fx[] = [];
  floating: Floating[] = [];

  equipment: Partial<Record<Slot, Equipped>> = {};
  passives: Record<string, number> = {};
  upgrades: Bonuses = {};
  offers: Offer[] = [];
  choices: Upgrade[] = [];
  rerolls = 0;
  waveGold = 0;
  lastWaveGold = 0;
  lastWaveKills = 0;
  notice = '';
  result: RunResult | null = null;
  stats: Bonuses = {};

  input = { x: 0, y: 0 };
  private listeners = new Set<() => void>();
  private id = 0;
  private spawnTimer = 0;
  private spawned = 0;
  private nextUI = 0;
  private previous: Phase = 'battle';
  private hash = new SpatialHash<Enemy>();
  private waveKills = 0;

  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };

  emit() {
    for (const f of this.listeners) f();
  }

  get maxHP() {
    return 100 + (this.stats.hp_max ?? 0);
  }

  get duration() {
    return this.mode === 'trial' ? 35 : 75;
  }

  get maxWaves() {
    return this.mode === 'trial' ? 3 : 12;
  }

  get boss() {
    return this.enemies.find((e) => e.kind === 'boss' && e.hp > 0);
  }

  get cooldownCost() {
    return rerollPrice(this.rerolls);
  }

  get moveSpeed() {
    return 220 * (1 + (this.stats.move_speed ?? 0) / 100);
  }

  get pickupRadius() {
    return 80 * (1 + (this.stats.pickup_radius ?? 0) / 100);
  }

  start(mode: Mode = 'normal', seed = Math.floor(Math.random() * 900000) + 1000) {
    this.mode = mode;
    this.seed = seed;
    this.runId = `run-${Date.now()}-${seed}`;
    this.rng = new Rng(seed);
    this.clock = 0;
    this.wave = 1;
    this.waveTime = 0;
    this.kills = 0;
    this.waveKills = 0;
    this.gold = 0;
    this.waveGold = 0;
    this.totalGold = 0;
    this.level = 1;
    this.exp = 0;
    this.bossSpawned = false;
    this.bossKilled = false;
    this.damageDealt = {};
    this.enemies = [];
    this.projectiles = [];
    this.drops = [];
    this.effects = [];
    this.floating = [];
    this.equipment = {};
    this.passives = {};
    this.upgrades = {};
    this.offers = [];
    this.choices = [];
    this.rerolls = 0;
    this.result = null;
    this.spawned = 0;
    this.spawnTimer = 0.5;

    this.player = {
      x: WORLD.w / 2,
      y: WORLD.h / 2,
      hp: 100,
      dir: 4,
      moving: false,
      hitUntil: 0,
      castUntil: 0,
      shieldUntil: 0,
    };

    // Starting Skill: Fireball (火球术)
    this.skills = [this.newSkill('fireball')];
    this.recompute();
    this.phase = 'battle';
    this.emit();
  }

  newSkill(id: SkillId): Skill {
    return {
      id,
      rank: 1,
      cd: 0.1,
      power: 0,
      count: 0,
      radius: 0,
      duration: 0,
      localCDR: 0,
      shieldReduction: 0,
    };
  }

  recompute() {
    const list: Bonuses[] = [this.upgrades];
    for (const [id, count] of Object.entries(this.passives)) {
      const item = getItem(id);
      for (let i = 0; i < count; i++) list.push(item.stats);
    }
    for (const e of Object.values(this.equipment)) {
      if (e) list.push(getItem(e.itemId).stats);
    }
    this.stats = combine(list);
    this.player.hp = Math.min(this.player.hp, this.maxHP);
  }

  pause() {
    if (this.phase === 'battle') {
      this.previous = 'battle';
      this.phase = 'paused';
      this.emit();
    } else if (this.phase === 'paused') {
      this.phase = this.previous;
      this.emit();
    }
  }

  step(dt: number) {
    if (this.phase !== 'battle') return;
    this.clock += dt;
    this.waveTime += dt;

    // HP regeneration
    const regen = (this.stats.hp_regen ?? 0) * dt;
    if (regen > 0 && this.player.hp < this.maxHP) {
      this.player.hp = Math.min(this.maxHP, this.player.hp + regen);
    }

    // Player Movement
    const ix = this.input.x;
    const iy = this.input.y;
    const len = Math.hypot(ix, iy);
    if (len > 0.05) {
      const sp = (this.moveSpeed * dt) / Math.max(1, len);
      this.player.x = clamp(this.player.x + ix * sp, 30, WORLD.w - 30);
      this.player.y = clamp(this.player.y + iy * sp, 45, WORLD.h - 30);
      this.player.dir = this.direction(ix, iy);
      this.player.moving = true;
    } else {
      this.player.moving = false;
    }

    // Enemy Spawning
    this.spawnTimer -= dt;
    const maxBudget = WAVE_BUDGET[this.wave - 1] ?? 400;
    if (this.spawnTimer <= 0 && this.spawned < maxBudget) {
      const count = Math.min(
        1 + Math.floor(this.wave / 3),
        Math.max(1, Math.floor(this.rng.next() * 3))
      );
      for (let i = 0; i < count && this.spawned < maxBudget; i++) {
        this.spawnEnemy();
        this.spawned++;
      }
      this.spawnTimer = Math.max(0.25, 1.25 - this.wave * 0.08);
    }

    // Boss Spawn: in wave 12 (or trial wave 3), at 25s (trial 10s)
    const bossTime = this.mode === 'trial' ? 10 : 25;
    if (
      this.wave === this.maxWaves &&
      this.waveTime >= bossTime &&
      !this.bossSpawned
    ) {
      this.bossSpawned = true;
      this.spawnEnemy('boss');
    }

    // Update Enemies AI & Movement
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.attackCD = Math.max(0, e.attackCD - dt);
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const d = Math.hypot(dx, dy);
      e.dir = this.direction(dx, dy);

      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          if (d < (e.kind === 'boss' ? 110 : 46)) {
            this.hurt(e.damage);
          }
          e.attackCD = e.kind === 'boss' ? 1.5 : 1.1;
        }
        continue;
      }

      if (d < (e.kind === 'boss' ? 76 : 30) && e.attackCD === 0) {
        e.windup = e.kind === 'boss' ? 0.65 : 0.4;
        continue;
      }

      if (d > 22) {
        // Separation vector from nearby enemies to avoid overlap
        let sx = 0;
        let sy = 0;
        for (const other of this.hash.nearby(e.x, e.y, 32)) {
          if (other.id === e.id) continue;
          const ox = e.x - other.x;
          const oy = e.y - other.y;
          const dist = Math.hypot(ox, oy);
          if (dist > 0.1) {
            const push = (32 - dist) * 2;
            sx += (ox / dist) * push;
            sy += (oy / dist) * push;
          }
        }
        const rush =
          e.kind === 'rakecat' && Math.sin(this.clock * 1.5 + e.id) > 0.75
            ? 1.75
            : 1;
        const sp = e.speed * rush;
        e.x = clamp(e.x + ((dx / d) * sp + sx) * dt, 20, WORLD.w - 20);
        e.y = clamp(e.y + ((dy / d) * sp + sy) * dt, 30, WORLD.h - 20);
      }
    }

    if (this.phase !== 'battle') return;

    // Auto-Casting Scheduler with independent cooldowns
    for (const s of this.skills) {
      s.cd = Math.max(0, s.cd - dt);
      if (s.cd === 0) this.cast(s);
    }

    // Rebuild Spatial Hash for collision checks
    this.hash.rebuild(this.enemies.filter((e) => e.hp > 0));

    // Update Projectiles
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      const target = this.hash.nearby(p.x, p.y, 26).find((e) => e.hp > 0);
      if (target && p.life > 0) {
        this.hit(target, p.damage, 'fireball');
        p.life = 0;
      }
    }

    // Update Firewalls & Ticking damage
    for (const e of this.enemies) {
      if (
        e.hp > 0 &&
        this.clock >= e.burnAt &&
        this.effects.some(
          (f) =>
            f.kind === 'firewall' &&
            f.life > 0 &&
            Math.hypot(e.x - f.x, e.y - f.y) < f.radius
        )
      ) {
        const s = this.skills.find((s) => s.id === 'firewall');
        if (s) {
          this.hit(e, this.magicDamage(5, s), 'firewall');
          e.burnAt = this.clock + 0.5;
        }
      }
    }

    // Update Effects & Floating labels
    for (const f of this.effects) f.life -= dt;
    for (const f of this.floating) {
      f.life -= dt;
      f.y -= dt * 25;
    }

    this.effects = this.effects.filter((x) => x.life > 0);
    this.floating = this.floating.filter((x) => x.life > 0);
    this.projectiles = this.projectiles.filter((x) => x.life > 0);

    // Update Drops & Magnetic Attraction
    const pr = this.pickupRadius + 15;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const dx = this.player.x - d.x;
      const dy = this.player.y - d.y;
      const dist = Math.hypot(dx, dy);

      if (dist < pr) {
        const speed = 520 * dt;
        d.x += (dx / Math.max(1, dist)) * speed;
        d.y += (dy / Math.max(1, dist)) * speed;
        if (dist < speed + 15) {
          this.gold += d.gold;
          this.waveGold += d.gold;
          this.totalGold += d.gold;
          this.exp += d.exp;
          if (d.exp > 0) sound.playGem();
          this.drops.splice(i, 1);
        }
      }
    }

    this.enemies = this.enemies.filter((x) => x.hp > 0);

    // Level-Up Check
    if (this.exp >= expNeeded(this.level)) {
      this.beginUpgrade();
      return;
    }

    // Wave Completion Check
    if (this.waveTime >= this.duration) {
      this.endWave();
      return;
    }

    // UI Tick Emitter (throttle to ~10Hz)
    this.nextUI += dt;
    if (this.nextUI > 0.08) {
      this.nextUI = 0;
      this.emit();
    }
  }

  direction(dx: number, dy: number): number {
    return ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 2) % 8 + 8) % 8;
  }

  spawnEnemy(kind?: string) {
    let m;
    if (kind) {
      m = MONSTERS.find((x) => x.id === kind)!;
    } else {
      const pool = MONSTERS.slice(0, Math.min(4, 1 + Math.ceil(this.wave / 2)));
      m = this.rng.pick(pool);
    }

    const angle = this.rng.next() * Math.PI * 2;
    const dist = 420 + this.rng.next() * 150;
    const elite =
      m.id !== 'boss' &&
      this.wave >= 4 &&
      this.spawned === Math.floor(WAVE_BUDGET[this.wave - 1] / 2);
    const waveMult = 1 + (this.wave - 1) * 0.12;
    const hp = m.hp * (elite ? 4 : 1) * waveMult;

    this.enemies.push({
      id: ++this.id,
      kind: m.id,
      x: clamp(this.player.x + Math.cos(angle) * dist, 25, WORLD.w - 25),
      y: clamp(this.player.y + Math.sin(angle) * dist, 50, WORLD.h - 25),
      hp,
      maxHp: hp,
      speed: m.speed * (1 + this.wave * 0.025),
      damage: m.damage * (1 + (this.wave - 1) * 0.12),
      exp: m.exp * (elite ? 5 : 1),
      dir: 4,
      windup: 0,
      attackCD: 0,
      hitAt: -1,
      burnAt: 0,
      elite,
      born: this.clock,
    });
  }

  private magicDamage(base: number, s: Skill): number {
    const mc = 3 + this.rng.next() * 4 + (this.stats.mc_flat ?? 0);
    let damage =
      (base + mc) * (1 + s.power / 100) * (1 + (this.stats.mc_bonus_pct ?? 0) / 100);
    if (this.rng.next() < (this.stats.crit_chance ?? 0) / 100) {
      damage *= 1.5 + (this.stats.crit_mult ?? 0);
    }
    return Math.round(damage);
  }

  cast(s: Skill) {
    if (this.phase !== 'battle') return;

    // Filter targets in range (620px)
    const targets = this.enemies
      .filter((e) => e.hp > 0)
      .sort((a, b) => {
        const da = Math.hypot(a.x - this.player.x, a.y - this.player.y);
        const db = Math.hypot(b.x - this.player.x, b.y - this.player.y);
        if (s.id === 'lightning') {
          return (a.kind === 'boss' ? -1000 : 0) - (b.kind === 'boss' ? -1000 : 0) + da - db;
        }
        return da - db;
      })
      .filter((e) => Math.hypot(e.x - this.player.x, e.y - this.player.y) < 620);

    if (s.id !== 'shield' && !targets.length) return;

    if (s.id === 'shield') {
      if (!targets.length) return;
      this.player.shieldUntil = this.clock + Math.min(7, 6 * (1 + s.duration / 100));
      sound.playShield();
    } else if (s.id === 'fireball') {
      const count = 1 + s.count;
      for (const e of targets.slice(0, count)) {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const dist = Math.hypot(dx, dy);
        const speed = 360 * (1 + (this.stats.projectile_speed ?? 0) / 100);
        this.projectiles.push({
          id: ++this.id,
          x: this.player.x,
          y: this.player.y - 20,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          damage: this.magicDamage(7, s),
          life: 2.2,
          dir: ((Math.round(Math.atan2(dy, dx) / (Math.PI / 8)) + 4) % 16 + 16) % 16,
        });
      }
      sound.playFireball();
    } else if (s.id === 'lightning') {
      const count = 1 + s.count;
      for (const e of targets.slice(0, count)) {
        this.hit(e, this.magicDamage(15, s), 'lightning');
        this.effects.push({
          id: ++this.id,
          kind: 'lightning',
          x: e.x,
          y: e.y,
          life: 0.45,
          total: 0.45,
          radius: 0,
        });
      }
      sound.playLightning();
    } else if (s.id === 'firewall') {
      const e = targets.reduce(
        (best, curr) =>
          this.hash.nearby(curr.x, curr.y, 100).length >
          this.hash.nearby(best.x, best.y, 100).length
            ? curr
            : best,
        targets[0]
      );
      const activeWalls = this.effects.filter((f) => f.kind === 'firewall');
      if (activeWalls.length >= 4) {
        const oldest = activeWalls[0];
        oldest.life = 0;
      }
      const duration = 6 * (1 + s.duration / 100) * (1 + (this.stats.duration ?? 0) / 100);
      this.effects.push({
        id: ++this.id,
        kind: 'firewall',
        x: e.x + (this.player.x - e.x) * 0.2,
        y: e.y + (this.player.y - e.y) * 0.2,
        life: duration,
        total: duration,
        radius: 64 * (1 + s.radius / 100) * (1 + (this.stats.skill_radius ?? 0) / 100),
      });
      sound.playFirewall();
    }

    // Set cooldown respecting CDR cap and local CDR
    s.cd = Math.max(
      s.id === 'shield' ? 8 : 0.4,
      getSkill(s.id).cooldown *
        (1 - (this.stats.cooldown_reduction ?? 0) / 100) *
        (1 - s.localCDR / 100)
    );

    if (s.id !== 'shield') {
      this.player.castUntil = this.clock + 0.22;
      if (!this.player.moving && targets.length) {
        this.player.dir = this.direction(
          targets[0].x - this.player.x,
          targets[0].y - this.player.y
        );
      }
    }
  }

  hit(e: Enemy, damage: number, skill: string) {
    if (e.hp <= 0 || this.phase !== 'battle') return;
    const actualDamage = Math.min(e.hp, damage);
    e.hp -= damage;
    e.hitAt = this.clock;
    this.damageDealt[skill] = (this.damageDealt[skill] ?? 0) + actualDamage;

    if (this.floating.length < 45) {
      this.floating.push({
        id: ++this.id,
        x: e.x,
        y: e.y - 40,
        text: String(damage),
        color: skill === 'lightning' ? '#fae57c' : '#fca652',
        life: 0.75,
      });
    }

    if (e.hp <= 0) {
      this.kills++;
      this.waveKills++;
      if (e.kind === 'boss') this.bossKilled = true;

      const gold =
        Math.round((this.rng.next() < 0.65 ? 4 : 0) * (1 + (this.stats.gold_gain ?? 0) / 100)) *
        (e.elite ? 4 : 1);
      const exp = Math.round(e.exp * (1 + (this.stats.exp_gain ?? 0) / 100));

      if (this.drops.length >= 300) {
        this.drops[0].exp += exp;
        this.drops[0].gold += gold;
      } else {
        this.drops.push({
          id: ++this.id,
          x: e.x,
          y: e.y,
          exp,
          gold,
          born: this.clock,
        });
      }
    }
  }

  hurt(raw: number) {
    if (this.phase !== 'battle' || this.clock < this.player.hitUntil) return;
    if (this.rng.next() < (5 + (this.stats.dodge ?? 0)) / 100) {
      this.floating.push({
        id: ++this.id,
        x: this.player.x,
        y: this.player.y - 50,
        text: '闪避',
        color: '#7be3b2',
        life: 0.6,
      });
      return;
    }

    const shieldBonus =
      this.clock < this.player.shieldUntil
        ? Math.min(
            0.35,
            0.2 + (this.skills.find((s) => s.id === 'shield')?.shieldReduction ?? 0) / 100
          )
        : 0;

    const damage = incomingDamage(raw, this.stats.def_flat ?? 0, shieldBonus);
    this.player.hp = Math.max(0, this.player.hp - damage);
    this.player.hitUntil = this.clock + 0.45;
    sound.playHit();

    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 60,
      text: `−${damage}`,
      color: '#f87171',
      life: 0.9,
    });

    if (this.player.hp === 0) {
      this.finish(false);
    }
  }

  beginUpgrade() {
    this.exp -= expNeeded(this.level);
    this.level++;
    sound.playLevelUp();
    this.choices = this.makeChoices();
    this.phase = 'upgrade';
    this.input = { x: 0, y: 0 };
    this.emit();
  }

  makeChoices(): Upgrade[] {
    const newSkill = SKILLS.find((s) => !this.skills.some((a) => a.id === s.id));
    const candidates: Upgrade[] = [];

    // Offer new skill if slots < 6
    if (newSkill && this.skills.length < 6) {
      candidates.push({
        id: `learn-${newSkill.id}`,
        kind: 'skill',
        skill: newSkill.id as SkillId,
        name: `习得 · ${newSkill.name}`,
        description: newSkill.description,
        value: 0,
      });
    }

    // Offer skill enhancements for existing skills with rank < 3
    for (const s of this.skills.filter((s) => s.rank < 3)) {
      const name = getSkill(s.id).name;
      const fields: [Upgrade['field'], number, string][] =
        s.id === 'shield'
          ? [
              ['shieldReduction', 8, '减伤 +8%'],
              ['duration', 15, '持续时间 +15%'],
            ]
          : s.id === 'firewall'
            ? [
                ['duration', 30, '持续时间 +30%'],
                ['radius', 20, '范围半径 +20%'],
                ['power', 22, '伤害 +22%'],
              ]
            : [
                ['power', s.id === 'lightning' ? 25 : 22, `伤害 +${s.id === 'lightning' ? 25 : 22}%`],
                ['count', 1, '发射/打击目标 +1'],
              ];

      for (const [field, value, label] of fields) {
        candidates.push({
          id: `${s.id}-${field}`,
          kind: 'skill',
          skill: s.id,
          name: `${name} · ${label}`,
          description: `升至 Lv.${s.rank + 1}，强化技能效果并保留已有属性。`,
          field,
          value,
        });
      }
    }

    const list: Upgrade[] = [];
    if (newSkill && this.skills.length < 6) {
      list.push(candidates.shift()!);
    } else if (candidates.length) {
      list.push(this.rng.pick(candidates));
    }

    const more = this.rng.shuffle(candidates.filter((c) => c.id !== list[0]?.id));
    if (more.length) list.push(more[0]);

    // Stat upgrades respecting caps
    const statPool: Upgrade[] = [
      {
        id: 'stat-mc',
        kind: 'stat',
        name: '魔法精进',
        description: '全法术魔法伤害 +8%。',
        stat: 'mc_bonus_pct',
        value: 8,
      },
      {
        id: 'stat-hp',
        kind: 'stat',
        name: '强健体魄',
        description: '最大生命 +12，并立刻恢复 12 点生命。',
        stat: 'hp_max',
        value: 12,
      },
      {
        id: 'stat-pickup',
        kind: 'stat',
        name: '拾取强化',
        description: '拾取范围 +20%，受软硬上限约束。',
        stat: 'pickup_radius',
        value: 20,
      },
      {
        id: 'stat-speed',
        kind: 'stat',
        name: '轻装行进',
        description: '移动速度 +5%，最高有效加成 35%。',
        stat: 'move_speed',
        value: 5,
      },
      {
        id: 'stat-cd',
        kind: 'stat',
        name: '施法加速',
        description: '冷却缩减 +3%，最高有效加成 40%。',
        stat: 'cooldown_reduction',
        value: 3,
      },
    ];

    const validStats = statPool.filter(
      (c) =>
        effective(c.stat!, (this.stats[c.stat!] ?? 0) + c.value) >
        (this.stats[c.stat!] ?? 0)
    );

    for (const c of this.rng.shuffle(validStats)) {
      if (list.length < 3) list.push(c);
    }

    return list;
  }

  choose(id: string) {
    if (this.phase !== 'upgrade') return;
    const c = this.choices.find((c) => c.id === id);
    if (!c) return;

    if (c.kind === 'skill') {
      let s = this.skills.find((s) => s.id === c.skill);
      if (!s) {
        if (this.skills.length >= 6) return;
        this.skills.push(this.newSkill(c.skill!));
      } else {
        if (s.rank >= 3 || !c.field) return;
        s.rank++;
        (s[c.field] as number) += c.value;
      }
    } else if (c.stat) {
      this.upgrades[c.stat] = (this.upgrades[c.stat] ?? 0) + c.value;
      this.recompute();
      if (c.stat === 'hp_max') {
        this.player.hp = Math.min(this.maxHP, this.player.hp + c.value);
      }
    }

    this.choices = [];
    this.phase = 'battle';

    if (this.exp >= expNeeded(this.level)) {
      this.beginUpgrade();
    } else {
      this.emit();
    }
  }

  endWave() {
    if (this.phase !== 'battle') return;
    sound.playWaveComplete();

    // Auto-reclaim drops: 100% leftover EXP, 50% leftover Gold
    let leftoverExp = 0;
    let leftoverGold = 0;
    for (const d of this.drops) {
      leftoverExp += d.exp;
      leftoverGold += d.gold;
    }
    this.exp += leftoverExp;
    const reclaim = Math.floor(leftoverGold * 0.5);
    this.gold += reclaim;
    this.totalGold += reclaim;
    this.waveGold += reclaim;

    this.drops = [];
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];

    if (this.exp >= expNeeded(this.level)) {
      this.beginUpgrade();
      return;
    }

    if (this.wave === this.maxWaves) {
      this.finish(this.bossKilled);
      return;
    }

    this.lastWaveGold = this.waveGold;
    this.lastWaveKills = this.waveKills;
    this.phase = 'shop';
    this.rerolls = 0;
    this.generateOffers(true);
    this.input = { x: 0, y: 0 };
    this.emit();
  }

  validItem(item: Item): boolean {
    if (item.kind === 'passive') {
      if (item.maxCount !== null && (this.passives[item.id] ?? 0) >= item.maxCount) {
        return false;
      }
      if (
        Object.entries(item.stats).every(
          ([k, v]) =>
            effective(k as StatKey, (this.stats[k as StatKey] ?? 0) + v) <=
            (this.stats[k as StatKey] ?? 0)
        )
      ) {
        return false;
      }
    }
    return item.kind !== 'heal' || this.player.hp < this.maxHP;
  }

  generateOffers(keep: boolean) {
    const retained = keep ? this.offers.filter((o) => o.locked && !o.sold) : [];
    const tier = this.wave >= 7 ? 4 : this.wave >= 3 ? 3 : 1;
    const pool = ITEMS.filter((x) => x.tier <= tier && this.validItem(x));
    this.offers = retained;

    for (let i = retained.length; i < 4; i++) {
      const choices = pool.filter(
        (x) => !this.offers.some((o) => o.itemId === x.id) && (i !== 0 || x.kind === 'passive')
      );
      const item = this.rng.pick(choices.length ? choices : pool);
      this.offers.push({
        id: ++this.id,
        itemId: item.id,
        price: Math.round(item.price * (1 + 0.045 * (this.wave - 1))),
        locked: false,
        sold: false,
      });
    }
  }

  equipmentSlot(item: Item): Slot {
    const slots = (SLOT_KEYS as readonly Slot[]).filter(
      (s: Slot) =>
        s === item.slot ||
        s.startsWith(item.slot === 'braceletL' ? 'bracelet' : item.slot === 'ringL' ? 'ring' : '~')
    );
    return slots.find((s: Slot) => !this.equipment[s]) ?? slots[0];
  }

  buy(id: number): boolean {
    if (this.phase !== 'shop') return false;
    const offer = this.offers.find((o) => o.id === id);
    if (!offer || offer.sold || this.gold < offer.price) return false;
    const item = getItem(offer.itemId);
    if (!this.validItem(item)) return false;

    this.gold -= offer.price;
    offer.sold = true;
    offer.locked = false;

    if (item.kind === 'equipment') {
      const slot = this.equipmentSlot(item);
      const old = this.equipment[slot];
      if (old) {
        this.gold += sellPrice(old.paid, getItem(old.itemId).price);
      }
      this.equipment[slot] = { itemId: item.id, paid: offer.price };
    } else if (item.kind === 'passive') {
      this.passives[item.id] = (this.passives[item.id] ?? 0) + 1;
    } else {
      this.player.hp = Math.min(this.maxHP, this.player.hp + 35);
    }

    this.recompute();
    this.emit();
    return true;
  }

  sell(slot: Slot): boolean {
    if (this.phase !== 'shop') return false;
    const e = this.equipment[slot];
    if (!e) return false;
    this.gold += sellPrice(e.paid, getItem(e.itemId).price);
    delete this.equipment[slot];
    this.recompute();
    this.emit();
    return true;
  }

  lock(id: number) {
    if (this.phase !== 'shop') return;
    const o = this.offers.find((o) => o.id === id);
    if (o && !o.sold) {
      o.locked = !o.locked;
      this.emit();
    }
  }

  reroll(): boolean {
    if (this.phase !== 'shop' || this.gold < this.cooldownCost) return false;
    this.gold -= this.cooldownCost;
    this.rerolls++;
    this.generateOffers(true);
    this.emit();
    return true;
  }

  nextWave() {
    if (this.phase !== 'shop') return;
    this.wave++;
    this.waveTime = 0;
    this.waveGold = 0;
    this.waveKills = 0;
    this.spawned = 0;
    this.spawnTimer = 0.25;
    this.phase = 'battle';
    this.emit();
  }

  finish(won: boolean) {
    if (this.result) return;
    this.phase = won ? 'won' : 'dead';
    this.result = {
      runId: this.runId,
      mode: this.mode,
      seed: this.seed,
      won,
      wave: this.wave,
      kills: this.kills,
      seconds: Math.round(this.clock),
      level: this.level,
      gold: this.totalGold,
      crystals: this.mode === 'normal' && won ? 3 : 0,
      skillDamage: { ...this.damageDealt },
      skills: this.skills.map((s) => `${getSkill(s.id).name} Lv.${s.rank}`),
    };
    this.input = { x: 0, y: 0 };
    this.emit();
  }
}

export const game = new Game();
