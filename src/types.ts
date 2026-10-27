export type HeroClass = 'wizard' | 'taoist' | 'warrior';
export type MapChapter = 'bichon' | 'mine' | 'temple' | 'tomb' | 'desert';

export type StatKey =
  | 'hp_max'
  | 'hp_regen'
  | 'dc_flat'
  | 'dc_bonus_pct'
  | 'mc_flat'
  | 'mc_bonus_pct'
  | 'sc_flat'
  | 'sc_bonus_pct'
  | 'def_flat'
  | 'mdef_flat'
  | 'move_speed'
  | 'pickup_radius'
  | 'cooldown_reduction'
  | 'skill_radius'
  | 'duration'
  | 'exp_gain'
  | 'gold_gain'
  | 'crit_chance'
  | 'crit_mult'
  | 'dodge'
  | 'projectile_speed'
  | 'summon_damage_pct'
  | 'summon_hp_pct';

export type Bonuses = Partial<Record<StatKey, number>>;

// All 1.76 Classic Skills across the 3 classes (14 Mage + 13 Taoist + 6 Warrior)
export type WizardSkillId =
  | 'fireball'
  | 'ring_of_fire'
  | 'entice'
  | 'hellfire'
  | 'lightning'
  | 'great_fireball'
  | 'teleport'
  | 'firebang'
  | 'firewall'
  | 'laser'
  | 'thunderwave'
  | 'shield'
  | 'holy_word'
  | 'ice_storm';

export type TaoistSkillId =
  | 'heal_self'
  | 'spirit_combat'
  | 'poison'
  | 'soul_fireball'
  | 'summon_skeleton'
  | 'stealth'
  | 'mass_stealth'
  | 'spirit_shield'
  | 'holy_armor'
  | 'mind_eye'
  | 'paralyze_charm'
  | 'mass_heal'
  | 'summon_shinsu';

export type WarriorSkillId =
  | 'basic_swordplay'
  | 'slashing_swordplay'
  | 'piercing_swordplay'
  | 'half_moon'
  | 'savage_charge'
  | 'fire_swordplay';

export type SkillId = WizardSkillId | TaoistSkillId | WarriorSkillId;

export type Phase = 'lobby' | 'battle' | 'upgrade' | 'shop' | 'paused' | 'won' | 'dead';
export type Mode = 'normal' | 'trial';

export const SLOT_KEYS = [
  'weapon',
  'armor',
  'helmet',
  'necklace',
  'braceletL',
  'braceletR',
  'ringL',
  'ringR',
] as const;
export type Slot = (typeof SLOT_KEYS)[number];

export interface Entity {
  id: number;
  x: number;
  y: number;
}

export interface EnemyStatus {
  poisonedUntil: number;
  poisonDamage: number;
  poisonDefDown: number;
  paralyzedUntil: number;
}

export interface Enemy extends Entity {
  kind: string;
  name: string;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  exp: number;
  dir: number;
  windup: number;
  attackCD: number;
  shootCD: number;
  hitAt: number;
  burnAt: number;
  elite: boolean;
  born: number;
  aiType: 'melee' | 'ranged' | 'charge' | 'summoner';
  undead?: boolean;
  status: EnemyStatus;
}

export interface Minion extends Entity {
  kind: 'skeleton' | 'shinsu' | 'enticed';
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  dir: number;
  attackCD: number;
  attackRange: number;
  targetId: number | null;
  breathUntil?: number;
}

export interface Projectile extends Entity {
  kind?: 'fireball' | 'soul_fireball' | 'enemy_arrow' | 'enemy_poison' | 'shinsu_fire';
  vx: number;
  vy: number;
  damage: number;
  life: number;
  dir: number;
  isEnemy?: boolean;
  penetrate?: boolean;
}

export interface Drop extends Entity {
  exp: number;
  gold: number;
  born: number;
  item?: Item;
  isChest?: boolean;
}

export interface Fx extends Entity {
  kind:
    | 'lightning'
    | 'firewall'
    | 'hellfire'
    | 'hit'
    | 'cast'
    | 'laser'
    | 'ring_of_fire'
    | 'ice_storm'
    | 'holy_word'
    | 'poison_cloud'
    | 'heal_sparkle'
    | 'half_moon_sweep'
    | 'fire_slash'
    | 'savage_trail'
    | 'spirit_shield'
    | 'holy_armor';
  life: number;
  total: number;
  radius: number;
  angle?: number;
  width?: number;
}

