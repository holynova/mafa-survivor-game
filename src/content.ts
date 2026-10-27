import { z } from 'zod';
import type {
  Bonuses,
  HeroClass,
  Item,
  ItemAffix,
  MapChapter,
  SkillId,
  Slot,
  StatKey,
  TalentDef,
} from './types';
import draft from '../docs/design-data-V0.9.json';

export interface ClassBase {
  name: string;
  role: string;
  description: string;
  hp: number;
  speed: number;
  def: number;
  mdef: number;
  dodge: number;
  startingSkill: SkillId;
  allowedSkills: SkillId[];
}

export const CLASS_BASES: Record<HeroClass, ClassBase> = {
  wizard: {
    name: '法师',
    role: '远程高爆发 · 范围轰炸',
    description: '掌握冰火雷电之力的远距智者。具备极强的群怪清理与点杀能力，依靠魔法盾保命。',
    hp: 100,
    speed: 220,
    def: 0,
    mdef: 2,
    dodge: 5,
    startingSkill: 'fireball',
    allowedSkills: [
      'fireball',
      'ring_of_fire',
      'entice',
      'hellfire',
      'lightning',
      'great_fireball',
      'teleport',
      'firebang',
      'firewall',
      'laser',
      'thunderwave',
      'shield',
      'holy_word',
      'ice_storm',
    ],
  },
  taoist: {
    name: '道士',
    role: '召唤随从 · 持续续航 · 施毒削弱',
    description: '通晓阴阳道法与医理的隐士。可召唤骷髅与喷火神兽协同作战，毒疗兼备。',
    hp: 135,
    speed: 215,
    def: 2,
    mdef: 3,
    dodge: 5,
    startingSkill: 'soul_fireball',
    allowedSkills: [
      'heal_self',
      'spirit_combat',
      'poison',
      'soul_fireball',
      'summon_skeleton',
      'stealth',
      'mass_stealth',
      'spirit_shield',
      'holy_armor',
      'mind_eye',
      'paralyze_charm',
      'mass_heal',
      'summon_shinsu',
    ],
  },
  warrior: {
    name: '战士',
    role: '近战重甲 · 剑气爆发 · 坚韧突进',
    description: '身披重铠手持巨剑的近战霸主。高生命高防御，依靠半月群攻与烈火剑法一击必杀。',
    hp: 185,
    speed: 205,
    def: 5,
    mdef: 1,
    dodge: 3,
    startingSkill: 'half_moon',
    allowedSkills: [
      'basic_swordplay',
      'slashing_swordplay',
      'piercing_swordplay',
      'half_moon',
      'savage_charge',
      'fire_swordplay',
    ],
  },
};

export interface ChapterDef {
  id: MapChapter;
  name: string;
  theme: string;
  bossName: string;
  description: string;
  monsters: string[];
  bossId: string;
}

export const CHAPTERS: Record<MapChapter, ChapterDef> = {
  bichon: {
    id: 'bichon',
    name: '比奇荒野',
    theme: '草地林地 · 开阔平原',
    bossName: '骷髅精灵',
    description: '初出茅庐的试炼之地，怪潮涌动。末波决战身手矫健的双刀红骷髅。',
    monsters: ['scarecrow', 'cat', 'rakecat', 'orc', 'orc_warrior', 'spider', 'orc_hero'],
    bossId: 'boss_bichon',
  },
  mine: {
    id: 'mine',
    name: '废弃矿洞',
    theme: '阴湿矿道 · 幽暗古墓',
    bossName: '尸王',
    description: '充斥着僵尸与铁轨坑道的幽深矿洞。末波决战操纵铁链地动的万尸之王。',
    monsters: ['maggot', 'skeleton', 'skeleton_warrior', 'skeleton_archer', 'zombie', 'black_maggot', 'tongs'],
    bossId: 'boss_mine',
  },
  temple: {
    id: 'temple',
    name: '祖玛神庙',
    theme: '古老祭坛 · 神秘石殿',
    bossName: '祖玛教主',
    description: '古老邪恶教派的核心圣地。面对高护甲的祖玛卫士、雕像与狂暴的远古教主。',
    monsters: ['zuma_guard', 'zuma_archer', 'zuma_statue', 'woma_warrior', 'woma_hero', 'moth'],
    bossId: 'boss_zuma',
  },
  tomb: {
    id: 'tomb',
    name: '石墓洞窟',
    theme: '幽冥石墓 · 狂暴野猪',
    bossName: '白野猪',
    description: '机关重重的古墓石室。末波决战手握流星重锤的白野猪与邪恶毒蛇。',
    monsters: ['red_boar', 'black_boar', 'black_maggot', 'moth', 'evil_snake'],
    bossId: 'boss_boar',
  },
  desert: {
    id: 'desert',
    name: '盟重土城',
    theme: '苍茫大漠 · 黄沙古城',
    bossName: '触龙神',
    description: '黄沙漫天的盟重荒漠。与飞蛾、恶蛆、钳虫厮杀，末波决战破地而出的千年毒龙。',
    monsters: ['black_maggot', 'tongs', 'moth', 'orc_hero', 'evil_snake'],
    bossId: 'boss_dragon',
  },
  cangyue: {
    id: 'cangyue',
    name: '苍月海岛',
    theme: '碧海金沙 · 牛魔神殿',
    bossName: '牛魔王',
    description: '碧海潮生的异域古岛。末波决战手握开山巨斧、狂暴旋风烈火的牛魔之王。',
    monsters: ['orc_hero', 'red_boar', 'black_boar', 'tongs', 'evil_snake', 'moon_spider'],
    bossId: 'boss_ox',
  },
  moon: {
    id: 'moon',
    name: '赤月峡谷',
    theme: '血色巢穴 · 万蛛魔窟',
    bossName: '赤月恶魔',
    description: '盘根错节的血色深渊。在月魔蜘蛛与双头巨魔的狂潮中决战地刺恶魔本体。',
    monsters: ['moon_spider', 'moth', 'black_maggot', 'evil_snake', 'boss_kong', 'boss_blood'],
    bossId: 'boss_moon',
  },
};

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  cooldown: z.number().nonnegative(),
  description: z.string(),
  heroClass: z.enum(['wizard', 'taoist', 'warrior']),
  asset: z.string(),
  passive: z.boolean().optional(),
});

export interface SkillDef {
  id: SkillId;
  name: string;
  cooldown: number;
  description: string;
  heroClass: HeroClass;
  asset: string;
  passive?: boolean;
}

