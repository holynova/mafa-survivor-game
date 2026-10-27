import {
  CHAPTERS,
  CLASS_BASES,
  ITEMS,
  MONSTERS,
  SKILLS,
  WAVE_BUDGET,
  getItem,
  getRandomDropEquipment,
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
  type ActiveRunSnapshot,
} from './types';

export const WORLD = { w: 2208, h: 1536 };

export const SKILL_ENHANCEMENTS: Record<
  string,
  Array<{
    suffix: string;
    name: string;
    desc: (r: number) => string;
    field: 'power' | 'count' | 'radius' | 'duration' | 'localCDR' | 'shieldReduction' | 'summonLimit';
    value: number;
  }>
> = {
  // --- Wizard ---
  fireball: [
    { suffix: 'pwr', name: '纯阳真火', desc: (r) => `升至 Lv.${r}，火球术伤害提升 22%。`, field: 'power', value: 22 },
    { suffix: 'cnt', name: '双火连珠', desc: (r) => `升至 Lv.${r}，额外发射 1 颗火球攻击不同目标。`, field: 'count', value: 1 },
    { suffix: 'cdr', name: '迅捷凝气', desc: (r) => `升至 Lv.${r}，火球施法冷却缩减 15%。`, field: 'localCDR', value: 15 },
  ],
  lightning: [
    { suffix: 'pwr', name: '九天神雷', desc: (r) => `升至 Lv.${r}，雷电术伤害提升 25%。`, field: 'power', value: 25 },
    { suffix: 'cnt', name: '天雷连引', desc: (r) => `升至 Lv.${r}，每次雷击同时打击目标数 +1。`, field: 'count', value: 1 },
    { suffix: 'cdr', name: '雷霆骤雨', desc: (r) => `升至 Lv.${r}，落雷冷却缩减 12%。`, field: 'localCDR', value: 12 },
  ],
  firewall: [
    { suffix: 'dur', name: '炽焰长明', desc: (r) => `升至 Lv.${r}，火墙燃烧持续时间增加 30%。`, field: 'duration', value: 30 },
    { suffix: 'rad', name: '火海蔓延', desc: (r) => `升至 Lv.${r}，火墙覆盖面积增加 25%。`, field: 'radius', value: 25 },
  ],
  shield: [
    { suffix: 'red', name: '金刚不坏', desc: (r) => `升至 Lv.${r}，魔法盾减伤效果提升至更高阶（28%/35%）。`, field: 'shieldReduction', value: 8 },
    { suffix: 'dur', name: '气脉悠长', desc: (r) => `升至 Lv.${r}，魔法盾持续时间由 6 秒增至 7 秒。`, field: 'duration', value: 16 },
  ],
  laser: [
    { suffix: 'pwr', name: '极光贯日', desc: (r) => `升至 Lv.${r}，疾光电影光束伤害提升 25%。`, field: 'power', value: 25 },
    { suffix: 'cdr', name: '瞬发雷光', desc: (r) => `升至 Lv.${r}，光束冷却缩减 12%。`, field: 'localCDR', value: 12 },
  ],
  ice_storm: [
    { suffix: 'rad', name: '极地风暴', desc: (r) => `升至 Lv.${r}，冰暴判定半径扩大 20%。`, field: 'radius', value: 20 },
    { suffix: 'pwr', name: '霜寒裂骨', desc: (r) => `升至 Lv.${r}，暴风雪伤害提升 20%。`, field: 'power', value: 20 },
  ],
  holy_word: [
    { suffix: 'pwr', name: '天威神罚', desc: (r) => `升至 Lv.${r}，对不死生物秒杀率 +12%，对 Boss 伤害提升 20%。`, field: 'power', value: 12 },
    { suffix: 'cnt', name: '双圣同降', desc: (r) => `升至 Lv.${r}，同时净化目标数 +1。`, field: 'count', value: 1 },
  ],
  entice: [
    { suffix: 'cnt', name: '控兽群聚', desc: (r) => `升至 Lv.${r}，招募宠物上限由 2 增至 3 只。`, field: 'count', value: 1 },
    { suffix: 'pwr', name: '灵兽狂化', desc: (r) => `升至 Lv.${r}，诱惑成功率 +15%，宠物伤害 +20%。`, field: 'power', value: 20 },
  ],
  ring_of_fire: [
    { suffix: 'rad', name: '烈火震退', desc: (r) => `升至 Lv.${r}，近身击退半径增加 20%。`, field: 'radius', value: 20 },
    { suffix: 'cdr', name: '灵巧御身', desc: (r) => `升至 Lv.${r}，抗拒火环冷却缩减 15%。`, field: 'localCDR', value: 15 },
  ],
  hellfire: [
    { suffix: 'pwr', name: '地狱炽焰', desc: (r) => `升至 Lv.${r}，地狱火直线贯穿伤害提升 22%。`, field: 'power', value: 22 },
    { suffix: 'rad', name: '火柱拓宽', desc: (r) => `升至 Lv.${r}，火焰宽度与射程增加 20%。`, field: 'radius', value: 20 },
  ],
  great_fireball: [
    { suffix: 'pwr', name: '烈阳重鸣', desc: (r) => `升至 Lv.${r}，大火球伤害提升 25%。`, field: 'power', value: 25 },
    { suffix: 'cnt', name: '双阳凌空', desc: (r) => `升至 Lv.${r}，额外发射 1 颗大火球攻击不同目标。`, field: 'count', value: 1 },
  ],
  teleport: [
    { suffix: 'cdr', name: '虚空遁影', desc: (r) => `升至 Lv.${r}，瞬息移动冷却时间减少 20%。`, field: 'localCDR', value: 20 },
  ],
  firebang: [
    { suffix: 'rad', name: '火海倾覆', desc: (r) => `升至 Lv.${r}，爆裂火焰判定半径增加 20%。`, field: 'radius', value: 20 },
    { suffix: 'pwr', name: '炎火重击', desc: (r) => `升至 Lv.${r}，爆炸伤害提升 20%。`, field: 'power', value: 20 },
  ],
  thunderwave: [
    { suffix: 'rad', name: '电芒扩散', desc: (r) => `升至 Lv.${r}，地狱雷光近身环形半径扩大 20%。`, field: 'radius', value: 20 },
    { suffix: 'pwr', name: '雷光万钧', desc: (r) => `升至 Lv.${r}，环形雷击伤害提升 20%。`, field: 'power', value: 20 },
  ],

  // --- Taoist ---
  soul_fireball: [
    { suffix: 'cnt', name: '双符同掷', desc: (r) => `升至 Lv.${r}，同时掷出 2 道符咒攻击不同目标。`, field: 'count', value: 1 },
    { suffix: 'pwr', name: '阴阳道力', desc: (r) => `升至 Lv.${r}，灵魂火符伤害提升 22%。`, field: 'power', value: 22 },
    { suffix: 'cdr', name: '疾行催符', desc: (r) => `升至 Lv.${r}，符咒施法冷却缩减 12%。`, field: 'localCDR', value: 12 },
  ],
  summon_skeleton: [
    { suffix: 'lim', name: '变异双骨', desc: (r) => `升至 Lv.${r}，变异骷髅召唤上限由 1 只提升至 2 只！`, field: 'summonLimit', value: 1 },
    { suffix: 'pwr', name: '白骨狂暴', desc: (r) => `升至 Lv.${r}，变异骷髅攻击伤害提升 25%。`, field: 'power', value: 25 },
  ],
  summon_shinsu: [
    { suffix: 'pwr', name: '烈焰圣兽', desc: (r) => `升至 Lv.${r}，神兽生命与喷火伤害提升 20%。`, field: 'power', value: 20 },
    { suffix: 'rad', name: '炽天火浪', desc: (r) => `升至 Lv.${r}，神兽喷火覆盖范围扩大 20%。`, field: 'radius', value: 20 },
  ],
  poison: [
    { suffix: 'dur', name: '蚀骨剧毒', desc: (r) => `升至 Lv.${r}，施毒损血持续时间延长 25%。`, field: 'duration', value: 25 },
    { suffix: 'cnt', name: '漫天毒雾', desc: (r) => `升至 Lv.${r}，同时下毒目标数 +1。`, field: 'count', value: 1 },
  ],
  heal_self: [
    { suffix: 'pwr', name: '灵泉回春', desc: (r) => `升至 Lv.${r}，治愈术治疗量提升 25%。`, field: 'power', value: 25 },
    { suffix: 'cdr', name: '妙手回生', desc: (r) => `升至 Lv.${r}，自疗冷却时间缩减 15%。`, field: 'localCDR', value: 15 },
  ],
  holy_armor: [
    { suffix: 'dur', name: '战神附体', desc: (r) => `升至 Lv.${r}，神圣战甲术持续时间延长 30%。`, field: 'duration', value: 30 },
    { suffix: 'pwr', name: '固若金汤', desc: (r) => `升至 Lv.${r}，物理防御附加效果提高 20%。`, field: 'power', value: 20 },
  ],
  spirit_shield: [
    { suffix: 'dur', name: '幽冥辟邪', desc: (r) => `升至 Lv.${r}，幽灵盾魔御持续时间延长 30%。`, field: 'duration', value: 30 },
    { suffix: 'pwr', name: '玄罡护身', desc: (r) => `升至 Lv.${r}，魔法防御附加效果提高 20%。`, field: 'power', value: 20 },
  ],
  paralyze_charm: [
    { suffix: 'rad', name: '定身禁制', desc: (r) => `升至 Lv.${r}，困魔咒定身范围增加 20%。`, field: 'radius', value: 20 },
    { suffix: 'dur', name: '锁魔金链', desc: (r) => `升至 Lv.${r}，定身持续时间延长 25%。`, field: 'duration', value: 25 },
  ],
  mass_heal: [
    { suffix: 'pwr', name: '普渡众生', desc: (r) => `升至 Lv.${r}，群体治疗量提高 25%。`, field: 'power', value: 25 },
    { suffix: 'rad', name: '甘霖普降', desc: (r) => `升至 Lv.${r}，群疗覆盖半径扩大 25%。`, field: 'radius', value: 25 },
  ],
  spirit_combat: [
    { suffix: 'pwr', name: '通玄战意', desc: (r) => `升至 Lv.${r}，精神力战法使道术威力与普攻伤害 +15%。`, field: 'power', value: 15 },
  ],
  stealth: [
    { suffix: 'dur', name: '匿形遁影', desc: (r) => `升至 Lv.${r}，隐身术持续时间延长 30%。`, field: 'duration', value: 30 },
    { suffix: 'cdr', name: '随影而行', desc: (r) => `升至 Lv.${r}，隐身术冷却缩短 15%。`, field: 'localCDR', value: 15 },
  ],
  mass_stealth: [
    { suffix: 'dur', name: '集隐太虚', desc: (r) => `升至 Lv.${r}，集体隐身持续时间延长 25%。`, field: 'duration', value: 25 },
  ],
  mind_eye: [
    { suffix: 'pwr', name: '天眼破妄', desc: (r) => `升至 Lv.${r}，暴击概率额外 +10%。`, field: 'power', value: 10 },
  ],

  // --- Warrior ---
  half_moon: [
    { suffix: 'rad', name: '刀芒破空', desc: (r) => `升至 Lv.${r}，半月扇形挥砍范围扩大 25%。`, field: 'radius', value: 25 },
    { suffix: 'pwr', name: '狂龙卷刃', desc: (r) => `升至 Lv.${r}，半月剑气伤害提升 20%。`, field: 'power', value: 20 },
    { suffix: 'cdr', name: '连环疾风', desc: (r) => `升至 Lv.${r}，半月挥砍冷却缩减 15%。`, field: 'localCDR', value: 15 },
  ],
  fire_swordplay: [
    { suffix: 'pwr', name: '天火同焚', desc: (r) => `升至 Lv.${r}，烈火剑法爆发伤害提升 25%。`, field: 'power', value: 25 },
    { suffix: 'cdr', name: '烈焰聚气', desc: (r) => `升至 Lv.${r}，烈火冷却时间缩短 15%。`, field: 'localCDR', value: 15 },
  ],
  piercing_swordplay: [
    { suffix: 'pwr', name: '破甲贯日', desc: (r) => `升至 Lv.${r}，无视防御穿透伤害提升 20%。`, field: 'power', value: 20 },
    { suffix: 'rad', name: '剑气延伸', desc: (r) => `升至 Lv.${r}，向前穿刺有效距离增加 25%。`, field: 'radius', value: 25 },
  ],
  slashing_swordplay: [
    { suffix: 'pwr', name: '霸王劈山', desc: (r) => `升至 Lv.${r}，攻杀剑术附加伤害提升 20%。`, field: 'power', value: 20 },
    { suffix: 'cdr', name: '迅影连环', desc: (r) => `升至 Lv.${r}，攻杀触发间隔缩短 15%。`, field: 'localCDR', value: 15 },
  ],
  savage_charge: [
    { suffix: 'cdr', name: '疾风踏阵', desc: (r) => `升至 Lv.${r}，野蛮冲撞冷却缩减 20%。`, field: 'localCDR', value: 20 },
    { suffix: 'rad', name: '移山倒海', desc: (r) => `升至 Lv.${r}，冲撞距离增加 20%。`, field: 'radius', value: 20 },
  ],
  basic_swordplay: [
    { suffix: 'pwr', name: '返璞归真', desc: (r) => `升至 Lv.${r}，基础剑术使物理攻击伤害提升 15%。`, field: 'power', value: 15 },
  ],
};

