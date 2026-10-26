export type StatKey =
  | 'hp_max'
  | 'hp_regen'
  | 'mc_flat'
  | 'mc_bonus_pct'
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
  | 'projectile_speed';

export type Bonuses = Partial<Record<StatKey, number>>;

export type SkillId = 'fireball' | 'lightning' | 'firewall' | 'shield';

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

export interface Enemy extends Entity {
  kind: string;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  exp: number;
  dir: number;
  windup: number;
  attackCD: number;
  hitAt: number;
  burnAt: number;
  elite: boolean;
  born: number;
}

export interface Projectile extends Entity {
  vx: number;
  vy: number;
  damage: number;
  life: number;
  dir: number;
}

export interface Drop extends Entity {
  exp: number;
  gold: number;
  born: number;
}

export interface Fx extends Entity {
  kind: 'lightning' | 'firewall' | 'hit' | 'cast';
  life: number;
  total: number;
  radius: number;
}

export interface Floating extends Entity {
  text: string;
  color: string;
  life: number;
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
}

export interface Upgrade {
  id: string;
  kind: 'skill' | 'stat';
  name: string;
  description: string;
  skill?: SkillId;
  field?: 'power' | 'count' | 'radius' | 'duration' | 'localCDR' | 'shieldReduction';
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
  savedAt?: number;
}