export const SKILLS: SkillDef[] = [
  // --- WIZARD (14) ---
  {
    id: 'fireball',
    name: '火球术',
    cooldown: 0.8,
    description: '向最近敌人发射火球弹道，命中造成单体魔法伤害。',
    heroClass: 'wizard',
    asset: 'fireball/8/0',
  },
  {
    id: 'ring_of_fire',
    name: '抗拒火环',
    cooldown: 7.5,
    description: '释放环形烈焰冲击波，猛烈推开周围迫近的非Boss魔物。',
    heroClass: 'wizard',
    asset: 'repulse/2',
  },
  {
    id: 'entice',
    name: '诱惑之光',
    cooldown: 4.8,
    description: '以法力诱惑普通魔物倒戈，收归为随从宝宝一同杀敌（上限2~3只）。',
    heroClass: 'wizard',
    asset: 'charm/1',
  },
  {
    id: 'hellfire',
    name: '地狱火',
    cooldown: 1.5,
    description: '向前喷涌出贯通直线的地狱烈焰，重创路径上的成排魔物。',
    heroClass: 'wizard',
    asset: 'hellfire/0',
  },
  {
    id: 'lightning',
    name: '雷电术',
    cooldown: 0.95,
    description: '瞬降强力雷击，优先锁定精英与威胁最大的目标。',
    heroClass: 'wizard',
    asset: 'lightning/2',
  },
  {
    id: 'great_fireball',
    name: '大火球',
    cooldown: 1.2,
    description: '凝聚高烈度强力火球轰击目标，伤害显著高于基础火球。',
    heroClass: 'wizard',
    asset: 'bigfireball/0/0',
  },
  {
    id: 'teleport',
    name: '瞬息移动',
    cooldown: 16.0,
    description: '危机时刻穿梭空间脱离险境（空格键或危急自动触发）。',
    heroClass: 'wizard',
    asset: 'teleport/0',
  },
  {
    id: 'firebang',
    name: '爆裂火焰',
    cooldown: 1.8,
    description: '在敌群密集处引爆 3×3 范围烈焰，造成高额范围伤害。',
    heroClass: 'wizard',
    asset: 'explosion/2',
  },
  {
    id: 'firewall',
    name: '火墙',
    cooldown: 4.5,
    description: '在地面铺设烈火区域，对穿越火海的魔物持续造成多段燃烧伤害。',
    heroClass: 'wizard',
    asset: 'firewall/2',
  },
  {
    id: 'laser',
    name: '疾光电影',
    cooldown: 2.2,
    description: '激发一道贯穿屏幕的疾速电光光束，瞬间穿透成行成列的魔物。',
    heroClass: 'wizard',
    asset: 'beam/0/0',
  },
  {
    id: 'thunderwave',
    name: '地狱雷光',
    cooldown: 3.0,
    description: '引爆自身为中心的环形狂暴雷池，重创周身全部包围魔物。',
    heroClass: 'wizard',
    asset: 'nova/1',
  },
  {
    id: 'shield',
    name: '魔法盾',
    cooldown: 11.0,
    description: '凝聚法力气场，提供持续 5 秒的直接减伤（不可永久常驻）。',
    heroClass: 'wizard',
    asset: 'shield/1',
  },
  {
    id: 'holy_word',
    name: '圣言术',
    cooldown: 5.0,
    description: '念诵圣言，有概率直接秒杀不死系魔物；对Boss造成大额比例伤害。',
    heroClass: 'wizard',
    asset: 'holy/1',
  },
  {
    id: 'ice_storm',
    name: '冰咆哮',
    cooldown: 2.8,
    description: '在目标区域召唤极寒暴风雪，造成无视魔法防御的强力大范围伤害。',
    heroClass: 'wizard',
    asset: 'ice/2',
  },

  // --- TAOIST (13) ---
  {
    id: 'heal_self',
    name: '治愈术',
    cooldown: 5.5,
    description: '以道符之力沐浴灵光，回复自身及随从的生命值。',
    heroClass: 'taoist',
    asset: 'item/治愈术',
  },
  {
    id: 'spirit_combat',
    name: '精神力战法',
    cooldown: 0,
    description: '【常驻被动】凝聚精神念力，道术伤害 +15%，基础命中与暴击提升。',
    heroClass: 'taoist',
    asset: 'item/精神力战法',
    passive: true,
  },
  {
    id: 'poison',
    name: '施毒术',
    cooldown: 3.2,
    description: '向魔物泼洒红绿双色蛊毒，使其持续损血并削弱其物理/魔法防御。',
    heroClass: 'taoist',
    asset: 'item/施毒术',
  },
  {
    id: 'soul_fireball',
    name: '灵魂火符',
    cooldown: 0.95,
    description: '驱役道家灵符化为离火飞弹，精准轰击远方魔物。',
    heroClass: 'taoist',
    asset: 'item/灵魂火符',
  },
  {
    id: 'summon_skeleton',
    name: '召唤骷髅',
    cooldown: 10.0,
    description: '破土唤醒手持重斧的变异骷髅仆从，忠心追击周围魔物。',
    heroClass: 'taoist',
    asset: 'item/召唤骷髅',
  },
  {
    id: 'stealth',
    name: '隐身术',
    cooldown: 13.5,
    description: '捏诀隐去身形，使普通魔物在短时间内丧失追击目标。',
    heroClass: 'taoist',
    asset: 'item/隐身术',
  },
  {
    id: 'mass_stealth',
    name: '集体隐身术',
    cooldown: 17.0,
    description: '为自身及身侧所有召唤随从施加隐匿屏障，降低围攻压力。',
    heroClass: 'taoist',
    asset: 'item/集体隐身术',
  },
  {
    id: 'spirit_shield',
    name: '幽灵盾',
    cooldown: 12.0,
    description: '施展金光幽灵护罩，短时间内大幅提升魔法防御 MDEF。',
    heroClass: 'taoist',
    asset: 'item/幽灵盾',
  },
  {
    id: 'holy_armor',
    name: '神圣战甲术',
    cooldown: 12.0,
    description: '降下神圣战甲真言，短时间内大幅提升物理防御 DEF。',
    heroClass: 'taoist',
    asset: 'item/神圣战甲术',
  },
  {
    id: 'mind_eye',
    name: '心灵启示',
    cooldown: 5.5,
    description: '洞察魔物灵魂气血，揭示Boss生命并在攻击时更容易击中其弱点。',
    heroClass: 'taoist',
    asset: 'item/困魔咒',
  },
  {
    id: 'paralyze_charm',
    name: '困魔咒',
    cooldown: 9.5,
    description: '画地为牢形成灵光结界，困禁结界内的非Boss魔物使其无法移动。',
    heroClass: 'taoist',
    asset: 'item/困魔咒',
  },
  {
    id: 'mass_heal',
    name: '群体治疗术',
    cooldown: 8.0,
    description: '降下大范围疗愈甘霖，同时治愈自身与整支召唤大军。',
    heroClass: 'taoist',
    asset: 'item/群体治愈术',
  },
  {
    id: 'summon_shinsu',
    name: '召唤神兽',
    cooldown: 18.0,
    description: '召唤玛法至尊喷火神兽！身躯硬朗，喷吐大范围高温烈火焚尽魔物。',
    heroClass: 'taoist',
    asset: 'item/召唤神兽',
  },

  // --- WARRIOR (6) ---
  {
    id: 'basic_swordplay',
    name: '基本剑术',
    cooldown: 0,
    description: '【常驻被动】千锤百炼的剑术根基，物理攻击力 +20%，命中率大幅提高。',
    heroClass: 'warrior',
    asset: 'item/基本剑术',
    passive: true,
  },
  {
    id: 'slashing_swordplay',
    name: '攻杀剑术',
    cooldown: 1.35,
    description: '挥剑时凝聚内劲，每隔数击爆发出撕裂空气的超额暴击斩击。',
    heroClass: 'warrior',
    asset: 'item/攻杀剑术',
  },
  {
    id: 'piercing_swordplay',
    name: '刺杀剑术',
    cooldown: 1.8,
    description: '向前刺出 2 格距离的破空剑气，无视目标护甲造成贯穿伤害。',
    heroClass: 'warrior',
    asset: 'item/刺杀剑术',
  },
  {
    id: 'half_moon',
    name: '半月弯刀',
    cooldown: 2.0,
    description: '长剑挥舞划出如半月般的锐利刀光，大范围横扫面前 180° 全部敌人。',
    heroClass: 'warrior',
    asset: 'item/半月弯刀',
  },
  {
    id: 'savage_charge',
    name: '野蛮冲撞',
    cooldown: 8.0,
    description: '以浑身神力向前极速冲撞，将沿途魔物猛力推开并施加击晕硬直。',
    heroClass: 'warrior',
    asset: 'item/野蛮冲撞',
  },
  {
    id: 'fire_swordplay',
    name: '烈火剑法',
    cooldown: 4.2,
    description: '将烈火精灵附于剑锋之上，轰然劈出造成毁天灭地的 2.5 倍致命伤害！',
    heroClass: 'warrior',
    asset: 'item/烈火剑法',
  },
];