export interface SkillEvolutionDef {
  name: string;
  description: string;
  apply?: (s: Skill) => void;
}

export const SKILL_EVOLUTIONS: Record<string, SkillEvolutionDef> = {
  // Warrior
  half_moon: {
    name: '大狂暴 · 半月弯刀',
    description: '【终极演化】半月剑气觉醒为 360 度周身剑气风暴，基础威力提升 80%，全方位剑刃风暴横扫清屏！',
    apply: (s) => {
      s.power += 80;
      s.radius += 50;
    },
  },
  fire_swordplay: {
    name: '双烈火 · 毁灭绝斩',
    description: '【终极演化】凝结炽烈玄火，双重烈火剑气同时爆发，威力额外提升 120%，对击中目标触发群体毁灭重击！',
    apply: (s) => {
      s.power += 120;
    },
  },
  piercing_swordplay: {
    name: '破甲 · 逐日剑气',
    description: '【终极演化】刺杀真气凝聚成贯穿全屏的逐日剑芒，破甲射程提升至 450，穿透所有目标并造成巨额穿透伤害！',
    apply: (s) => {
      s.power += 100;
      s.radius += 100;
    },
  },
  slashing_swordplay: {
    name: '霸王 · 真攻杀连环',
    description: '【终极演化】攻杀剑气连环爆发，威力额外提升 80%！',
    apply: (s) => {
      s.power += 80;
    },
  },
  savage_charge: {
    name: '撼地 · 神蛮冲撞',
    description: '【终极演化】蛮王冲撞势不可挡，伤害提升 80%，冲撞距离增加 40%！',
    apply: (s) => {
      s.power += 80;
      s.radius += 40;
    },
  },
  basic_swordplay: {
    name: '返璞 · 狂风剑道',
    description: '【终极演化】返璞归真，人剑合一，本职物理攻击伤害额外提升 40%！',
    apply: (s) => {
      s.power += 40;
    },
  },

  // Wizard
  lightning: {
    name: '九天 · 狂雷神链',
    description: '【终极演化】九天狂雷从天而降，每次召唤 5 道神雷连续轰顶，附带 1.5 秒雷霆电弧群体麻痹！',
    apply: (s) => {
      s.power += 80;
      s.count += 4;
    },
  },
  firewall: {
    name: '太古 · 灭世火海',
    description: '【终极演化】召唤太古地狱火海，持续时间翻倍，覆盖半径扩大，火海上限提升至 8 处！',
    apply: (s) => {
      s.power += 80;
      s.duration += 100;
      s.radius += 50;
    },
  },
  ice_storm: {
    name: '极寒 · 暴风雪漩涡',
    description: '【终极演化】绝对零度暴风雪漩涡，强力将大范围敌人吸扯至风暴中心，并造成持续风暴撕裂与多段重击！',
    apply: (s) => {
      s.power += 80;
      s.radius += 50;
    },
  },
  laser: {
    name: '超导 · 疾光电影',
    description: '【终极演化】疾光电影进化为超导聚能光束，射程达到 800 贯穿全屏，伤害提升 100%！',
    apply: (s) => {
      s.power += 100;
    },
  },
  shield: {
    name: '混元 · 金刚不坏盾',
    description: '【终极演化】法仙护体混元盾，免伤率最高提升至 50%，持续时间大幅提升！',
    apply: (s) => {
      s.shieldReduction += 15;
      s.duration += 30;
    },
  },
  fireball: {
    name: '九阳 · 连珠爆炎',
    description: '【终极演化】火球分裂为 3 颗爆裂真火，多弹齐发轰击敌人！',
    apply: (s) => {
      s.count += 2;
      s.power += 60;
    },
  },
  great_fireball: {
    name: '耀阳 · 极阳真火',
    description: '【终极演化】大火球升华极阳天火，威力与爆炸范围大幅提升！',
    apply: (s) => {
      s.power += 80;
      s.radius += 40;
    },
  },
  hellfire: {
    name: '熔火 · 地狱天冲',
    description: '【终极演化】地狱火真龙贯穿烈焰，火柱大幅拓宽并造成双倍焚烧伤害！',
    apply: (s) => {
      s.power += 80;
      s.radius += 50;
    },
  },
  ring_of_fire: {
    name: '神威 · 拒之天界',
    description: '【终极演化】火环狂震，震退范围翻倍并对近身敌人造成震退爆破伤害！',
    apply: (s) => {
      s.radius += 60;
      s.power += 50;
    },
  },
  firebang: {
    name: '爆裂 · 连环神焰',
    description: '【终极演化】爆裂火焰连环聚爆，爆炸范围与爆鸣威力大幅提升！',
    apply: (s) => {
      s.power += 80;
      s.radius += 50;
    },
  },
  thunderwave: {
    name: '天诛 · 十方俱灭',
    description: '【终极演化】地狱雷光十方俱灭，全方位雷芒环形横扫，伤害大幅提升！',
    apply: (s) => {
      s.power += 80;
      s.radius += 40;
    },
  },
  holy_word: {
    name: '诛邪 · 天道圣言',
    description: '【终极演化】天道诛邪律令，对不死妖邪秒杀概率提升至 40%，同时对首领造成高额天罚神伤！',
    apply: (s) => {
      s.power += 40;
      s.count += 2;
    },
  },
  entice: {
    name: '通神 · 灵兽御统',
    description: '【终极演化】灵兽御统通神，宠物招募上限提升，所有召唤兽攻防大幅提升！',
    apply: (s) => {
      s.count += 1;
      s.power += 50;
    },
  },
  teleport: {
    name: '化境 · 缩地成寸',
    description: '【终极演化】瞬息移动冷却大幅缩减，闪烁后获得短暂无敌与神行加速！',
    apply: (s) => {
      s.localCDR += 25;
    },
  },

  // Taoist
  summon_shinsu: {
    name: '七级 · 至尊烈焰圣兽',
    description: '【终极演化】唤醒远古至尊喷火麒麟神兽，生命与移动速度翻倍，烈焰龙息覆盖范围大幅扩张！',
    apply: (s) => {
      s.power += 100;
      s.radius += 60;
    },
  },
  summon_skeleton: {
    name: '双尊 · 狂暴变异双骨',
    description: '【终极演化】骷髅召唤上限提升至 2 只，且变异为双持巨斧的狂暴骷髅尊者，攻速与伤害翻倍！',
    apply: (s) => {
      s.summonLimit = 2;
      s.power += 80;
    },
  },
  poison: {
    name: '万毒 · 蚀骨瘟疫',
    description: '【终极演化】绿红双毒融为蚀骨瘟疫，同时向 5 个目标施毒，持续损血与防御削减大幅加深！',
    apply: (s) => {
      s.count += 4;
      s.poisonPower = (s.poisonPower ?? 0) + 100;
      s.duration += 50;
    },
  },
  soul_fireball: {
    name: '乾坤 · 诛邪道符',
    description: '【终极演化】同时投掷 3 道阴阳太极道符，威力与飞行速度大幅提升！',
    apply: (s) => {
      s.count += 2;
      s.power += 60;
    },
  },
  heal_self: {
    name: '枯木 · 神圣还阳',
    description: '【终极演化】自疗效果提升 80%，施法间隔大幅缩短！',
    apply: (s) => {
      s.power += 80;
      s.localCDR += 20;
    },
  },
  mass_heal: {
    name: '天尊 · 普度甘霖',
    description: '【终极演化】天尊群疗普降甘露，治疗量与覆盖半径大幅提升！',
    apply: (s) => {
      s.healPower = (s.healPower ?? 0) + 80;
      s.radius += 50;
    },
  },
  spirit_shield: {
    name: '混元 · 太极幽灵盾',
    description: '【终极演化】幽灵盾持续时间与魔法防御大幅提升！',
    apply: (s) => {
      s.duration += 50;
      s.power += 50;
    },
  },
  holy_armor: {
    name: '金刚 · 真武战甲术',
    description: '【终极演化】神圣战甲持续时间与物理防御大幅提升！',
    apply: (s) => {
      s.duration += 50;
      s.power += 50;
    },
  },
  paralyze_charm: {
    name: '定身 · 万象止息咒',
    description: '【终极演化】困魔金阵范围扩大，定身时间延长至 6 秒！',
    apply: (s) => {
      s.radius += 60;
      s.duration += 50;
    },
  },
  spirit_combat: {
    name: '通玄 · 天人合一',
    description: '【终极演化】天人合一，道术与普攻伤害大幅跃升 40%！',
    apply: (s) => {
      s.power += 40;
    },
  },
  stealth: {
    name: '神隐 · 太虚匿形',
    description: '【终极演化】隐身术持续时间延长，隐身期间移动速度提升 25%！',
    apply: (s) => {
      s.duration += 50;
    },
  },
  mass_stealth: {
    name: '神隐 · 移星换宿',
    description: '【终极演化】全员隐身时间延长 50%！',
    apply: (s) => {
      s.duration += 50;
    },
  },
  mind_eye: {
    name: '通天 · 天眼洞悉',
    description: '【终极演化】洞察万物破绽，暴击率额外提升 20%！',
    apply: (s) => {
      s.power += 20;
    },
  },
};

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

  acquiredSkills = new Set<string>();
  acquiredEquipments = new Set<string>();

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
  recentDeaths: { kind: string; dir: number; x: number; y: number; at: number }[] = [];

  input = { x: 0, y: 0 };
  private listeners = new Set<() => void>();
  private id = 0;
  private spawnTimer = 0;
  spawned = 0;
  private nextUI = 0;
  private previous: Phase = 'battle';
  private hash = new SpatialHash<Enemy>();
  private waveKills = 0;
  private lastWasCrit = false;

  version = 0;
  isSandbox = false;
  timeScale = 1;
  isInvincible = false;
  debugAssets = false;
  isDebugMode = false;
  infiniteCooldown = false;
  damageMultiplier = 1;
  speedMultiplier = 1;
  private saveTimer = 0;

  static ACTIVE_RUN_KEY = 'mafa_active_run_snapshot';

  static getSavedActiveRun(): ActiveRunSnapshot | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(Game.ACTIVE_RUN_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.runId && data.player && data.skills) {
        return data as ActiveRunSnapshot;
      }
      return null;
    } catch {
      return null;
    }
  }

  static clearSavedActiveRun(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(Game.ACTIVE_RUN_KEY);
    } catch {}
  }

  saveActiveRun(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (this.phase === 'lobby' || this.phase === 'won' || this.phase === 'dead') {
      Game.clearSavedActiveRun();
      return;
    }
    try {
      const snapshot: ActiveRunSnapshot = {
        runId: this.runId,
        heroClass: this.heroClass,
        chapter: this.chapter,
        mode: this.mode,
        seed: this.seed,
        wave: this.wave,
        waveTime: this.waveTime,
        clock: this.clock,
        kills: this.kills,
        gold: this.gold,
        totalGold: this.totalGold,
        level: this.level,
        exp: this.exp,
        player: { ...this.player },
        skills: this.skills.map((s) => ({ ...s })),
        equipment: { ...this.equipment },
        passives: { ...this.passives },
        upgrades: { ...this.upgrades },
        acquiredSkills: Array.from(this.acquiredSkills),
        acquiredEquipments: Array.from(this.acquiredEquipments),
        damageDealt: { ...this.damageDealt },
        phase: this.phase,
        timestamp: Date.now(),
        isSandbox: this.isSandbox,
      };
      window.localStorage.setItem(Game.ACTIVE_RUN_KEY, JSON.stringify(snapshot));
    } catch {}
  }

  resumeActiveRun(snapshot: ActiveRunSnapshot): void {
    this.runId = snapshot.runId;
    this.heroClass = snapshot.heroClass;
    this.chapter = snapshot.chapter;
    this.mode = snapshot.mode;
    this.seed = snapshot.seed;
    this.rng = new Rng(snapshot.seed);
    this.wave = snapshot.wave;
    this.waveTime = snapshot.waveTime;
    this.clock = snapshot.clock;
    this.kills = snapshot.kills;
    this.gold = snapshot.gold;
    this.totalGold = snapshot.totalGold;
    this.level = snapshot.level;
    this.exp = snapshot.exp;
    this.player = {
      x: snapshot.player.x,
      y: snapshot.player.y,
      hp: snapshot.player.hp,
      dir: snapshot.player.dir ?? 4,
      moving: false,
      hitUntil: 0,
      castUntil: 0,
      shieldUntil: 0,
      stealthUntil: 0,
      holyArmorUntil: 0,
      spiritShieldUntil: 0,
      savageCharging: 0,
    };
    this.skills = snapshot.skills.map((s) => ({ ...s }));
    this.equipment = { ...snapshot.equipment };
    this.passives = { ...snapshot.passives };
    this.upgrades = { ...snapshot.upgrades };
    this.acquiredSkills = new Set(snapshot.acquiredSkills);
    this.acquiredEquipments = new Set(snapshot.acquiredEquipments);
    this.damageDealt = { ...snapshot.damageDealt };
    this.isSandbox = snapshot.isSandbox ?? false;
    this.recompute();
    this.phase = snapshot.phase === 'shop' || snapshot.phase === 'upgrade' ? snapshot.phase : 'battle';
    if (this.phase === 'shop' && this.offers.length === 0) {
      this.generateOffers(true);
    }
    if (this.phase === 'battle') {
      sound.startBgm();
    }
    this.emit();
  }

  // --- Developer Cheat / Sandbox Methods ---
  addCheatGold(amount = 500) {
    this.gold += amount;
    this.totalGold += amount;
    this.isSandbox = true;
    sound.playGem();
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 45,
      text: `【调试】金币 +${amount}`,
      color: '#ffd700',
      life: 1.2,
    });
    this.emit();
  }

  addCheatLevel() {
    this.isSandbox = true;
    this.beginUpgrade();
  }

  healFull() {
    this.player.hp = this.maxHP;
    this.isSandbox = true;
    sound.playHeal();
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 45,
      text: '【调试】气血充盈',
      color: '#4ade80',
      life: 1.2,
      type: 'heal',
    });
    this.emit();
  }

  resetCooldowns() {
    for (const s of this.skills) {
      s.cd = 0;
    }
    this.isSandbox = true;
    sound.playLevelUp();
    this.emit();
  }

  spawnBossCheat() {
    this.isSandbox = true;
    const chap = CHAPTERS[this.chapter];
    this.spawnEnemy(chap.bossId);
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 65,
      text: `【调试召唤】${chap.bossName}`,
      color: '#ef4444',
      life: 1.5,
    });
    this.emit();
  }

  skipWaveCheat() {
    this.isSandbox = true;
    this.endWave();
  }

  toggleDebugMode() {
    this.isDebugMode = !this.isDebugMode;
    this.isSandbox = true;
    sound.playClick();
    this.emit();
  }

  toggleInfiniteCooldown() {
    this.infiniteCooldown = !this.infiniteCooldown;
    this.isSandbox = true;
    sound.playClick();
    if (this.infiniteCooldown) {
      for (const s of this.skills) s.cd = 0;
    }
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 45,
      text: this.infiniteCooldown ? '【全技能 0 冷却: 开启】' : '【0 冷却: 关闭】',
      color: this.infiniteCooldown ? '#a855f7' : '#94a3b8',
      life: 1.2,
    });
    this.emit();
  }

  setDamageMultiplier(mult: number) {
    this.damageMultiplier = Math.max(1, mult);
    this.isSandbox = true;
    sound.playClick();
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 45,
      text: `【伤害倍率: ${mult}x】`,
      color: '#f97316',
      life: 1.2,
    });
    this.emit();
  }

  setSpeedMultiplier(mult: number) {
    this.speedMultiplier = Math.max(1, mult);
    this.isSandbox = true;
    sound.playClick();
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 45,
      text: `【移速倍率: ${mult}x】`,
      color: '#38bdf8',
      life: 1.2,
    });
    this.emit();
  }

  jumpToWave(waveNum: number) {
    this.isSandbox = true;
    const clamped = Math.max(1, Math.min(this.maxWaves, waveNum));
    this.wave = clamped;
    this.waveTime = 0;
    this.spawnTimer = 0;
    this.bossSpawned = false;
    this.spawned = 0;
    this.enemies = [];
    this.projectiles = [];
    if (this.wave === this.maxWaves) {
      this.bossSpawned = true;
      this.spawnBossCheat();
    }
    sound.playLevelUp();
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 65,
      text: `【调试跳转】第 ${this.wave} 波`,
      color: '#38bdf8',
      life: 1.5,
    });
    this.emit();
  }

  killAllEnemies() {
    this.isSandbox = true;
    const count = this.enemies.length;
    for (const e of [...this.enemies]) {
      this.hit(e, 999999, 'fireball');
    }
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 45,
      text: `【全屏秒杀】消灭 ${count} 只魔物`,
      color: '#ef4444',
      life: 1.5,
    });
    this.emit();
  }

  collectAllDrops() {
    this.isSandbox = true;
    const count = this.drops.length;
    for (const d of this.drops) {
      this.gold += d.gold;
      this.waveGold += d.gold;
      this.totalGold += d.gold;
      this.exp += d.exp;
      if (d.item) {
        const item = d.item;
        this.acquiredEquipments.add(item.id);
        const slot = this.equipmentSlot(item);
        if (!this.equipment[slot]) {
          this.equipment[slot] = { itemId: item.id, paid: item.price };
        }
      }
    }
    this.drops = [];
    this.recompute();
    sound.playGem();
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 45,
      text: `【全图吸附】拾取 ${count} 件掉落物`,
      color: '#ffd700',
      life: 1.2,
    });
    this.emit();
  }

  addSkillDirectly(skillId: SkillId, rank: number = 1) {
    this.isSandbox = true;
    const def = getSkill(skillId);
    if (!def) return;
    let s = this.skills.find(x => x.id === skillId);
    if (!s) {
      s = this.newSkill(skillId);
      this.skills.push(s);
      this.acquiredSkills.add(skillId);
    }
    s.rank = Math.min(8, Math.max(1, rank));
    s.power = (s.rank - 1) * 20;
    this.recompute();
    sound.playLevelUp();
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 50,
      text: `【习得技能】${def.name} Lv.${s.rank}`,
      color: '#a855f7',
      life: 1.5,
    });
    this.emit();
  }

  maxAllSkills() {
    this.isSandbox = true;
    for (const def of SKILLS.filter(s => s.heroClass === this.heroClass)) {
      this.addSkillDirectly(def.id, 8);
    }
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 50,
      text: '【全技能满级】Lv.8 MAX',
      color: '#facc15',
      life: 1.5,
    });
    this.emit();
  }

  equipItemDirectly(itemId: string) {
    this.isSandbox = true;
    const item = getItem(itemId);
    if (!item) return;
    const slot = this.equipmentSlot(item);
    this.equipment[slot] = { itemId: item.id, paid: item.price };
    this.acquiredEquipments.add(item.id);
    this.recompute();
    sound.playGem();
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 55,
      text: `【装备神兵】${item.name}`,
      color: '#eab308',
      life: 1.5,
    });
    this.emit();
  }

  spawnSpecificBoss(bossKind: string) {
    this.isSandbox = true;
    const kind = bossKind;
    this.spawnEnemy(kind);
    const foundMonster = MONSTERS.find((m) => m.id === kind);
    const bossName = foundMonster?.name ?? (kind === 'boss_zuma' ? '祖玛教主' : kind === 'boss_boar' ? '白野猪' : kind === 'boss_dragon' ? '触龙神' : kind === 'boss_centipede' ? '邪恶钳虫' : kind === 'boss_temple' ? '沃玛教主' : kind === 'boss_mine' ? '尸王' : '骷髅精灵');
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 65,
      text: `【召唤首领】${bossName}`,
      color: '#ef4444',
      life: 1.5,
    });
    this.emit();
  }

  maxLevelCheat() {
    this.isSandbox = true;
    this.level = 30;
    this.exp = expNeeded(30);
    this.recompute();
    this.player.hp = this.maxHP;
    sound.playLevelUp();
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 50,
      text: '【直升满级】Lv. 30 登峰造极',
      color: '#f59e0b',
      life: 1.5,
    });
    this.emit();
  }

  toggleInvincible() {
    this.isInvincible = !this.isInvincible;
    this.isSandbox = true;
    sound.playClick();
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 45,
      text: this.isInvincible ? '【无敌模式: 开启】' : '【无敌模式: 关闭】',
      color: this.isInvincible ? '#facc15' : '#94a3b8',
      life: 1.2,
    });
    this.emit();
  }

  toggleDebugAssets() {
    this.debugAssets = !this.debugAssets;
    sound.playClick();
    this.floating.push({
      id: ++this.id,
      x: this.player ? this.player.x : WORLD.w / 2,
      y: this.player ? this.player.y - 45 : WORLD.h / 2,
      text: this.debugAssets ? '【替身灰盒: 开启】' : '【替身灰盒: 关闭】',
      color: this.debugAssets ? '#38bdf8' : '#94a3b8',
      life: 1.2,
    });
    this.emit();
  }

  setTimeScale(scale: number) {
    this.timeScale = scale;
    this.emit();
  }

  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };

  emit() {
    this.version++;
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
    return this.base.speed * bonus * (this.speedMultiplier ?? 1);
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
    this.acquiredSkills = new Set([base.startingSkill]);
    this.acquiredEquipments = new Set();

    // Default Starting Basic Weapon (木剑)
    const baseWpn = getItem('wpn-wood');
    if (baseWpn) {
      this.equipment.weapon = { itemId: baseWpn.id, paid: 0 };
      this.acquiredEquipments.add(baseWpn.id);
    }

    this.recompute();
    this.phase = 'battle';
    const chapDef = CHAPTERS[this.chapter];
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 65,
      text: `【出征】${chapDef?.name ?? '比奇荒野'} · 决战 ${chapDef?.bossName ?? '骷髅精灵'}`,
      color: '#fde047',
      life: 2.5,
    });
    this.emit();
    this.saveActiveRun();
    sound.startBgm();
  }

  switchChapter(chapter: MapChapter) {
    this.chapter = chapter;
    this.isSandbox = true;
    this.bossSpawned = false;
    this.bossKilled = false;
    this.enemies = [];
    this.projectiles = [];
    const chapDef = CHAPTERS[chapter];
    this.floating.push({
      id: ++this.id,
      x: this.player.x,
      y: this.player.y - 70,
      text: `【切换章节】${chapDef?.name ?? chapter} · 首领 ${chapDef?.bossName ?? ''}`,
      color: '#38bdf8',
      life: 2.2,
    });
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
    if (this.clock < this.player.holyArmorUntil) list.push({ def_flat: 18 });
    if (this.clock < this.player.spiritShieldUntil) list.push({ mdef_flat: 18 });

    this.stats = combine(list);
    this.player.hp = Math.min(this.player.hp, this.maxHP);
  }

  pause() {
    if (this.phase === 'battle') {
      this.previous = 'battle';
      this.phase = 'paused';
      this.emit();
      this.saveActiveRun();
    } else if (this.phase === 'paused') {
      this.phase = this.previous;
      this.emit();
      this.saveActiveRun();
    }
  }

  step(dt: number) {
    if (this.phase !== 'battle') return;
    dt = dt * this.timeScale;
    this.clock += dt;
    this.waveTime += dt;

    // Periodic run state snapshot
    this.saveTimer += dt;
    if (this.saveTimer >= 5) {
      this.saveTimer = 0;
      this.saveActiveRun();
    }

    // HP Regeneration
    const regen = (this.stats.hp_regen ?? 0) * dt;
    if (regen > 0 && this.player.hp < this.maxHP) {
      this.player.hp = Math.min(this.maxHP, this.player.hp + regen);
    }

    // Savage charge speed boost
    if (this.player.savageCharging > 0) {
      this.player.savageCharging -= dt;
      const angle = ((this.player.dir - 2) * Math.PI) / 4;
      const chargeSpeed = 480 * dt;
      this.player.x = clamp(this.player.x + Math.cos(angle) * chargeSpeed, 30, WORLD.w - 30);
      this.player.y = clamp(this.player.y + Math.sin(angle) * chargeSpeed, 45, WORLD.h - 30);

      // Push and damage enemies in charge path (Zero-GC)
      this.hash.forEachNearby(this.player.x, this.player.y, 45, (e) => {
        if (e.hp > 0 && e.kind !== 'boss') {
          e.x += Math.cos(angle) * 60;
          e.y += Math.sin(angle) * 60;
          this.hit(e, 35, 'savage_charge');
        }
      });
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
        text: `【首领降临】${chap.bossName}！`,
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
              const shinsuSkill = this.skills.find((s) => s.id === 'summon_shinsu');
              const isEvo = !!shinsuSkill?.evolved;
              const range = isEvo ? 140 : 90;
              const dmgFactor = isEvo ? 1.6 : 1.2;
              this.hash.forEachNearby(m.x + dx * 0.5, m.y + dy * 0.5, range, (e) => {
                if (e.hp > 0) this.hit(e, Math.round(m.damage * dmgFactor), 'shinsu_fire');
              });
              m.attackCD = isEvo ? 1.2 : 1.6;
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

      // Boss Distinct Combat AI
      if (e.kind === 'boss_bichon') {
        // Skull Elf: Enrage when HP < 50%
        if (e.hp < e.maxHp * 0.5) {
          e.speed = Math.max(e.speed, 75);
        }
      } else if (e.kind === 'boss_mine') {
        // Corpse King: Earthquake slam and summons
        if (e.shootCD <= 0) {
          e.shootCD = 6.5;
          sound.playHellfire();
          this.floating.push({
            id: ++this.id,
            x: e.x,
            y: e.y - 45,
            text: '【尸王铁链地动】！',
            color: '#f97316',
            life: 1.5,
          });
          this.spawnEnemy('zombie');
          this.spawnEnemy('maggot');
          this.effects.push({
            id: ++this.id,
            kind: 'ring_of_fire',
            x: e.x,
            y: e.y,
            life: 0.6,
            total: 0.6,
            radius: 240,
          });
          if (d < 240) {
            this.hurt(Math.round(e.damage * 0.75));
          }
        }
      } else if (e.kind === 'boss_temple') {
        // Woma Leader: Teleport & 8-Direction Radial Lightning Arc
        if (e.shootCD <= 0) {
          e.shootCD = 5.5;
          sound.playTeleport();
          this.floating.push({
            id: ++this.id,
            x: e.x,
            y: e.y - 45,
            text: '【教主狂暴瞬移】！',
            color: '#a855f7',
            life: 1.5,
          });
          const ang = this.rng.next() * Math.PI * 2;
          e.x = clamp(this.player.x + Math.cos(ang) * 160, 40, WORLD.w - 40);
          e.y = clamp(this.player.y + Math.sin(ang) * 160, 60, WORLD.h - 40);
          this.spawnEnemy('woma_warrior');
          sound.playLightning();
          const speed = 230;
          for (let dir8 = 0; dir8 < 8; dir8++) {
            const rad = (dir8 * Math.PI) / 4;
            this.projectiles.push({
              id: ++this.id,
              kind: 'enemy_poison',
              x: e.x,
              y: e.y,
              vx: Math.cos(rad) * speed,
              vy: Math.sin(rad) * speed,
              damage: Math.round(e.damage * 0.7),
              life: 2.8,
              dir: dir8 * 2,
              isEnemy: true,
            });
          }
        }
      } else if (e.kind === 'boss_zuma') {
        // Zuma Leader: Roar of stone, summons Zuma guards and statues
        if (e.shootCD <= 0) {
          e.shootCD = 6.0;
          sound.playHolyWord();
          this.floating.push({
            id: ++this.id,
            x: e.x,
            y: e.y - 45,
            text: '【祖玛教主石化唤醒】！',
            color: '#dc2626',
            life: 1.5,
          });
          this.spawnEnemy('zuma_guard');
          this.spawnEnemy('zuma_statue');
          this.effects.push({
            id: ++this.id,
            kind: 'firewall',
            x: e.x,
            y: e.y,
            life: 3.0,
            total: 3.0,
            radius: 80,
          });
        }
      } else if (e.kind === 'boss_boar') {
        // White Boar: Furious Meteor Slam
        if (e.shootCD <= 0) {
          e.shootCD = 4.5;
          sound.playCharge();
          this.floating.push({
            id: ++this.id,
            x: e.x,
            y: e.y - 45,
            text: '【白野猪重锤扫击】！',
            color: '#ea580c',
            life: 1.5,
          });
          e.speed = 88;
          this.effects.push({
            id: ++this.id,
            kind: 'half_moon_sweep',
            x: e.x,
            y: e.y,
            life: 0.5,
            total: 0.5,
            radius: 130,
          });
          if (d < 130) {
            this.hurt(Math.round(e.damage * 0.9));
          }
        }
      } else if (e.kind === 'boss_dragon') {
        // Dragon Centipede: Stationary Toxic Nova
        if (e.shootCD <= 0) {
          e.shootCD = 5.0;
          sound.playHellfire();
          this.floating.push({
            id: ++this.id,
            x: e.x,
            y: e.y - 50,
            text: '【触龙神全屏剧毒吐息】！',
            color: '#16a34a',
            life: 1.8,
          });
          const speed = 190;
          for (let dir12 = 0; dir12 < 12; dir12++) {
            const rad = (dir12 * Math.PI) / 6;
            this.projectiles.push({
              id: ++this.id,
              kind: 'enemy_poison',
              x: e.x,
              y: e.y,
              vx: Math.cos(rad) * speed,
              vy: Math.sin(rad) * speed,
              damage: Math.round(e.damage * 0.85),
              life: 3.2,
              dir: 0,
              isEnemy: true,
            });
          }
        }
      } else if (e.kind === 'boss_centipede') {
        // Evil Centipede: High Speed Pincer Charge
        if (e.shootCD <= 0) {
          e.shootCD = 4.0;
          e.speed = 110;
          sound.playCharge();
          this.floating.push({
            id: ++this.id,
            x: e.x,
            y: e.y - 40,
            text: '【邪恶钳虫极速突进】！',
            color: '#ca8a04',
            life: 1.5,
          });
        }
      } else if (e.kind === 'boss_ox') {
        // Ox Demon King: Whirlwind Flame Cleave
        if (e.shootCD <= 0) {
          e.shootCD = 4.5;
          sound.playFireSword();
          this.floating.push({
            id: ++this.id,
            x: e.x,
            y: e.y - 50,
            text: '【牛魔王灭世旋风烈火斩】！',
            color: '#dc2626',
            life: 2.0,
          });
          this.effects.push({
            id: ++this.id,
            kind: 'fire_slash',
            x: e.x,
            y: e.y,
            life: 0.6,
            total: 0.6,
            radius: 160,
          });
          if (d < 160) {
            this.hurt(Math.round(e.damage * 1.3));
          }
        }
      } else if (e.kind === 'boss_kong' || e.kind === 'boss_blood') {
        // Red Moon Kong/Blood: Earthshaker Slam & Toxic Shards
        if (e.shootCD <= 0) {
          e.shootCD = 5.0;
          sound.playCharge();
          this.floating.push({
            id: ++this.id,
            x: e.x,
            y: e.y - 50,
            text: e.kind === 'boss_kong' ? '【双头金刚天崩地裂震】！' : '【双头血魔狂怒血浪】！',
            color: '#b91c1c',
            life: 2.0,
          });
          const speed = 210;
          for (let i = 0; i < 8; i++) {
            const rad = (i * Math.PI) / 4;
            this.projectiles.push({
              id: ++this.id,
              kind: 'enemy_poison',
              x: e.x,
              y: e.y,
              vx: Math.cos(rad) * speed,
              vy: Math.sin(rad) * speed,
              damage: Math.round(e.damage * 0.9),
              life: 2.5,
              dir: 0,
              isEnemy: true,
            });
          }
        }
      } else if (e.aiType === 'summoner' && e.shootCD <= 0) {
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
        // Flocking Separation Vector (Zero-GC)
        let sx = 0;
        let sy = 0;
        this.hash.forEachNearby(e.x, e.y, 32, (other) => {
          if (other.id === e.id) return;
          const ox = e.x - other.x;
          const oy = e.y - other.y;
          const distSq = ox * ox + oy * oy;
          if (distSq > 0.01 && distSq < 1024) {
            const dist = Math.sqrt(distSq);
            const push = (32 - dist) * 2;
            sx += (ox / dist) * push;
            sy += (oy / dist) * push;
          }
        });
        const rush = e.aiType === 'charge' && Math.sin(this.clock * 1.5 + e.id) > 0.7 ? 1.8 : 1;
        const sp = e.speed * rush;
        e.x = clamp(e.x + ((dx / d) * sp + sx) * dt, 20, WORLD.w - 20);
        e.y = clamp(e.y + ((dy / d) * sp + sy) * dt, 30, WORLD.h - 20);
      }
    }

    if (this.phase !== 'battle') return;

    // Auto-Casting Scheduler with independent cooldowns
    for (const s of this.skills) {
      if (this.infiniteCooldown) {
        s.cd = Math.max(0, s.cd - dt);
      } else if (s.cd > 0) {
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
        // Player projectile hits enemies (Zero-GC)
        let target: Enemy | null = null;
        this.hash.forEachNearby(p.x, p.y, 28, (e) => {
          if (!target && e.hp > 0) target = e;
        });
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
          this.hit(e, this.calcDamage('wizard', 4, s), 'firewall');
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
          if (d.exp > 0 && !d.item && !d.isChest) sound.playGem();

          if (d.isChest) {
            sound.playWaveComplete();
            this.floating.push({
              id: ++this.id,
              x: this.player.x,
              y: this.player.y - 45,
              text: `【开启宝箱】金币 +${d.gold}`,
              color: '#ffd700',
              life: 1.2,
            });
          }

          if (d.item) {
            const item = d.item;
            this.acquiredEquipments.add(item.id);
            sound.playTeleport();
            const slot = this.equipmentSlot(item);
            const currentEquipped = this.equipment[slot];
            if (!currentEquipped) {
              this.equipment[slot] = { itemId: item.id, paid: item.price };
              this.recompute();
              this.floating.push({
                id: ++this.id,
                x: this.player.x,
                y: this.player.y - 55,
                text: `【装备】${item.name}`,
                color: '#ffaa00',
                life: 1.5,
              });
            } else {
              const currentItem = getItem(currentEquipped.itemId);
              if (
                item.tier > currentItem.tier ||
                (item.tier === currentItem.tier && item.price > currentItem.price)
              ) {
                const refund = sellPrice(currentEquipped.paid, currentItem.price);
                this.gold += refund;
                this.totalGold += refund;
                this.equipment[slot] = { itemId: item.id, paid: item.price };
                this.recompute();
                this.floating.push({
                  id: ++this.id,
                  x: this.player.x,
                  y: this.player.y - 55,
                  text: `【换装】${item.name} (旧装备折现 +${refund})`,
                  color: '#ffaa00',
                  life: 1.6,
                });
              } else {
                const salvage = Math.round(item.price * 0.7);
                this.gold += salvage;
                this.totalGold += salvage;
                this.floating.push({
                  id: ++this.id,
                  x: this.player.x,
                  y: this.player.y - 55,
                  text: `【获得装备】${item.name} (自动折现 +${salvage})`,
                  color: '#fbbf24',
                  life: 1.5,
                });
              }
            }
          }

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

    let damage = (base + flat) * (1 + s.power / 100) * (1 + bonusPct / 100) * (this.damageMultiplier ?? 1);

    // Mind's Eye extra crit chance
    const extraCrit = this.skills.some((sk) => sk.id === 'mind_eye') ? 15 : 0;
    this.lastWasCrit = this.rng.next() < (extraCrit + (this.stats.crit_chance ?? 0)) / 100;
    if (this.lastWasCrit) {
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
          damage: this.calcDamage('wizard', s.id === 'great_fireball' ? 10 : 5, s),
          life: 2.2,
          dir: ((Math.round(Math.atan2(dy, dx) / (Math.PI / 8)) + 4) % 16 + 16) % 16,
        });
      }
      sound.playFireball();
    } else if (s.id === 'lightning') {
      if (!targets.length) return;
      const count = s.evolved ? Math.max(5, 2 + s.count) : (1 + s.count);
      const baseDmg = s.evolved ? 24 : 12;
      for (const e of targets.slice(0, count)) {
        this.hit(e, this.calcDamage('wizard', baseDmg, s), 'lightning');
        if (s.evolved && !e.kind.startsWith('boss')) {
          e.status.paralyzedUntil = this.clock + 1.5;
        }
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
      const maxWalls = s.evolved ? 8 : 4;
      const activeWalls = this.effects.filter((f) => f.kind === 'firewall');
      if (activeWalls.length >= maxWalls) {
        activeWalls[0].life = 0;
      }
      const duration = (s.evolved ? 10 : 5) * (1 + s.duration / 100) * (1 + (this.stats.duration ?? 0) / 100);
      const r = (s.evolved ? 180 : 125) * (1 + s.radius / 100) * (1 + (this.stats.skill_radius ?? 0) / 100);
      this.effects.push({
        id: ++this.id,
        kind: 'firewall',
        x: e.x,
        y: e.y,
        life: duration,
        total: duration,
        radius: r,
      });
      sound.playFirewall();
    } else if (s.id === 'hellfire') {
      sound.playHellfire();
      const angle = targets.length
        ? Math.atan2(targets[0].y - this.player.y, targets[0].x - this.player.x)
        : ((this.player.dir - 2) * Math.PI) / 4;
      const length = 320 * (1 + s.radius / 100) * (1 + (this.stats.skill_radius ?? 0) / 100);
      this.effects.push({
        id: ++this.id,
        kind: 'hellfire',
        x: this.player.x,
        y: this.player.y,
        life: 0.75,
        total: 0.75,
        radius: length,
        angle,
      });
      const damage = this.calcDamage('wizard', 16, s);
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= length) {
          const a = Math.atan2(dy, dx);
          let diff = Math.abs(a - angle);
          while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
          if (diff < 0.45 || dist < 45) {
            this.hit(e, damage, 'hellfire');
            e.burnAt = this.clock + 0.6;
          }
        }
      }
    } else if (s.id === 'shield') {
      this.player.shieldUntil = this.clock + Math.min(6, 5 * (1 + s.duration / 100));
      sound.playShield();
    } else if (s.id === 'laser') {
      if (!targets.length) return;
      sound.playLaser();
      const angle = ((this.player.dir - 2) * Math.PI) / 4;
      const length = s.evolved ? 850 : 550;
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
      const baseDmg = s.evolved ? 32 : 16;
      for (const e of targets) {
        const edx = e.x - this.player.x;
        const edy = e.y - this.player.y;
        const eDist = Math.hypot(edx, edy);
        const eAngle = Math.atan2(edy, edx);
        let diff = Math.abs(eAngle - angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (eDist <= length && diff < (s.evolved ? 0.45 : 0.35)) {
          this.hit(e, this.calcDamage('wizard', baseDmg, s), 'laser');
        }
      }
    } else if (s.id === 'ice_storm') {
      if (!targets.length) return;
      sound.playIceStorm();
      const center = targets[0];
      const r = (s.evolved ? 165 : 110) * (1 + s.radius / 100);
      this.effects.push({
        id: ++this.id,
        kind: 'ice_storm',
        x: center.x,
        y: center.y,
        life: 0.65,
        total: 0.65,
        radius: r,
      });
      if (s.evolved) {
        // Vortex pull towards storm center
        this.hash.forEachNearby(center.x, center.y, r * 1.35, (e) => {
          if (e.hp > 0 && !e.kind.startsWith('boss')) {
            e.x += (center.x - e.x) * 0.35;
            e.y += (center.y - e.y) * 0.35;
          }
        });
      }
      this.hash.forEachNearby(center.x, center.y, r, (e) => {
        if (e.hp > 0) this.hit(e, this.calcDamage('wizard', s.evolved ? 28 : 17, s), 'ice_storm');
      });
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
            e.x += (dx / dist) * 75;
            e.y += (dy / dist) * 75;
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
      if (target.undead && !target.kind.startsWith('boss') && this.rng.next() < 0.35) {
        this.hit(target, target.hp, 'holy_word'); // instant kill
      } else {
        this.hit(target, this.calcDamage('wizard', 20, s), 'holy_word');
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
          this.hit(e, this.calcDamage('wizard', 13, s), 'thunderwave');
        }
      }
    } else if (s.id === 'entice') {
      const charmable = targets.filter((e) => !e.kind.startsWith('boss') && !e.elite);
      const petCount = this.minions.filter((m) => m.kind === 'enticed').length;
      if (charmable.length && petCount < 3 && this.rng.next() < 0.3) {
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
          damage: this.calcDamage('taoist', 7, s),
          life: 2.2,
          dir: ((Math.round(Math.atan2(dy, dx) / (Math.PI / 8)) + 4) % 16 + 16) % 16,
        });
      }
      sound.playSoulFireball();
    } else if (s.id === 'heal_self') {
      if (this.player.hp < this.maxHP) {
        sound.playHeal();
        const healAmt = 22 + Math.round((this.stats.sc_flat ?? 0) * 1.0);
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
      const healAmt = 32 + Math.round((this.stats.sc_flat ?? 0) * 1.4);
      this.player.hp = Math.min(this.maxHP, this.player.hp + healAmt);
      for (const m of this.minions) {
        m.hp = Math.min(m.maxHp, m.hp + healAmt);
      }
    } else if (s.id === 'poison') {
      if (!targets.length) return;
      sound.playPoison();
      const count = s.evolved ? Math.max(5, 3 + s.count) : (1 + s.count);
      const poisonDuration = s.evolved ? 10.0 : 6.0;
      const defDown = s.evolved ? 8 : 4;
      const baseDmg = Math.max(2, Math.round((this.stats.sc_flat ?? 0) * (s.evolved ? 0.9 : 0.55)) + (s.evolved ? 8 : 3));
      for (const e of targets.slice(0, count)) {
        e.status.poisonedUntil = this.clock + poisonDuration;
        e.status.poisonDamage = baseDmg;
        e.status.poisonDefDown = defDown;
        this.effects.push({
          id: ++this.id,
          kind: 'poison_cloud',
          x: e.x,
          y: e.y,
          life: 0.6,
          total: 0.6,
          radius: s.evolved ? 65 : 35,
        });
      }
    } else if (s.id === 'summon_skeleton') {
      const maxLimit = s.evolved ? 2 : (s.summonLimit ?? 1);
      const skelCount = this.minions.filter((m) => m.kind === 'skeleton').length;
      if (skelCount < maxLimit) {
        sound.playSummon();
        const bonusHP = 1 + (this.stats.summon_hp_pct ?? 0) / 100;
        const bonusDMG = 1 + (this.stats.summon_damage_pct ?? 0) / 100;
        const hpMultiplier = s.evolved ? 2.0 : 1.0;
        const dmgMultiplier = s.evolved ? 2.0 : 1.0;
        this.minions.push({
          id: ++this.id,
          kind: 'skeleton',
          name: s.evolved ? '狂暴双尊骷髅' : '变异骷髅',
          x: this.player.x + 35,
          y: this.player.y + 35,
          hp: Math.round(75 * bonusHP * hpMultiplier),
          maxHp: Math.round(75 * bonusHP * hpMultiplier),
          damage: Math.round(11 * bonusDMG * dmgMultiplier),
          speed: s.evolved ? 210 : 175,
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
        const hpMult = s.evolved ? 2.2 : 1.0;
        const dmgMult = s.evolved ? 2.0 : 1.0;
        this.minions.push({
          id: ++this.id,
          kind: 'shinsu',
          name: s.evolved ? '7级至尊烈焰圣兽' : '烈焰神兽',
          x: this.player.x - 45,
          y: this.player.y + 40,
          hp: Math.round(230 * bonusHP * hpMult),
          maxHp: Math.round(230 * bonusHP * hpMult),
          damage: Math.round(21 * bonusDMG * dmgMult),
          speed: s.evolved ? 220 : 190,
          dir: 4,
          attackCD: 0,
          attackRange: s.evolved ? 120 : 90,
          targetId: null,
        });
      }
    } else if (s.id === 'stealth' || s.id === 'mass_stealth') {
      this.player.stealthUntil = this.clock + 5.0;
      sound.playHeal();
    } else if (s.id === 'spirit_shield') {
      this.player.spiritShieldUntil = this.clock + 7.0;
      this.effects.push({
        id: ++this.id,
        kind: 'spirit_shield',
        x: this.player.x,
        y: this.player.y,
        life: 0.8,
        total: 0.8,
        radius: 0,
      });
      this.recompute();
      sound.playShield();
    } else if (s.id === 'holy_armor') {
      this.player.holyArmorUntil = this.clock + 7.0;
      this.effects.push({
        id: ++this.id,
        kind: 'holy_armor',
        x: this.player.x,
        y: this.player.y,
        life: 0.8,
        total: 0.8,
        radius: 0,
      });
      this.recompute();
      sound.playShield();
    } else if (s.id === 'paralyze_charm') {
      if (!targets.length) return;
      const e = targets[0];
      this.hash.forEachNearby(e.x, e.y, 80, (victim) => {
        if (!victim.kind.startsWith('boss')) {
          victim.status.paralyzedUntil = this.clock + 3.0;
        }
      });
      sound.playSoulFireball();
    }

    // --- WARRIOR SKILLS ---
    else if (s.id === 'half_moon') {
      sound.playHalfMoon();
      const angle = ((this.player.dir - 2) * Math.PI) / 4;
      const radius = s.evolved ? 180 : 110;
      this.effects.push({
        id: ++this.id,
        kind: 'half_moon_sweep',
        x: this.player.x,
        y: this.player.y,
        life: 0.35,
        total: 0.35,
        radius,
        angle: s.evolved ? 0 : angle,
      });
      const baseDmg = s.evolved ? 24 : 11;
      for (const e of targets) {
        const edx = e.x - this.player.x;
        const edy = e.y - this.player.y;
        const eDist = Math.hypot(edx, edy);
        const eAngle = Math.atan2(edy, edx);
        let diff = Math.abs(eAngle - angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        // Evolved is 360-degree full circle whirlwind
        if (eDist <= radius && (s.evolved || diff <= Math.PI / 2 + 0.3)) {
          this.hit(e, this.calcDamage('warrior', baseDmg, s), 'half_moon');
        }
      }
    } else if (s.id === 'slashing_swordplay') {
      if (!targets.length) return;
      const close = targets.filter((e) => Math.hypot(e.x - this.player.x, e.y - this.player.y) < 65);
      if (close.length) {
        sound.playSwordSlash();
        this.hit(close[0], this.calcDamage('warrior', 12, s), 'slashing_swordplay');
      }
    } else if (s.id === 'piercing_swordplay') {
      if (!targets.length) return;
      sound.playSwordSlash();
      const angle = ((this.player.dir - 2) * Math.PI) / 4;
      const thrustDist = s.evolved ? 450 : 130;
      const baseDmg = s.evolved ? 35 : 17;
      if (s.evolved) {
        this.effects.push({
          id: ++this.id,
          kind: 'laser',
          x: this.player.x,
          y: this.player.y,
          life: 0.35,
          total: 0.35,
          radius: thrustDist,
          angle,
        });
      }
      for (const e of targets) {
        const edx = e.x - this.player.x;
        const edy = e.y - this.player.y;
        const eDist = Math.hypot(edx, edy);
        const eAngle = Math.atan2(edy, edx);
        let diff = Math.abs(eAngle - angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (eDist <= thrustDist && diff < (s.evolved ? 0.5 : 0.4)) {
          // Ignores target defense
          this.hit(e, this.calcDamage('warrior', baseDmg, s), 'piercing_swordplay');
        }
      }
    } else if (s.id === 'fire_swordplay') {
      if (!targets.length) return;
      const reach = s.evolved ? 110 : 75;
      const close = targets.filter((e) => Math.hypot(e.x - this.player.x, e.y - this.player.y) < reach);
      if (close.length) {
        sound.playFireSword();
        const baseDmg = s.evolved ? 65 : 30;
        const hitTargets = s.evolved ? close : [close[0]];
        for (const target of hitTargets) {
          this.effects.push({
            id: ++this.id,
            kind: 'fire_slash',
            x: target.x,
            y: target.y,
            life: 0.45,
            total: 0.45,
            radius: s.evolved ? 80 : 60,
          });
          this.hit(target, this.calcDamage('warrior', baseDmg, s), 'fire_swordplay');
        }
      }
    } else if (s.id === 'savage_charge') {
      sound.playCharge();
      this.player.savageCharging = 0.38; // 0.38s forward rush
    }

    // Set cooldown respecting CDR cap and local CDR
    const baseDef = getSkill(s.id);
    s.cd = this.infiniteCooldown
      ? 0.05
      : Math.max(
          0.25,
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

  hit(e: Enemy, damage: number, skill: string, isCrit = this.lastWasCrit) {
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
        text: '【麻痹】',
        color: '#fbbf24',
        life: 0.75,
      });
    }

    if (this.floating.length < 45) {
      if (isCrit) {
        this.floating.push({
          id: ++this.id,
          x: e.x,
          y: e.y - 48,
          text: `暴击! ${damage}`,
          color: '#fbbf24',
          life: 0.9,
          type: 'crit',
          scale: 1.35,
        });
      } else {
        this.floating.push({
          id: ++this.id,
          x: e.x,
          y: e.y - 40,
          text: String(damage),
          color: skill.includes('fire')
            ? '#f97316'
            : skill.includes('lightning')
            ? '#facc15'
            : '#e2e8f0',
          life: 0.75,
          type: 'damage',
        });
      }
    }

    if (e.hp <= 0) {
      this.recentDeaths.push({ kind: e.kind, dir: e.dir, x: e.x, y: e.y, at: this.clock });
      this.kills++;
      this.waveKills++;
      const isBoss = e.kind.startsWith('boss');
      if (isBoss) {
        this.bossKilled = true;
        sound.playMonsterDie();
        if (this.wave === this.maxWaves) {
          setTimeout(() => {
            if (this.phase === 'battle') {
              this.finish(true);
            }
          }, 1500);
        }
      } else {
        sound.playMonsterDie();
      }

      const gold =
        Math.round((this.rng.next() < 0.65 ? 4 : 0) * (1 + (this.stats.gold_gain ?? 0) / 100)) *
        (e.elite ? 4 : 1);
      const exp = Math.round(e.exp * (1 + (this.stats.exp_gain ?? 0) / 100));

      if (!isBoss && !e.elite && this.drops.length >= 300) {
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

      // Boss special ground drops: guaranteed equipment drop + treasure chest!
      if (isBoss) {
        const bossDropItem = getRandomDropEquipment(
          this.heroClass,
          this.chapter === 'temple' ? 4 : 3,
          4,
          () => this.rng.next()
        );
        this.drops.push({
          id: ++this.id,
          x: e.x + (this.rng.next() * 30 - 15),
          y: e.y + (this.rng.next() * 30 - 15),
          exp: 50,
          gold: 60,
          born: this.clock,
          item: bossDropItem,
        });
        this.drops.push({
          id: ++this.id,
          x: e.x + (this.rng.next() * 30 - 15),
          y: e.y + (this.rng.next() * 30 - 15),
          exp: 30,
          gold: 150,
          born: this.clock,
          isChest: true,
        });
      } else if (e.elite) {
        // Elite special ground drops: 45% equipment drop, 30% treasure chest
        const roll = this.rng.next();
        if (roll < 0.45) {
          const minTier = this.wave >= 8 ? 2 : 1;
          const maxTier = this.wave >= 8 ? 3 : 2;
          const dropItem = getRandomDropEquipment(
            this.heroClass,
            minTier,
            maxTier,
            () => this.rng.next()
          );
          this.drops.push({
            id: ++this.id,
            x: e.x + (this.rng.next() * 24 - 12),
            y: e.y + (this.rng.next() * 24 - 12),
            exp: 20,
            gold: 30,
            born: this.clock,
            item: dropItem,
          });
        } else if (roll < 0.75) {
          this.drops.push({
            id: ++this.id,
            x: e.x + (this.rng.next() * 24 - 12),
            y: e.y + (this.rng.next() * 24 - 12),
            exp: 15,
            gold: 50 + Math.floor(this.rng.next() * 40),
            born: this.clock,
            isChest: true,
          });
        }
      }
    }
  }

  hurt(raw: number) {
    if (this.phase !== 'battle' || this.isInvincible || this.clock < this.player.hitUntil) return;
    if (this.rng.next() < (5 + (this.stats.dodge ?? 0)) / 100) {
      this.floating.push({
        id: ++this.id,
        x: this.player.x,
        y: this.player.y - 50,
        text: '闪避',
        color: '#7be3b2',
        life: 0.6,
        type: 'dodge',
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
    sound.playHurt();

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
          text: '【涅槃复活】',
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

    // Offer new skill: if slots < 6 or allow replacement if slots >= 6
    if (availableSkills.length) {
      const newSkill = this.rng.pick(availableSkills);
      const isReplace = this.skills.length >= 6;
      candidates.push({
        id: `learn-${newSkill.id}`,
        kind: 'skill',
        skill: newSkill.id,
        name: isReplace ? `替换习得 · ${newSkill.name}` : `习得 · ${newSkill.name}`,
        description: isReplace
          ? `【技能槽已满 6/6】选择后可替换遗忘当前一个已有技能。${newSkill.description}`
          : newSkill.description,
        value: 0,
      });
    }

    // Offer skill enhancements for existing skills with rank < 3
    for (const s of this.skills.filter((s) => s.rank < 3)) {
      const def = getSkill(s.id);
      const branches = SKILL_ENHANCEMENTS[s.id];
      if (branches && branches.length) {
        for (const b of branches) {
          candidates.push({
            id: `${s.id}-${b.suffix}`,
            kind: 'skill',
            skill: s.id,
            name: `${def.name} · ${b.name}`,
            description: b.desc(s.rank + 1),
            field: b.field,
            value: b.value,
          });
        }
      } else {
        candidates.push({
          id: `${s.id}-power`,
          kind: 'skill',
          skill: s.id,
          name: `${def.name} · 威力突破`,
          description: `升至 Lv.${s.rank + 1}，技能伤害额外提高 25%。`,
          field: 'power',
          value: 25,
        });
      }
    }

    // Offer skill evolutions for existing skills with rank >= 3 and !evolved
    for (const s of this.skills.filter((s) => s.rank >= 3 && !s.evolved)) {
      const evo = SKILL_EVOLUTIONS[s.id];
      if (evo) {
        candidates.push({
          id: `evo-${s.id}`,
          kind: 'skill',
          skill: s.id,
          isEvolution: true,
          name: evo.name,
          description: evo.description,
          value: 0,
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

  choose(id: string, replaceSkillId?: SkillId) {
    if (this.phase !== 'upgrade') return;
    const c = this.choices.find((c) => c.id === id);
    if (!c) return;

    if (c.kind === 'skill') {
      if (c.skill) this.acquiredSkills.add(c.skill);
      let s = this.skills.find((s) => s.id === c.skill);
      if (c.isEvolution) {
        if (s && !s.evolved) {
          s.evolved = true;
          const evo = SKILL_EVOLUTIONS[s.id];
          if (evo?.apply) {
            evo.apply(s);
          }
        }
      } else if (!s) {
        if (this.skills.length >= 6) {
          if (replaceSkillId) {
            const idx = this.skills.findIndex((sk) => sk.id === replaceSkillId);
            if (idx >= 0) {
              this.skills[idx] = this.newSkill(c.skill!);
            } else {
              this.skills[0] = this.newSkill(c.skill!);
            }
          } else {
            // Default to replacing the first skill if not explicitly specified
            this.skills[0] = this.newSkill(c.skill!);
          }
        } else {
          this.skills.push(this.newSkill(c.skill!));
        }
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

    this.recompute();
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
      this.acquiredEquipments.add(item.id);
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
    Game.clearSavedActiveRun();
    this.phase = won ? 'won' : 'dead';
    sound.stopBgm();
    if (won) {
      sound.playWaveComplete();
    } else {
      sound.playDie();
    }

    // Award crystals: 3 crystals on boss kill, +1 per 3 waves survived
    let crystals = 0;
    if (this.isSandbox) {
      crystals = 0;
    } else if (won) {
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
      skillIds: Array.from(this.acquiredSkills),
      equipments: Array.from(this.acquiredEquipments),
    };
    this.input = { x: 0, y: 0 };
    this.emit();
  }

  quitToLobby() {
    Game.clearSavedActiveRun();
    this.phase = 'lobby';
    sound.stopBgm();
    this.emit();
  }
}

export const game = new Game();
if (typeof window !== 'undefined') {
  (window as any).game = game;
  (window as any).__game = game;
}