export interface Floating extends Entity {
  text: string;
  color: string;
  life: number;
  type?: 'damage' | 'crit' | 'dodge' | 'heal' | 'poison' | 'shield';
  scale?: number;
}

export interface Skill {
  id: SkillId;
  rank: number;
  cd: number;
  power: number;
  count: number;
  radius: number;
  duration: number;
  localCDR: number;
  shieldReduction: number;
  healPower?: number;
  poisonPower?: number;
  summonLimit?: number;
}

export interface Upgrade {
  id: string;
  kind: 'skill' | 'stat';
  name: string;
  description: string;
  skill?: SkillId;
  field?:
    | 'power'
    | 'count'
    | 'radius'
    | 'duration'
    | 'localCDR'
    | 'shieldReduction'
    | 'healPower'
    | 'poisonPower'
    | 'summonLimit';
  value: number;
  stat?: StatKey;
}

export interface Item {
  id: string;
  name: string;
  kind: 'equipment' | 'passive' | 'heal';
  price: number;
  tier: number;
  stats: Bonuses;
  slot?: Slot;
  maxCount: number | null;
  icon?: string;
  description: string;
  classReq?: HeroClass;
  special?: 'paralyze' | 'revive' | 'mana_shield';
}

export interface Offer {
  id: number;
  itemId: string;
  price: number;
  locked: boolean;
  sold: boolean;
}

export interface Equipped {
  itemId: string;
  paid: number;
}

export interface RunResult {
  runId: string;
  heroClass: HeroClass;
  chapter: MapChapter;
  mode: Mode;
  seed: number;
  won: boolean;
  wave: number;
  kills: number;
  seconds: number;
  level: number;
  gold: number;
  crystals: number;
  skillDamage: Record<string, number>;
  skills: string[];
  skillIds?: string[];
  equipments?: string[];
  savedAt?: number;
}

export interface ActiveRunSnapshot {
  runId: string;
  heroClass: HeroClass;
  chapter: MapChapter;
  mode: Mode;
  seed: number;
  wave: number;
  waveTime: number;
  clock: number;
  kills: number;
  gold: number;
  totalGold: number;
  level: number;
  exp: number;
  player: { x: number; y: number; hp: number; dir: number };
  skills: Skill[];
  equipment: Partial<Record<Slot, Equipped>>;
  passives: Record<string, number>;
  upgrades: Bonuses;
  acquiredSkills: string[];
  acquiredEquipments: string[];
  damageDealt: Record<string, number>;
  phase: Phase;
  timestamp: number;
  isSandbox?: boolean;
}

export type TalentKey =
  | 'robustness'
  | 'swiftness'
  | 'magnetism'
  | 'wealth'
  | 'enlightenment'
  | 'harmony';

export interface TalentDef {
  key: TalentKey;
  name: string;
  description: string;
  maxLevel: number;
  costPerLevel: number;
  stat: StatKey;
  valuePerLevel: number;
}

export interface ProfileData {
  crystals: number;
  talents: Record<TalentKey, number>;
  unlockedChapters: MapChapter[];
  unlockedClasses: HeroClass[];
  unlockedSkills?: string[];
  unlockedEquipments?: string[];
}

export interface Manifest {
  world?: {
    width: number;
    height: number;
    cellWidth: number;
    cellHeight: number;
    walk: number[];
    tiles: { texture: number; x: number; y: number }[];
    objects: {
      texture: number;
      x: number;
      y: number;
      depth: number;
      alpha: boolean;
    }[];
  };
  worlds?: Record<
    string,
    {
      width: number;
      height: number;
      cellWidth: number;
      cellHeight: number;
      walk: number[];
      tiles: { texture: number; x: number; y: number }[];
      objects: {
        texture: number;
        x: number;
        y: number;
        depth: number;
        alpha: boolean;
      }[];
    }
  >;
  pages: {
    key: string;
    image: string;
    data: string;
    width: number;
    height: number;
  }[];
  animations: Record<string, string[]>;
  frames: Record<
    string,
    {
      dx: number;
      dy: number;
      width: number;
      height: number;
      texture: string;
      originX: number;
      originY: number;
    }
  >;
  rightsStatus?: string;
}