export const STAT_NAMES: Record<StatKey, string> = {
  hp_max: '生命上限',
  hp_regen: '生命回复',
  dc_flat: '物理攻击',
  dc_bonus_pct: '物攻加成',
  mc_flat: '魔法基础',
  mc_bonus_pct: '魔攻加成',
  sc_flat: '道术基础',
  sc_bonus_pct: '道术加成',
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
  summon_damage_pct: '随从伤害',
  summon_hp_pct: '随从生命',
  lifesteal: '攻击吸血',
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
  classReq: z.enum(['wizard', 'taoist', 'warrior']).optional(),
  special: z.enum(['paralyze', 'revive', 'mana_shield']).optional(),
});

const slotMap: Record<string, Slot> = {
  武器: 'weapon',
  衣服: 'armor',
  头盔: 'helmet',
  项链: 'necklace',
  手镯: 'braceletL',
  戒指: 'ringL',
};

// Complete Equipment Database
const equipmentProposalsRaw: any[] = draft.equipmentProposals || [];

export const EQUIPMENT_ITEMS: Item[] = [
  // --- Classic Weapons ---
  {
    id: 'wpn-wood',
    name: '木剑',
    kind: 'equipment',
    slot: 'weapon',
    tier: 1,
    price: 85,
    maxCount: null,
    stats: { dc_flat: 5, def_flat: 1 },
    description: 'DC 4–7 · 新手旅者的基础木质武器',
  },
  {
    id: 'wpn-ebony',
    name: '乌木剑',
    kind: 'equipment',
    slot: 'weapon',
    tier: 2,
    price: 175,
    maxCount: null,
    stats: { dc_flat: 7, mc_flat: 2 },
    description: 'DC 6–10, MC 1–2 · 具备轻微魔力共鸣的乌木长剑',
  },
  {
    id: 'wpn-bronze-axe',
    name: '青铜斧',
    kind: 'equipment',
    slot: 'weapon',
    tier: 2,
    price: 220,
    maxCount: null,
    stats: { dc_flat: 11, def_flat: 2 },
    classReq: 'warrior',
    description: 'DC 8–13 · 沉重刚劲的重型战斧',
  },
  {
    id: 'wpn-haihun',
    name: '海魂',
    kind: 'equipment',
    slot: 'weapon',
    tier: 2,
    price: 260,
    maxCount: null,
    stats: { mc_flat: 4, dc_flat: 3 },
    classReq: 'wizard',
    description: 'MC 2–5 · 宛若涌浪的三叉法戟',
  },
  {
    id: 'wpn-jiangmo',
    name: '降魔',
    kind: 'equipment',
    slot: 'weapon',
    tier: 2,
    price: 260,
    maxCount: null,
    stats: { sc_flat: 4, dc_flat: 4 },
    classReq: 'taoist',
    description: 'SC 2–4 · 降魔伏妖的道门法剑',
  },
  {
    id: 'wpn-yanyue',
    name: '偃月',
    kind: 'equipment',
    slot: 'weapon',
    tier: 3,
    price: 450,
    maxCount: null,
    stats: { mc_flat: 7, dc_flat: 5 },
    classReq: 'wizard',
    description: 'MC 3–8 · 弧如弯月的经典法杖',
  },
  {
    id: 'wpn-silver-snake',
    name: '银蛇',
    kind: 'equipment',
    slot: 'weapon',
    tier: 3,
    price: 450,
    maxCount: null,
    stats: { sc_flat: 7, dc_flat: 7, crit_chance: 4 },
    classReq: 'taoist',
    description: 'SC 3–7 · 蛇形银纹法剑，附带暴击几率',
  },
  {
    id: 'wpn-xiuluo',
    name: '修罗',
    kind: 'equipment',
    slot: 'weapon',
    tier: 3,
    price: 480,
    maxCount: null,
    stats: { dc_flat: 14, crit_chance: 5 },
    classReq: 'warrior',
    description: 'DC 10–18 · 杀气凌冽的双手开山斧',
  },
  {
    id: 'wpn-wand',
    name: '魔杖',
    kind: 'equipment',
    slot: 'weapon',
    tier: 3,
    price: 650,
    maxCount: null,
    stats: { mc_flat: 10, mc_bonus_pct: 8 },
    classReq: 'wizard',
    description: 'MC 5–12 · 雕琢细致的法系强力长杖',
  },
  {
    id: 'wpn-wuji',
    name: '无极棍',
    kind: 'equipment',
    slot: 'weapon',
    tier: 3,
    price: 680,
    maxCount: null,
    stats: { sc_flat: 10, summon_damage_pct: 15 },
    classReq: 'taoist',
    description: 'SC 5–12 · 增强随从神兽攻击力 15%',
  },
  {
    id: 'wpn-purgatory',
    name: '炼狱',
    kind: 'equipment',
    slot: 'weapon',
    tier: 3,
    price: 700,
    maxCount: null,
    stats: { dc_flat: 18, crit_mult: 0.2 },
    classReq: 'warrior',
    description: 'DC 12–22 · 烈火与狂攻的霸道巨斧',
  },
  {
    id: 'wpn-bone-staff',
    name: '骨玉权杖',
    kind: 'equipment',
    slot: 'weapon',
    tier: 4,
    price: 1100,
    maxCount: null,
    stats: { mc_flat: 16, cooldown_reduction: 8, mc_bonus_pct: 12 },
    classReq: 'wizard',
    description: 'MC 8–18 · 玛法传世神兵，大幅缩减法术冷却',
  },
  {
    id: 'wpn-dragon-sword',
    name: '龙纹剑',
    kind: 'equipment',
    slot: 'weapon',
    tier: 4,
    price: 1100,
    maxCount: null,
    stats: { sc_flat: 15, summon_damage_pct: 25, summon_hp_pct: 25 },
    classReq: 'taoist',
    description: 'SC 8–17 · 铭刻真龙秘纹，随从攻防大幅提升',
  },
  {
    id: 'wpn-judgment',
    name: '裁决之杖',
    kind: 'equipment',
    slot: 'weapon',
    tier: 4,
    price: 1200,
    maxCount: null,
    stats: { dc_flat: 26, crit_chance: 8, crit_mult: 0.3 },
    classReq: 'warrior',
    description: 'DC 15–30 · 巨沉无比的乌金战棒，一击碎骨',
  },

  // --- Armor ---
  {
    id: 'arm-cloth',
    name: '布衣',
    kind: 'equipment',
    slot: 'armor',
    tier: 1,
    price: 80,
    maxCount: null,
    stats: { def_flat: 2, mdef_flat: 1 },
    description: 'DEF 2, MDEF 1 · 简朴麻布行衣',
  },
  {
    id: 'arm-light',
    name: '轻型盔甲',
    kind: 'equipment',
    slot: 'armor',
    tier: 2,
    price: 180,
    maxCount: null,
    stats: { def_flat: 5, mdef_flat: 3, hp_max: 15 },
    description: 'DEF 3–6, MDEF 1–3 · 结实的熟皮轻甲',
  },
  {
    id: 'arm-mage-robe',
    name: '魔法长袍',
    kind: 'equipment',
    slot: 'armor',
    tier: 3,
    price: 420,
    maxCount: null,
    stats: { def_flat: 5, mdef_flat: 8, mc_flat: 4, hp_max: 20 },
    classReq: 'wizard',
    description: 'DEF 4–7, MDEF 3–6, MC 1–3 · 纯蓝法师长袍',
  },
  {
    id: 'arm-soul-robe',
    name: '灵魂战衣',
    kind: 'equipment',
    slot: 'armor',
    tier: 3,
    price: 420,
    maxCount: null,
    stats: { def_flat: 6, mdef_flat: 7, sc_flat: 4, hp_max: 25 },
    classReq: 'taoist',
    description: 'DEF 4–7, MDEF 3–6, SC 1–3 · 蕴含道灵的黄缎战袍',
  },
  {
    id: 'arm-heavy-armor',
    name: '重盔甲',
    kind: 'equipment',
    slot: 'armor',
    tier: 3,
    price: 450,
    maxCount: null,
    stats: { def_flat: 10, mdef_flat: 4, dc_flat: 2, hp_max: 35 },
    classReq: 'warrior',
    description: 'DEF 7–12, MDEF 2–4 · 沉重的精钢锁子甲',
  },
  {
    id: 'arm-devil-robe',
    name: '恶魔长袍',
    kind: 'equipment',
    slot: 'armor',
    tier: 4,
    price: 900,
    maxCount: null,
    stats: { def_flat: 8, mdef_flat: 12, mc_flat: 8, mc_bonus_pct: 10, hp_max: 35 },
    classReq: 'wizard',
    description: 'DEF 6–10, MDEF 5–8, MC 2–5 · 法师至尊恶魔之铠',
  },
  {
    id: 'arm-ghost-robe',
    name: '幽灵战衣',
    kind: 'equipment',
    slot: 'armor',
    tier: 4,
    price: 900,
    maxCount: null,
    stats: { def_flat: 9, mdef_flat: 11, sc_flat: 8, hp_regen: 2, hp_max: 40 },
    classReq: 'taoist',
    description: 'DEF 6–10, MDEF 5–8, SC 2–5 · 道士高阶灵甲，自带回血',
  },
  {
    id: 'arm-war-god',
    name: '战神盔甲',
    kind: 'equipment',
    slot: 'armor',
    tier: 4,
    price: 950,
    maxCount: null,
    stats: { def_flat: 16, mdef_flat: 7, dc_flat: 5, hp_max: 60 },
    classReq: 'warrior',
    description: 'DEF 10–16, MDEF 3–6, DC 1–3 · 威武雄壮的战神铁铠',
  },

  // --- Helmets ---
  {
    id: 'helm-bronze',
    name: '青铜头盔',
    kind: 'equipment',
    slot: 'helmet',
    tier: 1,
    price: 90,
    maxCount: null,
    stats: { def_flat: 3, hp_max: 10 },
    description: 'DEF 2–4 · 朴素的青铜护盔',
  },
  {
    id: 'helm-magic',
    name: '魔法头盔',
    kind: 'equipment',
    slot: 'helmet',
    tier: 2,
    price: 240,
    maxCount: null,
    stats: { def_flat: 3, mdef_flat: 4, mc_flat: 2, sc_flat: 2 },
    description: 'DEF 2–4, MDEF 2–4 · 镶嵌魔晶的护面头盔',
  },
  {
    id: 'helm-skeleton',
    name: '骷髅头盔',
    kind: 'equipment',
    slot: 'helmet',
    tier: 3,
    price: 480,
    maxCount: null,
    stats: { def_flat: 7, mdef_flat: 4, dc_flat: 2, hp_max: 20 },
    description: 'DEF 4–7, MDEF 2–4 · 坚硬森白的骨制坚盔',
  },
  {
    id: 'helm-black-iron',
    name: '黑铁头盔',
    kind: 'equipment',
    slot: 'helmet',
    tier: 4,
    price: 850,
    maxCount: null,
    stats: { def_flat: 12, mdef_flat: 6, hp_max: 40 },
    description: 'DEF 6–12, MDEF 3–6 · 极其坚固的玛法重盔之王',
  },

  // --- Necklaces ---
  {
    id: 'neck-gold',
    name: '金项链',
    kind: 'equipment',
    slot: 'necklace',
    tier: 1,
    price: 95,
    maxCount: null,
    stats: { dodge: 3, gold_gain: 8 },
    description: '敏捷 +1 · 纯金打造的链饰，增加金币拾取与闪避',
  },
  {
    id: 'neck-white-gold',
    name: '白金项链',
    kind: 'equipment',
    slot: 'necklace',
    tier: 2,
    price: 260,
    maxCount: null,
    stats: { mc_flat: 3, cooldown_reduction: 3 },
    classReq: 'wizard',
    description: 'MC 2–4 · 闪烁白金光泽的法师项链',
  },
  {
    id: 'neck-glass',
    name: '放大镜',
    kind: 'equipment',
    slot: 'necklace',
    tier: 3,
    price: 460,
    maxCount: null,
    stats: { mc_flat: 6, mc_bonus_pct: 6, crit_chance: 4 },
    classReq: 'wizard',
    description: 'MC 3–6, 暴击 +4% · 凝视弱点的魔法项链',
  },
  {
    id: 'neck-life',
    name: '生命项链',
    kind: 'equipment',
    slot: 'necklace',
    tier: 4,
    price: 850,
    maxCount: null,
    stats: { mc_flat: 9, hp_max: 30, hp_regen: 2 },
    classReq: 'wizard',
    description: 'MC 4–9, 生命回复 +2/秒 · 蕴育生机的法术奇宝',
  },
  {
    id: 'neck-tian-zhu',
    name: '天珠项链',
    kind: 'equipment',
    slot: 'necklace',
    tier: 3,
    price: 520,
    maxCount: null,
    stats: { sc_flat: 6, hp_regen: 1.5, summon_damage_pct: 10 },
    classReq: 'taoist',
    description: 'SC 3–6 · 增益道术与召唤仆从攻击',
  },
  {
    id: 'neck-ghost',
    name: '幽灵项链',
    kind: 'equipment',
    slot: 'necklace',
    tier: 4,
    price: 880,
    maxCount: null,
    stats: { dc_flat: 8, crit_chance: 6, crit_mult: 0.25 },
    classReq: 'warrior',
    description: 'DC 4–9, 暴击 +6% · 战神狂战士必备首饰',
  },

  // --- Bracelets ---
  {
    id: 'brac-iron',
    name: '铁手镯',
    kind: 'equipment',
    slot: 'braceletL',
    tier: 1,
    price: 70,
    maxCount: null,
    stats: { def_flat: 2 },
    description: 'DEF 1–2 · 质朴沉重的铁环手镯',
  },
  {
    id: 'brac-ebony',
    name: '黑檀手镯',
    kind: 'equipment',
    slot: 'braceletL',
    tier: 2,
    price: 210,
    maxCount: null,
    stats: { mc_flat: 3, def_flat: 1 },
    classReq: 'wizard',
    description: 'MC 1–3, DEF 1 · 幽黑发亮的魔导木镯',
  },
  {
    id: 'brac-daoshi',
    name: '道士手镯',
    kind: 'equipment',
    slot: 'braceletL',
    tier: 2,
    price: 210,
    maxCount: null,
    stats: { sc_flat: 3, mdef_flat: 1 },
    classReq: 'taoist',
    description: 'SC 1–3 · 纯净古木雕就的修道者手镯',
  },
  {
    id: 'brac-sibeier',
    name: '思贝儿手镯',
    kind: 'equipment',
    slot: 'braceletL',
    tier: 3,
    price: 490,
    maxCount: null,
    stats: { mc_flat: 6, mdef_flat: 3 },
    classReq: 'wizard',
    description: 'MC 2–5, MDEF 2 · 镶嵌宝石的高贵手镯',
  },
  {
    id: 'brac-sanying',
    name: '三眼手镯',
    kind: 'equipment',
    slot: 'braceletL',
    tier: 3,
    price: 520,
    maxCount: null,
    stats: { sc_flat: 6, def_flat: 4 },
    classReq: 'taoist',
    description: 'SC 2–5, DEF 3 · 具三目法力的护道法镯',
  },
  {
    id: 'brac-ghost',
    name: '幽灵手套',
    kind: 'equipment',
    slot: 'braceletL',
    tier: 4,
    price: 820,
    maxCount: null,
    stats: { def_flat: 8, dc_flat: 4, hp_max: 25 },
    classReq: 'warrior',
    description: 'DEF 4–8, DC 2–4 · 坚硬威猛的重装手甲',
  },

  // --- Rings & Special Rings ---
  {
    id: 'ring-glass',
    name: '玻璃戒指',
    kind: 'equipment',
    slot: 'ringL',
    tier: 1,
    price: 75,
    maxCount: null,
    stats: { mc_flat: 2 },
    description: 'MC 1–2 · 晶莹剔透的基础魔晶指环',
  },
  {
    id: 'ring-hex',
    name: '六角戒指',
    kind: 'equipment',
    slot: 'ringL',
    tier: 2,
    price: 190,
    maxCount: null,
    stats: { mc_flat: 3, def_flat: 1 },
    classReq: 'wizard',
    description: 'MC 1–3, DEF 1 · 雕有六芒星纹路的法戒',
  },
  {
    id: 'ring-snake-eye',
    name: '蛇眼戒指',
    kind: 'equipment',
    slot: 'ringL',
    tier: 2,
    price: 240,
    maxCount: null,
    stats: { mc_flat: 4, crit_chance: 3 },
    classReq: 'wizard',
    description: 'MC 2–4 · 宛若蛇瞳凝视的毒火灵戒',
  },
  {
    id: 'ring-bo-luo',
    name: '紫碧螺',
    kind: 'equipment',
    slot: 'ringL',
    tier: 4,
    price: 950,
    maxCount: null,
    stats: { mc_flat: 9, mc_bonus_pct: 12, cooldown_reduction: 5 },
    classReq: 'wizard',
    description: 'MC 4–9 · 传世法系至尊戒指，魔法爆发暴增',
  },
  {
    id: 'ring-boyu',
    name: '铂金戒指',
    kind: 'equipment',
    slot: 'ringL',
    tier: 3,
    price: 520,
    maxCount: null,
    stats: { sc_flat: 6, def_flat: 3 },
    classReq: 'taoist',
    description: 'SC 2–5, DEF 2 · 纯白铂金打就的道术灵戒',
  },
  {
    id: 'ring-tai-tan',
    name: '泰坦戒指',
    kind: 'equipment',
    slot: 'ringL',
    tier: 4,
    price: 950,
    maxCount: null,
    stats: { sc_flat: 9, summon_damage_pct: 20 },
    classReq: 'taoist',
    description: 'SC 4–9 · 玛法至尊道戒，大幅提升神兽伤害',
  },
  {
    id: 'ring-coral',
    name: '珊瑚戒指',
    kind: 'equipment',
    slot: 'ringL',
    tier: 3,
    price: 500,
    maxCount: null,
    stats: { dc_flat: 6, crit_chance: 4 },
    classReq: 'warrior',
    description: 'DC 2–5 · 如血色珊瑚般夺目的近战利刃指环',
  },
  {
    id: 'ring-strength',
    name: '力量戒指',
    kind: 'equipment',
    slot: 'ringL',
    tier: 4,
    price: 980,
    maxCount: null,
    stats: { dc_flat: 10, dc_bonus_pct: 12, crit_mult: 0.3 },
    classReq: 'warrior',
    description: 'DC 4–10 · 充盈着开山神力的战士终极至尊戒',
  },

  // --- Classic Special Rings (特戒) ---
  {
    id: 'ring-paralyze',
    name: '麻痹戒指',
    kind: 'equipment',
    slot: 'ringR',
    tier: 4,
    price: 1500,
    maxCount: null,
    stats: { dc_flat: 4, crit_chance: 5 },
    special: 'paralyze',
    description: '【经典特戒】攻击命中敌人时有 12% 几率使其石化麻痹 2 秒！',
  },
  {
    id: 'ring-shield-special',
    name: '护身戒指',
    kind: 'equipment',
    slot: 'ringR',
    tier: 4,
    price: 1500,
    maxCount: null,
    stats: { mdef_flat: 6, mc_flat: 4 },
    special: 'mana_shield',
    description: '【经典特戒】法力无边，遭受所有伤害额外减少 20%（受总承伤硬上限保护）！',
  },
  {
    id: 'ring-revive',
    name: '复活戒指',
    kind: 'equipment',
    slot: 'ringR',
    tier: 4,
    price: 1600,
    maxCount: null,
    stats: { def_flat: 4, mdef_flat: 4, hp_max: 30 },
    special: 'revive',
    description: '【经典特戒】生命归零时立刻原地复活并回复 50% 生命（每局限触发 1 次）！',
  },

  // --- Hongmo Set (虹魔套装) ---
  {
    id: 'neck-hongmo',
    name: '虹魔项链',
    kind: 'equipment',
    slot: 'necklace',
    tier: 3,
    price: 650,
    maxCount: null,
    stats: { dc_flat: 4, mc_flat: 4, sc_flat: 4, lifesteal: 3 },
    setKey: 'hongmo',
    description: '【虹魔套装】攻击吸血 3%，集齐套装激活强大噬血光环',
  },
  {
    id: 'brac-hongmo',
    name: '虹魔手镯',
    kind: 'equipment',
    slot: 'braceletL',
    tier: 3,
    price: 650,
    maxCount: null,
    stats: { def_flat: 3, mdef_flat: 3, lifesteal: 2 },
    setKey: 'hongmo',
    description: '【虹魔套装】赤红魔纹手镯，攻击吸血 2%',
  },
  {
    id: 'ring-hongmo',
    name: '虹魔戒指',
    kind: 'equipment',
    slot: 'ringL',
    tier: 3,
    price: 650,
    maxCount: null,
    stats: { dc_flat: 5, mc_flat: 5, sc_flat: 5, lifesteal: 2 },
    setKey: 'hongmo',
    description: '【虹魔套装】玛法魔族至宝，攻击吸血 2%',
  },

  // --- Moxue Set (魔血套装) ---
  {
    id: 'neck-moxue',
    name: '魔血项链',
    kind: 'equipment',
    slot: 'necklace',
    tier: 3,
    price: 650,
    maxCount: null,
    stats: { hp_max: 30, mc_flat: 3, sc_flat: 3 },
    setKey: 'moxue',
    description: '【魔血套装】蕴含太古魔血，大幅提升生命上限',
  },
  {
    id: 'brac-moxue',
    name: '魔血手镯',
    kind: 'equipment',
    slot: 'braceletL',
    tier: 3,
    price: 650,
    maxCount: null,
    stats: { hp_max: 30, def_flat: 3 },
    setKey: 'moxue',
    description: '【魔血套装】血玉凝结而成的护腕，强固气血',
  },
  {
    id: 'ring-moxue',
    name: '魔血戒指',
    kind: 'equipment',
    slot: 'ringL',
    tier: 3,
    price: 650,
    maxCount: null,
    stats: { hp_max: 30, mdef_flat: 3 },
    setKey: 'moxue',
    description: '【魔血套装】魔力化血，生存能力极大强化',
  },

  // --- Memory Set (记忆套装) ---
  {
    id: 'neck-memory',
    name: '记忆项链',
    kind: 'equipment',
    slot: 'necklace',
    tier: 4,
    price: 950,
    maxCount: null,
    stats: { dc_flat: 6, crit_chance: 6 },
    luck: 2,
    setKey: 'memory',
    description: '【记忆套装】极其罕见的运+2幸运项链！运九套终极圣物',
  },
  {
    id: 'helm-memory',
    name: '记忆头盔',
    kind: 'equipment',
    slot: 'helmet',
    tier: 3,
    price: 500,
    maxCount: null,
    stats: { def_flat: 6, mdef_flat: 4, exp_gain: 10 },
    setKey: 'memory',
    description: '【记忆套装】凝聚往昔英灵记忆的青铜战盔',
  },
  {
    id: 'brac-memory',
    name: '记忆手镯',
    kind: 'equipment',
    slot: 'braceletL',
    tier: 3,
    price: 500,
    maxCount: null,
    stats: { mc_flat: 4, sc_flat: 4, gold_gain: 15 },
    setKey: 'memory',
    description: '【记忆套装】雕刻古符文的记忆护镯',
  },
  {
    id: 'ring-memory',
    name: '记忆戒指',
    kind: 'equipment',
    slot: 'ringL',
    tier: 4,
    price: 1200,
    maxCount: null,
    stats: { dc_flat: 6, mc_flat: 6, sc_flat: 6, cooldown_reduction: 8 },
    setKey: 'memory',
    description: '【记忆套装】天地合一的召集魔戒',
  },

  // --- Classic Zuma Regalia (祖玛套名牌) ---
  {
    id: 'neck-green',
    name: '绿色项链',
    kind: 'equipment',
    slot: 'necklace',
    tier: 4,
    price: 900,
    maxCount: null,
    classReq: 'warrior',
    stats: { dc_flat: 9, dc_bonus_pct: 10 },
    setKey: 'zuma_warrior',
    description: '【祖玛名器】墨绿玉髓项链，战士攻击力大幅提升',
  },
  {
    id: 'brac-knight',
    name: '骑士手镯',
    kind: 'equipment',
    slot: 'braceletL',
    tier: 4,
    price: 850,
    maxCount: null,
    classReq: 'warrior',
    stats: { dc_flat: 6, def_flat: 5 },
    setKey: 'zuma_warrior',
    description: '【祖玛名器】骑士重装手镯，战士攻防一体',
  },
  {
    id: 'neck-demon-bell',
    name: '恶魔铃铛',
    kind: 'equipment',
    slot: 'necklace',
    tier: 4,
    price: 900,
    maxCount: null,
    classReq: 'wizard',
    stats: { mc_flat: 10, mc_bonus_pct: 10 },
    setKey: 'zuma_wizard',
    description: '【祖玛名器】恶魔头颅雕饰的金铃，法术伤害暴增',
  },
  {
    id: 'brac-dragon',
    name: '龙之手镯',
    kind: 'equipment',
    slot: 'braceletL',
    tier: 4,
    price: 850,
    maxCount: null,
    classReq: 'wizard',
    stats: { mc_flat: 6, mdef_flat: 5 },
    setKey: 'zuma_wizard',
    description: '【祖玛名器】盘龙青铜魔镯，法术防御与魔力共鸣',
  },
  {
    id: 'neck-soul',
    name: '灵魂项链',
    kind: 'equipment',
    slot: 'necklace',
    tier: 4,
    price: 900,
    maxCount: null,
    classReq: 'taoist',
    stats: { sc_flat: 10, sc_bonus_pct: 10 },
    setKey: 'zuma_taoist',
    description: '【祖玛名器】拘魂摄魄的道家至宝，大幅提升道术',
  },
  {
    id: 'neck-tiger-tooth',
    name: '白色虎齿项链',
    kind: 'equipment',
    slot: 'necklace',
    tier: 2,
    price: 320,
    maxCount: null,
    stats: { dodge: 8, def_flat: 2 },
    luck: 1,
    description: '【经典项链】虎齿精雕而成，自带幸运+1与敏捷闪避',
  },
];

