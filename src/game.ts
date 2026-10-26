import {
  CHAPTERS,
  CLASS_BASES,
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
  type HeroClass,
  type MapChapter,
  type SkillId,
  type StatKey,
  type Slot,
  type Item,
  type Phase,
  type Mode,
  type Enemy,
  type Minion,
  type Projectile,
  type Drop,
  type Fx,
  type Floating,
  type Skill,
  type Upgrade,
  type Offer,
  type Equipped,
  type RunResult,
  type ProfileData,
} from './types';

export const WORLD = { w: 2208, h: 1536 };

export class Game {
  phase: Phase = 'lobby';
  heroClass: HeroClass = 'wizard';
  chapter: MapChapter = 'bichon';
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
  revived = false;

  player = {
    x: WORLD.w / 2,
    y: WORLD.h / 2,
    hp: 100,
    dir: 4,
    moving: false,
    hitUntil: 0,
    castUntil: 0,
    shieldUntil: 0,
    stealthUntil: 0,
    holyArmorUntil: 0,
    spiritShieldUntil: 0,
    savageCharging: 0,
  };

  skills: Skill[] = [];
  minions: Minion[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  drops: Drop[] = [];
  effects: Fx[] = [];
  floating: Floating[] = [];

  equipment: Partial<Record<Slot, Equipped>> = {};
  passives: Record<string, number> = {};
  upgrades: Bonuses = {};
  talentBonuses: Bonuses = {};
  offers: Offer[] = [];
  choices: Upgrade[] = [];
  rerolls = 0;
  freeRerolls = 2;
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

  get base() {
    return CLASS_BASES[this.heroClass];
  }

  get maxHP() {
    const raw = this.base.hp + (this.stats.hp_max ?? 0);
    return Math.max(10, Math.round(raw));
  }

  get duration() {
    return this.mode === 'trial' ? 35 : 75;
  }

  get maxWaves() {
    return this.mode === 'trial' ? 3 : 12;
  }

  get boss() {
    return this.enemies.find((e) => e.kind.startsWith('boss') && e.hp > 0);
  }

  get cooldownCost() {
    if (this.freeRerolls > 0) return 0;
    return rerollPrice(this.rerolls);
  }

  get moveSpeed() {
    const bonus = 1 + (this.stats.move_speed ?? 0) / 100;
    return this.base.speed * bonus;
  }

  get pickupRadius() {
    return 80 * (1 + (this.stats.pickup_radius ?? 0) / 100);
  }

  start(
    heroClass: HeroClass = 'wizard',
    chapter: MapChapter = 'bichon',
    mode: Mode = 'normal',
    seed = Math.floor(Math.random() * 900000) + 1000,
    profile?: ProfileData
  ) {
    this.heroClass = heroClass;
    this.chapter = chapter;
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
    this.revived = false;
    this.damageDealt = {};
    this.minions = [];
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
    this.freeRerolls = 2;
    this.result = null;
    this.spawned = 0;
    this.spawnTimer = 0.5;

    // Apply talents
    this.talentBonuses = {};
    if (profile) {
      if (profile.talents.robustness) this.talentBonuses.hp_max = profile.talents.robustness * 8;
      if (profile.talents.swiftness) this.talentBonuses.move_speed = profile.talents.swiftness * 3;
      if (profile.talents.magnetism) this.talentBonuses.pickup_radius = profile.talents.magnetism * 10;
      if (profile.talents.wealth) this.talentBonuses.gold_gain = profile.talents.wealth * 8;
      if (profile.talents.enlightenment) this.talentBonuses.exp_gain = profile.talents.enlightenment * 8;
      if (profile.talents.harmony) this.talentBonuses.cooldown_reduction = profile.talents.harmony * 2;
    }

    const base = CLASS_BASES[heroClass];
    this.player = {
      x: WORLD.w / 2,
      y: WORLD.h / 2,
      hp: base.hp,
      dir: 4,
      moving: false,
      hitUntil: 0,
      castUntil: 0,
      shieldUntil: 0,
      stealthUntil: 0,
      holyArmorUntil: 0,
      spiritShieldUntil: 0,
      savageCharging: 0,
    };

    // Starting Skill based on chosen class
    this.skills = [this.newSkill(base.startingSkill)];
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
      healPower: 0,
      poisonPower: 0,
      summonLimit: id === 'summon_skeleton' ? 1 : id === 'summon_shinsu' ? 1 : 0,
    };
  }

