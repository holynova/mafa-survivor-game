import { z } from 'zod';
import type { Bonuses, Item, SkillId, Slot, StatKey } from './types';
import draft from '../docs/design-data-V0.9.json';

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  cooldown: z.number().positive(),
  description: z.string(),
  asset: z.string(),
});

export const SKILLS = [
  {
    id: 'fireball',
    name: '火球术',
    cooldown: 1.1,
    description: '自动向最近的敌人发射火球，造成单体魔法伤害。',
    asset: 'fireball/8/0',
  },
  {
    id: 'lightning',
    name: '雷电术',
    cooldown: 1.35,
    description: '降下强力雷击，优先锁定精英与高威胁目标。',
    asset: 'lightning/2',
  },
  {
    id: 'firewall',
    name: '火墙',
    cooldown: 6.5,
    description: '在密集敌群中铺设烈焰火墙，持续造成多段燃烧伤害。',
    asset: 'firewall/2',
  },
  {
    id: 'shield',
    name: '魔法盾',
    cooldown: 15.0,
    description: '凝聚法力气场，提供持续6秒的20%直接减伤（不可永久覆盖）。',
    asset: 'shield/1',
  },
].map((x) => skillSchema.parse(x));

export const STAT_NAMES: Record<StatKey, string> = {
  hp_max: '生命上限',
  hp_regen: '生命回复',
  mc_flat: '魔法基础',
  mc_bonus_pct: '魔法加成',
  def_flat: '物理防御',
  mdef_flat: '魔法防御',
  move_speed: '移动速度',
  pickup_radius: '拾取范围',
  cooldown_reduction: '冷却缩减',
  skill_radius: '技能范围',
  duration: '持续时间',
  exp_gain: '经验获取',
  gold_gain: '金币获取',
  crit_chance: '暴击几率',
  crit_mult: '暴击伤害',
  dodge: '闪避几率',
  projectile_speed: '弹道速度',
};

export const SLOT_NAMES: Record<Slot, string> = {
  weapon: '武器',
  armor: '衣服',
  helmet: '头盔',
  necklace: '项链',
  braceletL: '左手镯',
  braceletR: '右手镯',
  ringL: '左戒指',
  ringR: '右戒指',
};

export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['equipment', 'passive', 'heal']),
  price: z.number().int().positive(),
  tier: z.number().int().min(1).max(4),
  stats: z.record(z.string(), z.number()),
  slot: z.string().optional(),
  maxCount: z.number().positive().nullable(),
  icon: z.string().optional(),
  description: z.string(),
});

const slotMap: Record<string, Slot> = {
  武器: 'weapon',
  衣服: 'armor',
  头盔: 'helmet',
  项链: 'necklace',
  手镯: 'braceletL',
  戒指: 'ringL',
};

const equipmentNames = [
  '海魂',
  '偃月',
  '魔杖',
  '骨玉权杖',
  '乌木剑',
  '布衣',
  '魔法长袍',
  '恶魔长袍',
  '魔法头盔',
  '青铜头盔',
  '玻璃戒指',
  '六角戒指',
  '金项链',
  '白金项链',
  '铁手镯',
  '黑檀手镯',
  '骷髅头盔',
  '蛇眼戒指',
  '魅力戒指',
  '紫碧螺',
  '思贝儿手镯',
  '放大镜',
  '生命项链',
];

const equipmentList: Item[] = (draft.equipmentProposals || [])
  .filter((x: any) => equipmentNames.includes(x.name))
  .map((x: any, i: number) => {
    const stats: Bonuses = {};
    for (const m of x.stats.matchAll(/\b(MC|DEF|MDEF) (\d+)–(\d+)/g)) {
      const val = (Number(m[2]) + Number(m[3])) / 2;
      const key = ({ MC: 'mc_flat', DEF: 'def_flat', MDEF: 'mdef_flat' } as const)[
        m[1] as 'MC' | 'DEF' | 'MDEF'
      ];
      if (key) stats[key] = val;
    }
    const slot = slotMap[x.slot] ?? 'weapon';
    return itemSchema.parse({
      id: `equip-${i}`,
      name: x.name,
      kind: 'equipment',
      price: x.price,
      tier: x.tier,
      slot,
      stats,
      maxCount: null,
      icon: 'item/' + (['布衣', '魔法长袍', '恶魔长袍'].includes(x.name) ? x.name + '（男）' : x.name),
      description: `${x.stats} · 经典1.76装备`,
    }) as Item;
  });

const passiveKeys: StatKey[] = [
  'pickup_radius',
  'move_speed',
  'hp_max',
  'hp_regen',
  'mc_bonus_pct',
  'cooldown_reduction',
  'skill_radius',
  'duration',
  'projectile_speed',
  'exp_gain',
  'gold_gain',
  'def_flat',
  'mdef_flat',
  'crit_chance',
  'crit_mult',
  'dodge',
];

const passiveList: Item[] = (draft.passiveItemProposals || [])
  .filter((x: any) => passiveKeys.includes(x[1] as StatKey))
  .map((x: any, i: number) => {
    const statKey = x[1] as StatKey;
    const value = Number(x[2]);
    const maxCount = Number(x[4]) === 99 ? null : Number(x[4]);
    return itemSchema.parse({
      id: `passive-${i}`,
      name: x[0],
      kind: 'passive',
      price: x[3],
      tier: x[5] === '稀有' ? 2 : 1,
      stats: { [statKey]: value },
      maxCount,
      description: `${STAT_NAMES[statKey]} +${value}${
        ['hp_max', 'def_flat', 'mdef_flat'].includes(statKey)
          ? ''
          : statKey === 'hp_regen'
            ? '/秒'
            : statKey === 'crit_mult'
              ? '倍'
              : '%'
      } · ${maxCount === null ? '无上限重复' : `最多 ${maxCount} 件`}`,
    }) as Item;
  });

export const ITEMS: Item[] = [
  ...equipmentList,
  ...passiveList,
  {
    id: 'heal',
    name: '金创药',
    kind: 'heal',
    price: 45,
    tier: 1,
    stats: {},
    maxCount: null,
    icon: 'item/强效金创药',
    description: '立刻恢复 35 点生命值。',
  },
];

export const WAVE_BUDGET = [35, 48, 69, 95, 125, 158, 194, 233, 273, 316, 361, 408];

export interface MonsterDef {
  id: string;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  exp: number;
}

export const MONSTERS: MonsterDef[] = [
  { id: 'scarecrow', name: '稻草人', hp: 18, damage: 1, speed: 32, exp: 2 },
  { id: 'cat', name: '多钩猫', hp: 22, damage: 2, speed: 54, exp: 2 },
  { id: 'rakecat', name: '钉耙猫', hp: 26, damage: 3, speed: 48, exp: 3 },
  { id: 'orc', name: '半兽人', hp: 42, damage: 4, speed: 40, exp: 4 },
  { id: 'boss', name: '骷髅精灵', hp: 950, damage: 18, speed: 58, exp: 60 },
];

export const getSkill = (id: SkillId) => {
  const skill = SKILLS.find((x) => x.id === id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
};

export const getItem = (id: string) => {
  const item = ITEMS.find((x) => x.id === id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
};