// Passive Items (30 Brotato-style stacked items)
export const PASSIVE_ITEMS: Item[] = [
  {
    id: 'pas-pickup',
    name: '引力磁石',
    kind: 'passive',
    price: 55,
    tier: 1,
    maxCount: 5,
    stats: { pickup_radius: 20 },
    description: '拾取范围 +20%（受软硬上限约束）',
  },
  {
    id: 'pas-boots',
    name: '神行轻靴',
    kind: 'passive',
    price: 65,
    tier: 1,
    maxCount: 4,
    stats: { move_speed: 6 },
    description: '移动速度 +6%（最高 35%）',
  },
  {
    id: 'pas-vitality',
    name: '朱雀血石',
    kind: 'passive',
    price: 60,
    tier: 1,
    maxCount: 8,
    stats: { hp_max: 16 },
    description: '生命上限 +16，并立刻补充 16 生命',
  },
  {
    id: 'pas-regen',
    name: '灵泉玉露',
    kind: 'passive',
    price: 70,
    tier: 1,
    maxCount: 4,
    stats: { hp_regen: 1.2 },
    description: '生命回复 +1.2/秒',
  },
  {
    id: 'pas-exp',
    name: '悟道真经',
    kind: 'passive',
    price: 75,
    tier: 1,
    maxCount: 4,
    stats: { exp_gain: 12 },
    description: '战斗经验获取 +12%',
  },
  {
    id: 'pas-gold',
    name: '摇钱灵树',
    kind: 'passive',
    price: 75,
    tier: 1,
    maxCount: 4,
    stats: { gold_gain: 12 },
    description: '金币掉落加成 +12%',
  },
  {
    id: 'pas-crit',
    name: '鹰眼准星',
    kind: 'passive',
    price: 80,
    tier: 2,
    maxCount: 5,
    stats: { crit_chance: 6 },
    description: '暴击几率 +6%',
  },
  {
    id: 'pas-crit-mult',
    name: '破军之锋',
    kind: 'passive',
    price: 85,
    tier: 2,
    maxCount: 4,
    stats: { crit_mult: 0.15 },
    description: '暴击伤害倍率 +0.15',
  },
  {
    id: 'pas-cdr',
    name: '时光漏斗',
    kind: 'passive',
    price: 90,
    tier: 2,
    maxCount: 4,
    stats: { cooldown_reduction: 5 },
    description: '冷却缩减 +5%（最高 40%）',
  },
  {
    id: 'pas-radius',
    name: '灵能扩幅器',
    kind: 'passive',
    price: 80,
    tier: 2,
    maxCount: 4,
    stats: { skill_radius: 8 },
    description: '技能范围与爆炸半径 +8%',
  },
  {
    id: 'pas-duration',
    name: '延时火种',
    kind: 'passive',
    price: 70,
    tier: 1,
    maxCount: 4,
    stats: { duration: 15 },
    description: '火墙、护盾与增益持续时间 +15%',
  },
  {
    id: 'pas-dodge',
    name: '残影身法',
    kind: 'passive',
    price: 80,
    tier: 2,
    maxCount: 4,
    stats: { dodge: 5 },
    description: '闪避几率 +5%（最高 30%）',
  },
  {
    id: 'pas-magic-boost',
    name: '九阳灵芝',
    kind: 'passive',
    price: 85,
    tier: 2,
    maxCount: 5,
    stats: { mc_bonus_pct: 10 },
    description: '全部法术魔法伤害 +10%',
  },
  {
    id: 'pas-warrior-boost',
    name: '虎骨壮骨散',
    kind: 'passive',
    price: 85,
    tier: 2,
    maxCount: 5,
    stats: { dc_bonus_pct: 10 },
    description: '全部物理攻击伤害 +10%',
  },
  {
    id: 'pas-taoist-boost',
    name: '太极八卦印',
    kind: 'passive',
    price: 85,
    tier: 2,
    maxCount: 5,
    stats: { sc_bonus_pct: 10, summon_damage_pct: 12 },
    description: '道术伤害 +10%，召唤物伤害 +12%',
  },
];