  recompute() {
    const list: Bonuses[] = [this.upgrades, this.talentBonuses];

    // Class specific base attack/def
    if (this.heroClass === 'warrior') list.push({ dc_flat: 10, def_flat: 5 });
    if (this.heroClass === 'wizard') list.push({ mc_flat: 8, mdef_flat: 2 });
    if (this.heroClass === 'taoist') list.push({ sc_flat: 8, def_flat: 2, mdef_flat: 3 });

    // Passive skill checks
    if (this.skills.some((s) => s.id === 'basic_swordplay')) {
      list.push({ dc_bonus_pct: 20 });
    }
    if (this.skills.some((s) => s.id === 'spirit_combat')) {
      list.push({ sc_bonus_pct: 15, crit_chance: 5 });
    }

    // Passives items
    for (const [id, count] of Object.entries(this.passives)) {
      const item = getItem(id);
      for (let i = 0; i < count; i++) list.push(item.stats);
    }

    // Equipment items
    for (const e of Object.values(this.equipment)) {
      if (e) list.push(getItem(e.itemId).stats);
    }

    // Buff bonuses
    if (this.clock < this.player.holyArmorUntil) list.push({ def_flat: 25 });
    if (this.clock < this.player.spiritShieldUntil) list.push({ mdef_flat: 25 });

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

    // HP Regeneration
    const regen = (this.stats.hp_regen ?? 0) * dt;
    if (regen > 0 && this.player.hp < this.maxHP) {
      this.player.hp = Math.min(this.maxHP, this.player.hp + regen);
    }

    // Savage charge speed boost
    if (this.player.savageCharging > 0) {
      this.player.savageCharging -= dt;
      const angle = (this.player.dir * Math.PI) / 4;
      const chargeSpeed = 480 * dt;
      this.player.x = clamp(this.player.x + Math.cos(angle) * chargeSpeed, 30, WORLD.w - 30);
      this.player.y = clamp(this.player.y + Math.sin(angle) * chargeSpeed, 45, WORLD.h - 30);

      // Push and damage enemies in charge path
      for (const e of this.hash.nearby(this.player.x, this.player.y, 45)) {
        if (e.hp > 0 && e.kind !== 'boss') {
          e.x += Math.cos(angle) * 60;
          e.y += Math.sin(angle) * 60;
          this.hit(e, 35, 'savage_charge');
        }
      }
    } else {
      // Normal Player Movement
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
      this.spawnTimer = Math.max(0.2, 1.2 - this.wave * 0.08);
    }

    // Boss Spawn: in wave 12 (or trial wave 3), at 25s (trial 10s)
    const bossTime = this.mode === 'trial' ? 10 : 25;
    if (
      this.wave === this.maxWaves &&
      this.waveTime >= bossTime &&
      !this.bossSpawned
    ) {
      this.bossSpawned = true;
      const chap = CHAPTERS[this.chapter];
      this.spawnEnemy(chap.bossId);
      this.floating.push({
        id: ++this.id,
        x: this.player.x,
        y: this.player.y - 100,
        text: `⚠️ 首领降临: ${chap.bossName}！`,
        color: '#ef4444',
        life: 2.5,
      });
    }

    // Update Minions (Follow + Attack)
    for (const m of this.minions) {
      if (m.hp <= 0) continue;
      m.attackCD = Math.max(0, m.attackCD - dt);

      // Find nearest enemy to attack
      const target = this.enemies
        .filter((e) => e.hp > 0)
        .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];

      if (target) {
        m.targetId = target.id;
        const dx = target.x - m.x;
        const dy = target.y - m.y;
        const dist = Math.hypot(dx, dy);
        m.dir = this.direction(dx, dy);

        if (dist <= m.attackRange) {
          if (m.attackCD <= 0) {
            if (m.kind === 'shinsu') {
              // Shinsu flame breath
              m.breathUntil = this.clock + 0.6;
              sound.playFirewall();
              for (const e of this.hash.nearby(m.x + dx * 0.5, m.y + dy * 0.5, 90)) {
                if (e.hp > 0) this.hit(e, Math.round(m.damage * 1.2), 'shinsu_fire');
              }
              m.attackCD = 1.6;
            } else {
              // Skeleton / Charmed melee swing
              sound.playSwordSlash();
              this.hit(target, m.damage, m.kind === 'skeleton' ? 'skeleton_slash' : 'pet_attack');
              m.attackCD = 1.0;
            }
          }
        } else {
          // Approach target
          const sp = m.speed * dt;
          m.x = clamp(m.x + (dx / dist) * sp, 20, WORLD.w - 20);
          m.y = clamp(m.y + (dy / dist) * sp, 30, WORLD.h - 20);
        }
      } else {
        // Follow player if no target
        const dx = this.player.x - m.x;
        const dy = this.player.y - m.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 65) {
          const sp = m.speed * dt;
          m.x = clamp(m.x + (dx / dist) * sp, 20, WORLD.w - 20);
          m.y = clamp(m.y + (dy / dist) * sp, 30, WORLD.h - 20);
          m.dir = this.direction(dx, dy);
        }
      }
    }
    this.minions = this.minions.filter((m) => m.hp > 0);

    // Update Enemies AI & Movement
    const isStealthed = this.clock < this.player.stealthUntil;

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;

      // Handle Statuses: Poison & Paralyze
      if (this.clock < e.status.paralyzedUntil) {
        continue; // Cannot move or attack while paralyzed
      }

      if (this.clock < e.status.poisonedUntil && this.clock >= e.burnAt) {
        this.hit(e, e.status.poisonDamage, 'poison_tick');
        e.burnAt = this.clock + 0.5;
      }

      e.attackCD = Math.max(0, e.attackCD - dt);
      e.shootCD = Math.max(0, e.shootCD - dt);

      // Choose aggro target: player or closest minion
      let targetX = this.player.x;
      let targetY = this.player.y;
      if (isStealthed && this.minions.length > 0) {
        targetX = this.minions[0].x;
        targetY = this.minions[0].y;
      }

      const dx = targetX - e.x;
      const dy = targetY - e.y;
      const d = Math.hypot(dx, dy);
      e.dir = this.direction(dx, dy);

      // Ranged Enemy Behavior (Spider, Archers, Fire Woma)
      if (e.aiType === 'ranged') {
        if (d < 240 && e.shootCD <= 0) {
          // Fire ranged projectile
          e.shootCD = 2.2;
          const speed = 200;
          this.projectiles.push({
            id: ++this.id,
            kind: e.kind === 'spider' ? 'enemy_poison' : 'enemy_arrow',
            x: e.x,
            y: e.y,
            vx: (dx / d) * speed,
            vy: (dy / d) * speed,
            damage: e.damage,
            life: 2.5,
            dir: e.dir,
            isEnemy: true,
          });
        } else if (d < 160) {
          // Back up if player gets too close
          e.x = clamp(e.x - (dx / d) * e.speed * dt * 0.7, 20, WORLD.w - 20);
          e.y = clamp(e.y - (dy / d) * e.speed * dt * 0.7, 30, WORLD.h - 20);
        } else {
          e.x = clamp(e.x + (dx / d) * e.speed * dt, 20, WORLD.w - 20);
          e.y = clamp(e.y + (dy / d) * e.speed * dt, 30, WORLD.h - 20);
        }
        continue;
      }

      // Boss Summoner Behavior (Zombie King, Woma Master)
      if (e.aiType === 'summoner' && e.shootCD <= 0) {
        e.shootCD = 7.0;
        sound.playSummon();
        this.spawnEnemy('zombie');
        this.spawnEnemy('skeleton');
      }

      // Melee & Charge Attacks
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          const hitRange = e.kind.startsWith('boss') ? 110 : 48;
          if (d < hitRange) {
            this.hurt(e.damage);
          }
          e.attackCD = e.kind.startsWith('boss') ? 1.5 : 1.1;
        }
        continue;
      }

      const triggerDist = e.kind.startsWith('boss') ? 76 : 30;
      if (d < triggerDist && e.attackCD === 0) {
        e.windup = e.kind.startsWith('boss') ? 0.65 : 0.4;
        continue;
      }

      if (d > 22) {
        // Flocking Separation Vector
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
        const rush = e.aiType === 'charge' && Math.sin(this.clock * 1.5 + e.id) > 0.7 ? 1.8 : 1;
        const sp = e.speed * rush;
        e.x = clamp(e.x + ((dx / d) * sp + sx) * dt, 20, WORLD.w - 20);
        e.y = clamp(e.y + ((dy / d) * sp + sy) * dt, 30, WORLD.h - 20);
      }
    }

    if (this.phase !== 'battle') return;

    // Auto-Casting Scheduler with independent cooldowns
    for (const s of this.skills) {
      if (s.cd > 0) {
        s.cd = Math.max(0, s.cd - dt);
      }
      if (s.cd === 0) {
        this.cast(s);
      }
    }

    // Rebuild Spatial Hash for collision checks
    this.hash.rebuild(this.enemies.filter((e) => e.hp > 0));

    // Update Projectiles (Player + Enemy)
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.isEnemy) {
        // Hits player or minion
        const distToPlayer = Math.hypot(p.x - this.player.x, p.y - this.player.y);
        if (distToPlayer < 24) {
          this.hurt(p.damage);
          p.life = 0;
        }
      } else {
        // Player projectile hits enemies
        const target = this.hash.nearby(p.x, p.y, 28).find((e) => e.hp > 0);
        if (target && p.life > 0) {
          this.hit(target, p.damage, p.kind ?? 'fireball');
          if (!p.penetrate) p.life = 0;
        }
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
          this.hit(e, this.calcDamage('wizard', 5, s), 'firewall');
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

    // UI Tick Emitter (throttle to ~12Hz)
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
    const chap = CHAPTERS[this.chapter];

    if (kind) {
      m = MONSTERS.find((x) => x.id === kind)!;
    } else {
      const available = MONSTERS.filter((x) => chap.monsters.includes(x.id));
      const pool = available.slice(0, Math.min(available.length, 1 + Math.ceil(this.wave / 2)));
      m = this.rng.pick(pool);
    }

    const angle = this.rng.next() * Math.PI * 2;
    const dist = 420 + this.rng.next() * 150;
    const isBoss = m.id.startsWith('boss');
    const elite =
      !isBoss &&
      this.wave >= 4 &&
      this.spawned === Math.floor(WAVE_BUDGET[this.wave - 1] / 2);
    const waveMult = 1 + (this.wave - 1) * 0.12;
    const hp = Math.round(m.hp * (elite ? 4 : 1) * waveMult);

    this.enemies.push({
      id: ++this.id,
      kind: m.id,
      name: m.name,
      x: clamp(this.player.x + Math.cos(angle) * dist, 25, WORLD.w - 25),
      y: clamp(this.player.y + Math.sin(angle) * dist, 50, WORLD.h - 25),
      hp,
      maxHp: hp,
      speed: m.speed * (1 + this.wave * 0.02),
      damage: Math.round(m.damage * (1 + (this.wave - 1) * 0.1)),
      exp: m.exp * (elite ? 5 : 1),
      dir: 4,
      windup: 0,
      attackCD: 0,
      shootCD: 0,
      hitAt: -1,
      burnAt: 0,
      elite,
      born: this.clock,
      aiType: m.aiType,
      undead: m.undead,
      status: {
        poisonedUntil: 0,
        poisonDamage: 0,
        poisonDefDown: 0,
        paralyzedUntil: 0,
      },
    });
  }

  calcDamage(type: 'wizard' | 'warrior' | 'taoist', base: number, s: Skill): number {
    let flat = 0;
    let bonusPct = 0;

    if (type === 'wizard') {
      flat = 3 + this.rng.next() * 4 + (this.stats.mc_flat ?? 0);
      bonusPct = this.stats.mc_bonus_pct ?? 0;
    } else if (type === 'warrior') {
      flat = 5 + this.rng.next() * 5 + (this.stats.dc_flat ?? 0);
      bonusPct = this.stats.dc_bonus_pct ?? 0;
    } else {
      flat = 4 + this.rng.next() * 4 + (this.stats.sc_flat ?? 0);
      bonusPct = this.stats.sc_bonus_pct ?? 0;
    }

    let damage = (base + flat) * (1 + s.power / 100) * (1 + bonusPct / 100);

    // Mind's Eye extra crit chance
    const extraCrit = this.skills.some((sk) => sk.id === 'mind_eye') ? 15 : 0;
    if (this.rng.next() < (extraCrit + (this.stats.crit_chance ?? 0)) / 100) {
      damage *= 1.5 + (this.stats.crit_mult ?? 0);
    }
    return Math.max(1, Math.round(damage));
  }

  cast(s: Skill) {
    if (this.phase !== 'battle') return;

    const targets = this.enemies
      .filter((e) => e.hp > 0)
      .sort((a, b) => {
        const da = Math.hypot(a.x - this.player.x, a.y - this.player.y);
        const db = Math.hypot(b.x - this.player.x, b.y - this.player.y);
        const aBoss = a.kind.startsWith('boss') ? -1000 : 0;
        const bBoss = b.kind.startsWith('boss') ? -1000 : 0;
        return aBoss - bBoss + da - db;
      })
      .filter((e) => Math.hypot(e.x - this.player.x, e.y - this.player.y) < 650);

    // Passive skills don't cast actively
    if (s.id === 'basic_swordplay' || s.id === 'spirit_combat') return;

    // --- WIZARD SKILLS ---
    if (s.id === 'fireball' || s.id === 'great_fireball') {
      if (!targets.length) return;
      const count = 1 + s.count;
      for (const e of targets.slice(0, count)) {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const dist = Math.hypot(dx, dy);
        const speed = (s.id === 'great_fireball' ? 420 : 360) * (1 + (this.stats.projectile_speed ?? 0) / 100);
        this.projectiles.push({
          id: ++this.id,
          kind: 'fireball',
          x: this.player.x,
          y: this.player.y - 20,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          damage: this.calcDamage('wizard', s.id === 'great_fireball' ? 14 : 7, s),
          life: 2.2,
          dir: ((Math.round(Math.atan2(dy, dx) / (Math.PI / 8)) + 4) % 16 + 16) % 16,
        });
      }
      sound.playFireball();
    } else if (s.id === 'lightning') {
      if (!targets.length) return;
      const count = 1 + s.count;
      for (const e of targets.slice(0, count)) {
        this.hit(e, this.calcDamage('wizard', 16, s), 'lightning');
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
      if (!targets.length) return;
      const e = targets[0];
      const activeWalls = this.effects.filter((f) => f.kind === 'firewall');
      if (activeWalls.length >= 4) {
        activeWalls[0].life = 0;
      }
      const duration = 6 * (1 + s.duration / 100) * (1 + (this.stats.duration ?? 0) / 100);
      this.effects.push({
        id: ++this.id,
        kind: 'firewall',
        x: e.x,
        y: e.y,
        life: duration,
        total: duration,
        radius: 64 * (1 + s.radius / 100) * (1 + (this.stats.skill_radius ?? 0) / 100),
      });
      sound.playFirewall();
    } else if (s.id === 'shield') {
      if (!targets.length) return;
      this.player.shieldUntil = this.clock + Math.min(7, 6 * (1 + s.duration / 100));
      sound.playShield();
    } else if (s.id === 'laser') {
      if (!targets.length) return;
      sound.playLaser();
      const angle = (this.player.dir * Math.PI) / 4;
      const length = 550;
      const ex = this.player.x + Math.cos(angle) * length;
      const ey = this.player.y + Math.sin(angle) * length;
      this.effects.push({
        id: ++this.id,
        kind: 'laser',
        x: this.player.x,
        y: this.player.y,
        life: 0.4,
        total: 0.4,
        radius: length,
        angle,
      });
      for (const e of targets) {
        const edx = e.x - this.player.x;
        const edy = e.y - this.player.y;
        const eDist = Math.hypot(edx, edy);
        const eAngle = Math.atan2(edy, edx);
        let diff = Math.abs(eAngle - angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (eDist <= length && diff < 0.35) {
          this.hit(e, this.calcDamage('wizard', 22, s), 'laser');
        }
      }
    } else if (s.id === 'ice_storm') {
      if (!targets.length) return;
      sound.playIceStorm();
      const center = targets[0];
      const r = 110 * (1 + s.radius / 100);
      this.effects.push({
        id: ++this.id,
        kind: 'ice_storm',
        x: center.x,
        y: center.y,
        life: 0.65,
        total: 0.65,
        radius: r,
      });
      for (const e of this.hash.nearby(center.x, center.y, r)) {
        if (e.hp > 0) this.hit(e, this.calcDamage('wizard', 24, s), 'ice_storm');
      }
    } else if (s.id === 'ring_of_fire') {
      const close = targets.filter((e) => Math.hypot(e.x - this.player.x, e.y - this.player.y) < 110);
      if (close.length > 0) {
        sound.playFirewall();
        this.effects.push({
          id: ++this.id,
          kind: 'ring_of_fire',
          x: this.player.x,
          y: this.player.y,
          life: 0.35,
          total: 0.35,
          radius: 120,
        });
        for (const e of close) {
          if (!e.kind.startsWith('boss')) {
            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            const dist = Math.hypot(dx, dy) || 1;
            e.x += (dx / dist) * 90;
            e.y += (dy / dist) * 90;
          }
        }
      }
    } else if (s.id === 'teleport') {
      // Teleport randomly away from danger
      const angle = this.rng.next() * Math.PI * 2;
      const dist = 280 + this.rng.next() * 80;
      this.player.x = clamp(this.player.x + Math.cos(angle) * dist, 60, WORLD.w - 60);
      this.player.y = clamp(this.player.y + Math.sin(angle) * dist, 70, WORLD.h - 60);
      sound.playRevive();
    } else if (s.id === 'holy_word') {
      if (!targets.length) return;
      const undead = targets.filter((e) => e.undead);
      const target = undead.length ? undead[0] : targets[0];
      this.effects.push({
        id: ++this.id,
        kind: 'holy_word',
        x: target.x,
        y: target.y,
        life: 0.5,
        total: 0.5,
        radius: 40,
      });
      sound.playLightning();
      if (target.undead && !target.kind.startsWith('boss') && this.rng.next() < 0.45) {
        this.hit(target, target.hp, 'holy_word'); // instant kill
      } else {
        this.hit(target, this.calcDamage('wizard', 28, s), 'holy_word');
      }
    } else if (s.id === 'thunderwave') {
      const close = targets.filter((e) => Math.hypot(e.x - this.player.x, e.y - this.player.y) < 140);
      if (close.length >= 2) {
        sound.playLightning();
        this.effects.push({
          id: ++this.id,
          kind: 'ring_of_fire',
          x: this.player.x,
          y: this.player.y,
          life: 0.4,
          total: 0.4,
          radius: 140,
        });
        for (const e of close) {
          this.hit(e, this.calcDamage('wizard', 18, s), 'thunderwave');
        }
      }
    } else if (s.id === 'entice') {
      const charmable = targets.filter((e) => !e.kind.startsWith('boss') && !e.elite);
      const petCount = this.minions.filter((m) => m.kind === 'enticed').length;
      if (charmable.length && petCount < 3 && this.rng.next() < 0.4) {
        const victim = charmable[0];
        victim.hp = 0; // consumed
        sound.playSummon();
        this.minions.push({
          id: ++this.id,
          kind: 'enticed',
          name: victim.name,
          x: victim.x,
          y: victim.y,
          hp: 60,
          maxHp: 60,
          damage: 12,
          speed: 150,
          dir: 4,
          attackCD: 0,
          attackRange: 40,
          targetId: null,
        });
      }
    }

    // --- TAOIST SKILLS ---
    else if (s.id === 'soul_fireball') {
      if (!targets.length) return;
      const count = 1 + s.count;
      for (const e of targets.slice(0, count)) {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const dist = Math.hypot(dx, dy);
        const speed = 380 * (1 + (this.stats.projectile_speed ?? 0) / 100);
        this.projectiles.push({
          id: ++this.id,
          kind: 'soul_fireball',
          x: this.player.x,
          y: this.player.y - 20,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          damage: this.calcDamage('taoist', 9, s),
          life: 2.2,
          dir: ((Math.round(Math.atan2(dy, dx) / (Math.PI / 8)) + 4) % 16 + 16) % 16,
        });
      }
      sound.playSoulFireball();
    } else if (s.id === 'heal_self') {
      if (this.player.hp < this.maxHP) {
        sound.playHeal();
        const healAmt = 30 + Math.round((this.stats.sc_flat ?? 0) * 1.5);
        this.player.hp = Math.min(this.maxHP, this.player.hp + healAmt);
        this.floating.push({
          id: ++this.id,
          x: this.player.x,
          y: this.player.y - 40,
          text: `+${healAmt}`,
          color: '#4ade80',
          life: 0.8,
        });
      }
    } else if (s.id === 'mass_heal') {
      sound.playHeal();
      const healAmt = 45 + Math.round((this.stats.sc_flat ?? 0) * 2);
      this.player.hp = Math.min(this.maxHP, this.player.hp + healAmt);
      for (const m of this.minions) {
        m.hp = Math.min(m.maxHp, m.hp + healAmt);
      }
    } else if (s.id === 'poison') {
      if (!targets.length) return;
      sound.playPoison();
      const count = 1 + s.count;
      for (const e of targets.slice(0, count)) {
        e.status.poisonedUntil = this.clock + 6.0;
        e.status.poisonDamage = Math.max(3, Math.round((this.stats.sc_flat ?? 0) * 0.8) + 4);
        e.status.poisonDefDown = 5;
        this.effects.push({
          id: ++this.id,
          kind: 'poison_cloud',
          x: e.x,
          y: e.y,
          life: 0.6,
          total: 0.6,
          radius: 35,
        });
      }
    } else if (s.id === 'summon_skeleton') {
      const skelCount = this.minions.filter((m) => m.kind === 'skeleton').length;
      if (skelCount < (s.summonLimit ?? 1)) {
        sound.playSummon();
        const bonusHP = 1 + (this.stats.summon_hp_pct ?? 0) / 100;
        const bonusDMG = 1 + (this.stats.summon_damage_pct ?? 0) / 100;
        this.minions.push({
          id: ++this.id,
          kind: 'skeleton',
          name: '变异骷髅',
          x: this.player.x + 35,
          y: this.player.y + 35,
          hp: Math.round(90 * bonusHP),
          maxHp: Math.round(90 * bonusHP),
          damage: Math.round(14 * bonusDMG),
          speed: 175,
          dir: 4,
          attackCD: 0,
          attackRange: 42,
          targetId: null,
        });
      }
    } else if (s.id === 'summon_shinsu') {
      const shinsuCount = this.minions.filter((m) => m.kind === 'shinsu').length;
      if (shinsuCount < 1) {
        sound.playSummon();
        const bonusHP = 1 + (this.stats.summon_hp_pct ?? 0) / 100;
        const bonusDMG = 1 + (this.stats.summon_damage_pct ?? 0) / 100;
        this.minions.push({
          id: ++this.id,
          kind: 'shinsu',
          name: '烈焰神兽',
          x: this.player.x - 45,
          y: this.player.y + 40,
          hp: Math.round(280 * bonusHP),
          maxHp: Math.round(280 * bonusHP),
          damage: Math.round(28 * bonusDMG),
          speed: 190,
          dir: 4,
          attackCD: 0,
          attackRange: 90,
          targetId: null,
        });
      }
    } else if (s.id === 'stealth' || s.id === 'mass_stealth') {
      this.player.stealthUntil = this.clock + 6.0;
      sound.playHeal();
    } else if (s.id === 'spirit_shield') {
      this.player.spiritShieldUntil = this.clock + 8.0;
      this.recompute();
      sound.playShield();
    } else if (s.id === 'holy_armor') {
      this.player.holyArmorUntil = this.clock + 8.0;
      this.recompute();
      sound.playShield();
    } else if (s.id === 'paralyze_charm') {
      if (!targets.length) return;
      const e = targets[0];
      for (const victim of this.hash.nearby(e.x, e.y, 80)) {
        if (!victim.kind.startsWith('boss')) {
          victim.status.paralyzedUntil = this.clock + 4.0;
        }
      }
      sound.playSoulFireball();
    }

    // --- WARRIOR SKILLS ---
    else if (s.id === 'half_moon') {
      sound.playHalfMoon();
      const angle = (this.player.dir * Math.PI) / 4;
      this.effects.push({
        id: ++this.id,
        kind: 'half_moon_sweep',
        x: this.player.x,
        y: this.player.y,
        life: 0.35,
        total: 0.35,
        radius: 110,
        angle,
      });
      for (const e of targets) {
        const edx = e.x - this.player.x;
        const edy = e.y - this.player.y;
        const eDist = Math.hypot(edx, edy);
        const eAngle = Math.atan2(edy, edx);
        let diff = Math.abs(eAngle - angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (eDist <= 110 && diff <= Math.PI / 2 + 0.3) {
          this.hit(e, this.calcDamage('warrior', 16, s), 'half_moon');
        }
      }
    } else if (s.id === 'slashing_swordplay') {
      if (!targets.length) return;
      const close = targets.filter((e) => Math.hypot(e.x - this.player.x, e.y - this.player.y) < 65);
      if (close.length) {
        sound.playSwordSlash();
        this.hit(close[0], this.calcDamage('warrior', 18, s), 'slashing_swordplay');
      }
    } else if (s.id === 'piercing_swordplay') {
      if (!targets.length) return;
      sound.playSwordSlash();
      const angle = (this.player.dir * Math.PI) / 4;
      const thrustDist = 130;
      for (const e of targets) {
        const edx = e.x - this.player.x;
        const edy = e.y - this.player.y;
        const eDist = Math.hypot(edx, edy);
        const eAngle = Math.atan2(edy, edx);
        let diff = Math.abs(eAngle - angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (eDist <= thrustDist && diff < 0.4) {
          // Ignores target defense
          this.hit(e, this.calcDamage('warrior', 24, s), 'piercing_swordplay');
        }
      }
    } else if (s.id === 'fire_swordplay') {
      if (!targets.length) return;
      const close = targets.filter((e) => Math.hypot(e.x - this.player.x, e.y - this.player.y) < 75);
      if (close.length) {
        sound.playFireSword();
        this.effects.push({
          id: ++this.id,
          kind: 'fire_slash',
          x: close[0].x,
          y: close[0].y,
          life: 0.45,
          total: 0.45,
          radius: 60,
        });
        this.hit(close[0], this.calcDamage('warrior', 45, s), 'fire_swordplay');
      }
    } else if (s.id === 'savage_charge') {
      sound.playCharge();
      this.player.savageCharging = 0.38; // 0.38s forward rush
    }

    // Set cooldown respecting CDR cap and local CDR
    const baseDef = getSkill(s.id);
    s.cd = Math.max(
      0.35,
      baseDef.cooldown *
        (1 - (this.stats.cooldown_reduction ?? 0) / 100) *
        (1 - s.localCDR / 100)
    );

    this.player.castUntil = this.clock + 0.2;
    if (!this.player.moving && targets.length) {
      this.player.dir = this.direction(
        targets[0].x - this.player.x,
        targets[0].y - this.player.y
      );
    }
  }

  hit(e: Enemy, damage: number, skill: string) {
    if (e.hp <= 0 || this.phase !== 'battle') return;
    const actualDamage = Math.min(e.hp, damage);
    e.hp -= damage;
    e.hitAt = this.clock;
    this.damageDealt[skill] = (this.damageDealt[skill] ?? 0) + actualDamage;

    // Special: Paralyze Ring (麻痹戒指)
    const hasParalyzeRing = Object.values(this.equipment).some(
      (eq) => eq && getItem(eq.itemId).special === 'paralyze'
    );
    if (hasParalyzeRing && !e.kind.startsWith('boss') && this.rng.next() < 0.12) {
      e.status.paralyzedUntil = this.clock + 2.0;
      this.floating.push({
        id: ++this.id,
        x: e.x,
        y: e.y - 60,
        text: '⚡ 麻痹',
        color: '#fbbf24',
        life: 0.75,
      });
    }

    if (this.floating.length < 45) {
      this.floating.push({
        id: ++this.id,
        x: e.x,
        y: e.y - 40,
        text: String(damage),
        color: skill.includes('fire') ? '#f97316' : skill.includes('lightning') ? '#facc15' : '#e2e8f0',
        life: 0.75,
      });
    }

    if (e.hp <= 0) {
      this.kills++;
      this.waveKills++;
      if (e.kind.startsWith('boss')) this.bossKilled = true;

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

    let shieldBonus =
      this.clock < this.player.shieldUntil
        ? Math.min(
            0.35,
            0.2 + (this.skills.find((s) => s.id === 'shield')?.shieldReduction ?? 0) / 100
          )
        : 0;

    // Special: Mana Shield Ring (护身戒指)
    const hasManaShieldRing = Object.values(this.equipment).some(
      (eq) => eq && getItem(eq.itemId).special === 'mana_shield'
    );
    if (hasManaShieldRing) {
      shieldBonus = Math.min(0.5, shieldBonus + 0.2);
    }

    const damage = incomingDamage(raw, this.stats.def_flat ?? 0, shieldBonus);
    this.player.hp = Math.max(0, this.player.hp - damage);
    this.player.hitUntil = this.clock + 0.4;
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
      // Special: Revive Ring (复活戒指)
      const hasReviveRing = Object.values(this.equipment).some(
        (eq) => eq && getItem(eq.itemId).special === 'revive'
      );
      if (hasReviveRing && !this.revived) {
        this.revived = true;
        this.player.hp = Math.round(this.maxHP * 0.5);
        this.player.hitUntil = this.clock + 1.5; // 1.5s invincibility
        sound.playRevive();
        this.floating.push({
          id: ++this.id,
          x: this.player.x,
          y: this.player.y - 80,
          text: '✨ 涅槃复活！',
          color: '#facc15',
          life: 1.5,
        });
        return;
      }

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
    const base = CLASS_BASES[this.heroClass];
    const availableSkills = SKILLS.filter(
      (s) => base.allowedSkills.includes(s.id) && !this.skills.some((a) => a.id === s.id)
    );
    const candidates: Upgrade[] = [];

    // Offer new skill if slots < 6
    if (availableSkills.length && this.skills.length < 6) {
      const newSkill = this.rng.pick(availableSkills);
      candidates.push({
        id: `learn-${newSkill.id}`,
        kind: 'skill',
        skill: newSkill.id,
        name: `习得 · ${newSkill.name}`,
        description: newSkill.description,
        value: 0,
      });
    }

    // Offer skill enhancements for existing skills with rank < 3
    for (const s of this.skills.filter((s) => s.rank < 3)) {
      const def = getSkill(s.id);
      candidates.push({
        id: `${s.id}-power`,
        kind: 'skill',
        skill: s.id,
        name: `${def.name} · 威力突破`,
        description: `升至 Lv.${s.rank + 1}，技能伤害额外提高 25%。`,
        field: 'power',
        value: 25,
      });
      if (['fireball', 'lightning', 'soul_fireball'].includes(s.id)) {
        candidates.push({
          id: `${s.id}-count`,
          kind: 'skill',
          skill: s.id,
          name: `${def.name} · 多重打击`,
          description: `升至 Lv.${s.rank + 1}，攻击与弹道目标数 +1。`,
          field: 'count',
          value: 1,
        });
      }
      if (['firewall', 'ice_storm', 'half_moon'].includes(s.id)) {
        candidates.push({
          id: `${s.id}-radius`,
          kind: 'skill',
          skill: s.id,
          name: `${def.name} · 范围扩散`,
          description: `升至 Lv.${s.rank + 1}，攻击范围与判定半径 +25%。`,
          field: 'radius',
          value: 25,
        });
      }
    }

    const list: Upgrade[] = [];
    if (candidates.length) {
      list.push(candidates.shift()!);
      const more = this.rng.shuffle(candidates);
      if (more.length) list.push(more[0]);
    }

    // Stat options
    const statPool: Upgrade[] = [
      {
        id: 'stat-atk',
        kind: 'stat',
        name: this.heroClass === 'warrior' ? '气贯长虹' : this.heroClass === 'wizard' ? '魔能澎湃' : '通幽彻冥',
        description: `本职输出伤害 +10%。`,
        stat: this.heroClass === 'warrior' ? 'dc_bonus_pct' : this.heroClass === 'wizard' ? 'mc_bonus_pct' : 'sc_bonus_pct',
        value: 10,
      },
      {
        id: 'stat-hp',
        kind: 'stat',
        name: '气血滔天',
        description: '最大生命上限 +16，并立刻恢复 16 生命。',
        stat: 'hp_max',
        value: 16,
      },
      {
        id: 'stat-pickup',
        kind: 'stat',
        name: '灵虚纳物',
        description: '拾取范围 +20%，受软硬上限约束。',
        stat: 'pickup_radius',
        value: 20,
      },
      {
        id: 'stat-speed',
        kind: 'stat',
        name: '八方神行',
        description: '移动速度 +5%，最高有效加成 35%。',
        stat: 'move_speed',
        value: 5,
      },
      {
        id: 'stat-cd',
        kind: 'stat',
        name: '流光极意',
        description: '冷却缩减 +3%，最高有效加成 40%。',
        stat: 'cooldown_reduction',
        value: 3,
      },
      {
        id: 'stat-crit',
        kind: 'stat',
        name: '致命洞察',
        description: '暴击几率 +5%。',
        stat: 'crit_chance',
        value: 5,
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
    if (item.classReq && item.classReq !== this.heroClass) return false;
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
    const tier = this.wave >= 8 ? 4 : this.wave >= 4 ? 3 : 2;
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
      const healVal = item.id === 'heal-big' ? 75 : 35;
      this.player.hp = Math.min(this.maxHP, this.player.hp + healVal);
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
    if (this.phase !== 'shop') return false;
    const cost = this.cooldownCost;
    if (this.gold < cost) return false;

    this.gold -= cost;
    if (this.freeRerolls > 0) {
      this.freeRerolls--;
    } else {
      this.rerolls++;
    }
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

    // Award crystals: 3 crystals on boss kill, +1 per 3 waves survived
    let crystals = 0;
    if (won) {
      crystals = this.mode === 'normal' ? 6 : 3;
    } else {
      crystals = Math.floor(this.wave / 3);
    }

    this.result = {
      runId: this.runId,
      heroClass: this.heroClass,
      chapter: this.chapter,
      mode: this.mode,
      seed: this.seed,
      won,
      wave: this.wave,
      kills: this.kills,
      seconds: Math.round(this.clock),
      level: this.level,
      gold: this.totalGold,
      crystals,
      skillDamage: { ...this.damageDealt },
      skills: this.skills.map((s) => `${getSkill(s.id).name} Lv.${s.rank}`),
    };
    this.input = { x: 0, y: 0 };
    this.emit();
  }
}

export const game = new Game();