export const ITEMS: Item[] = [
  ...EQUIPMENT_ITEMS,
  ...PASSIVE_ITEMS,
  {
    id: 'blessing-oil',
    name: '祝福油',
    kind: 'oil',
    price: 150,
    tier: 2,
    stats: {},
    maxCount: null,
    icon: 'item/强效金创药',
    description: '【玛法秘宝】涂抹于当前武器，有几率提升武器幸运值（最高可至幸运+7）。运9套必备神油！',
  },
  {
    id: 'heal-small',
    name: '中量金创药',
    kind: 'heal',
    price: 45,
    tier: 1,
    stats: {},
    maxCount: null,
    icon: 'item/金创药（小）',
    description: '立刻恢复 35 点生命值。',
  },
  {
    id: 'heal-big',
    name: '强效金创药',
    kind: 'heal',
    price: 85,
    tier: 2,
    stats: {},
    maxCount: null,
    icon: 'item/魔法药（小）',
    description: '立刻恢复 75 点生命值。',
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
  aiType: 'melee' | 'ranged' | 'charge' | 'summoner';
  undead?: boolean;
}

export const MONSTERS: MonsterDef[] = [
  // --- Bichon Wilderness ---
  { id: 'scarecrow', name: '稻草人', hp: 18, damage: 1, speed: 32, exp: 2, aiType: 'melee' },
  { id: 'cat', name: '多钩猫', hp: 22, damage: 2, speed: 54, exp: 2, aiType: 'melee' },
  { id: 'rakecat', name: '钉耙猫', hp: 26, damage: 3, speed: 48, exp: 3, aiType: 'charge' },
  { id: 'orc', name: '半兽人', hp: 42, damage: 4, speed: 40, exp: 4, aiType: 'melee' },
  { id: 'orc_warrior', name: '半兽战士', hp: 65, damage: 6, speed: 42, exp: 6, aiType: 'melee' },
  { id: 'spider', name: '毒蜘蛛', hp: 34, damage: 4, speed: 35, exp: 5, aiType: 'ranged' },
  { id: 'orc_hero', name: '半兽勇士', hp: 280, damage: 14, speed: 55, exp: 28, aiType: 'charge' },
  { id: 'boss_bichon', name: '骷髅精灵', hp: 950, damage: 18, speed: 58, exp: 80, aiType: 'melee', undead: true },

  // --- Mine & Catacombs ---
  { id: 'maggot', name: '洞蛆', hp: 26, damage: 3, speed: 65, exp: 4, aiType: 'charge' },
  { id: 'black_maggot', name: '黑色恶蛆', hp: 85, damage: 9, speed: 82, exp: 14, aiType: 'charge' },
  { id: 'tongs', name: '钳虫', hp: 160, damage: 14, speed: 44, exp: 22, aiType: 'melee' },
  { id: 'skeleton', name: '骷髅', hp: 50, damage: 6, speed: 44, exp: 6, aiType: 'melee', undead: true },
  { id: 'skeleton_warrior', name: '骷髅战士', hp: 70, damage: 8, speed: 46, exp: 8, aiType: 'melee', undead: true },
  { id: 'skeleton_archer', name: '骷髅弓箭手', hp: 60, damage: 7, speed: 30, exp: 8, aiType: 'ranged', undead: true },
  { id: 'zombie', name: '僵尸', hp: 110, damage: 10, speed: 28, exp: 12, aiType: 'melee', undead: true },
  { id: 'boss_mine', name: '尸王', hp: 1450, damage: 24, speed: 45, exp: 120, aiType: 'summoner', undead: true },

  // --- Zuma & Woma Temple ---
  { id: 'woma_warrior', name: '沃玛战士', hp: 95, damage: 9, speed: 46, exp: 12, aiType: 'melee' },
  { id: 'woma_hero', name: '沃玛勇士', hp: 140, damage: 13, speed: 48, exp: 18, aiType: 'charge' },
  { id: 'fire_woma', name: '火焰沃玛', hp: 90, damage: 12, speed: 36, exp: 16, aiType: 'ranged' },
  { id: 'moth', name: '楔蛾', hp: 95, damage: 11, speed: 62, exp: 16, aiType: 'ranged' },
  { id: 'zuma_guard', name: '祖玛卫士', hp: 220, damage: 18, speed: 44, exp: 28, aiType: 'melee' },
  { id: 'zuma_archer', name: '祖玛弓箭手', hp: 120, damage: 14, speed: 34, exp: 20, aiType: 'ranged' },
  { id: 'zuma_statue', name: '祖玛雕像', hp: 180, damage: 15, speed: 46, exp: 24, aiType: 'melee' },
  { id: 'boss_temple', name: '沃玛教主', hp: 1950, damage: 26, speed: 52, exp: 160, aiType: 'summoner' },
  { id: 'boss_woma', name: '沃玛教主', hp: 1950, damage: 26, speed: 52, exp: 160, aiType: 'summoner' },
  { id: 'boss_zuma', name: '祖玛教主', hp: 2500, damage: 34, speed: 52, exp: 220, aiType: 'summoner' },

  // --- Stone Tomb & Pig Cave ---
  { id: 'red_boar', name: '红野猪', hp: 220, damage: 16, speed: 48, exp: 28, aiType: 'melee' },
  { id: 'black_boar', name: '黑野猪', hp: 260, damage: 18, speed: 46, exp: 32, aiType: 'melee' },
  { id: 'evil_snake', name: '邪恶毒蛇', hp: 680, damage: 22, speed: 64, exp: 65, aiType: 'charge' },
  { id: 'boss_boar', name: '白野猪', hp: 2100, damage: 30, speed: 56, exp: 180, aiType: 'melee' },

  // --- Desert & Centipede Canyon ---
  { id: 'boss_centipede', name: '邪恶钳虫', hp: 1800, damage: 26, speed: 60, exp: 150, aiType: 'charge' },
  { id: 'boss_dragon', name: '触龙神', hp: 3200, damage: 36, speed: 0, exp: 260, aiType: 'ranged' },
  { id: 'boss_moon', name: '赤月恶魔', hp: 3800, damage: 40, speed: 0, exp: 320, aiType: 'ranged' },

  // --- Cangyue Island & Crimson Moon Expansion ---
  { id: 'boss_ox', name: '牛魔王', hp: 3500, damage: 38, speed: 54, exp: 300, aiType: 'melee' },
  { id: 'boss_kong', name: '双头金刚', hp: 1600, damage: 28, speed: 50, exp: 120, aiType: 'melee' },
  { id: 'boss_blood', name: '双头血魔', hp: 1600, damage: 30, speed: 52, exp: 120, aiType: 'melee' },
  { id: 'moon_spider', name: '月魔蜘蛛', hp: 280, damage: 20, speed: 68, exp: 36, aiType: 'charge' },
  { id: 'tiger_guard', name: '虎卫', hp: 800, damage: 26, speed: 55, exp: 60, aiType: 'melee' },
  { id: 'shinsu_real', name: '至尊神兽', hp: 1800, damage: 32, speed: 50, exp: 100, aiType: 'melee' },
];

export const TALENTS: TalentDef[] = [
  {
    key: 'robustness',
    name: '强身术',
    description: '每级提升生命上限 6%',
    maxLevel: 5,
    costPerLevel: 3,
    stat: 'hp_max',
    valuePerLevel: 6,
  },
  {
    key: 'swiftness',
    name: '神行术',
    description: '每级提升基础移动速度 3%',
    maxLevel: 5,
    costPerLevel: 3,
    stat: 'move_speed',
    valuePerLevel: 3,
  },
  {
    key: 'magnetism',
    name: '聚灵术',
    description: '每级提升掉落物拾取范围 10%',
    maxLevel: 5,
    costPerLevel: 2,
    stat: 'pickup_radius',
    valuePerLevel: 10,
  },
  {
    key: 'wealth',
    name: '财源滚滚',
    description: '每级增加掉落金币数量 8%',
    maxLevel: 5,
    costPerLevel: 2,
    stat: 'gold_gain',
    valuePerLevel: 8,
  },
  {
    key: 'enlightenment',
    name: '悟道心法',
    description: '每级增加击杀魔物经验 8%',
    maxLevel: 5,
    costPerLevel: 2,
    stat: 'exp_gain',
    valuePerLevel: 8,
  },
  {
    key: 'harmony',
    name: '天人合一',
    description: '每级减少全技能冷却时间 2%',
    maxLevel: 5,
    costPerLevel: 4,
    stat: 'cooldown_reduction',
    valuePerLevel: 2,
  },
];

export const getSkill = (id: SkillId): SkillDef => {
  const skill = SKILLS.find((x) => x.id === id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
};

export const getItem = (id: string): Item => {
  const item = ITEMS.find((x) => x.id === id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  if (!item.icon) {
    return { ...item, icon: 'item/' + item.name };
  }
  return item;
};

export function getRandomDropEquipment(
  heroClass: HeroClass,
  minTier: number,
  maxTier: number,
  rngNext: () => number
): Item {
  const candidates = EQUIPMENT_ITEMS.filter(
    (item) =>
      item.tier >= minTier &&
      item.tier <= maxTier &&
      (!item.classReq || item.classReq === heroClass)
  );
  if (candidates.length === 0) {
    const fallback = EQUIPMENT_ITEMS.filter((item) => item.tier >= minTier && item.tier <= maxTier);
    if (fallback.length === 0) return getItem(EQUIPMENT_ITEMS[0].id);
    return getItem(fallback[Math.floor(rngNext() * fallback.length)].id);
  }
  return getItem(candidates[Math.floor(rngNext() * candidates.length)].id);
}

export interface SetBonusDef {
  pieces: number;
  description: string;
  stats: Bonuses;
}

export interface EquipmentSetDef {
  key: string;
  name: string;
  bonuses: SetBonusDef[];
}

export const EQUIPMENT_SETS: Record<string, EquipmentSetDef> = {
  hongmo: {
    key: 'hongmo',
    name: '虹魔套装',
    bonuses: [
      { pieces: 2, description: '全技能命中吸血 5%', stats: { lifesteal: 5 } },
      { pieces: 3, description: '全技能命中吸血 10%，移动速度 +15%', stats: { lifesteal: 10, move_speed: 15 } },
    ],
  },
  moxue: {
    key: 'moxue',
    name: '魔血套装',
    bonuses: [
      { pieces: 2, description: '生命上限 +60，防御 +6', stats: { hp_max: 60, def_flat: 6 } },
      { pieces: 3, description: '生命上限 +150，魔防 +10，防御 +10', stats: { hp_max: 150, mdef_flat: 10, def_flat: 10 } },
    ],
  },
  memory: {
    key: 'memory',
    name: '记忆套装',
    bonuses: [
      { pieces: 2, description: '经验获取 +25%，金币获取 +25%', stats: { exp_gain: 25, gold_gain: 25 } },
      { pieces: 3, description: '全技能冷却 -12%，召唤物伤害 +35%', stats: { cooldown_reduction: 12, summon_damage_pct: 35 } },
    ],
  },
  zuma_warrior: {
    key: 'zuma_warrior',
    name: '祖玛战士套装',
    bonuses: [
      { pieces: 2, description: '攻击力 +15%，防御 +8', stats: { dc_bonus_pct: 15, def_flat: 8 } },
    ],
  },
  zuma_wizard: {
    key: 'zuma_wizard',
    name: '祖玛法师套装',
    bonuses: [
      { pieces: 2, description: '魔法伤害 +15%，魔防 +8', stats: { mc_bonus_pct: 15, mdef_flat: 8 } },
    ],
  },
  zuma_taoist: {
    key: 'zuma_taoist',
    name: '祖玛道士套装',
    bonuses: [
      { pieces: 2, description: '道术伤害 +15%，召唤物生命 +25%', stats: { sc_bonus_pct: 15, summon_hp_pct: 25 } },
    ],
  },
};

export function mutateSuperiorEquipment(baseItem: Item, rng: () => number = Math.random): Item {
  if (baseItem.kind !== 'equipment') return baseItem;

  const affixes: ItemAffix[] = [];
  const mergedStats: Bonuses = { ...baseItem.stats };
  let extraLuck = 0;

  type AffixCandidate = {
    type: StatKey | 'luck';
    name: string;
    minValue: number;
    maxValue: number;
  };

  const pool: AffixCandidate[] = [
    { type: 'dc_flat', name: '攻击', minValue: 1, maxValue: 4 },
    { type: 'mc_flat', name: '魔法', minValue: 1, maxValue: 4 },
    { type: 'sc_flat', name: '道术', minValue: 1, maxValue: 4 },
    { type: 'def_flat', name: '防御', minValue: 1, maxValue: 3 },
    { type: 'mdef_flat', name: '魔防', minValue: 1, maxValue: 3 },
    { type: 'crit_chance', name: '暴击', minValue: 2, maxValue: 5 },
    { type: 'lifesteal', name: '吸血', minValue: 1, maxValue: 3 },
  ];

  if (baseItem.slot === 'weapon' || baseItem.slot === 'necklace') {
    pool.push({ type: 'luck', name: '幸运', minValue: 1, maxValue: 1 });
  }

  const numAffixes = rng() < 0.35 ? 2 : 1;
  const shuffled = [...pool].sort(() => rng() - 0.5);

  for (let i = 0; i < numAffixes && i < shuffled.length; i++) {
    const cand = shuffled[i];
    const val = Math.floor(rng() * (cand.maxValue - cand.minValue + 1)) + cand.minValue;
    affixes.push({
      type: cand.type,
      name: cand.name,
      value: val,
    });
    if (cand.type === 'luck') {
      extraLuck += val;
    } else {
      const k = cand.type as StatKey;
      mergedStats[k] = (mergedStats[k] || 0) + val;
    }
  }

  const baseLuck = baseItem.luck || 0;

  return {
    ...baseItem,
    isSuperior: true,
    stats: mergedStats,
    affixes,
    luck: baseLuck + extraLuck,
    price: Math.round(baseItem.price * 1.35),
  };
}

export const SCENERY = [
  { id: 'deadwood', x: 780, y: 580, r: 15 },
  { id: 'deadwood', x: 1460, y: 920, r: 15 },
  { id: 'deadwood', x: 1740, y: 420, r: 15 },
  { id: 'deadwood', x: 360, y: 1100, r: 15 },
  { id: 'sign', x: 1180, y: 470, r: 12 },
  { id: 'shrub', x: 920, y: 840, r: 12 },
  { id: 'shrub', x: 620, y: 320, r: 12 },
  { id: 'shrub', x: 1580, y: 1200, r: 12 },
];

