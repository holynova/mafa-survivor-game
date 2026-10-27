import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Game, game, SKILL_ENHANCEMENTS } from './game';
import {
  CHAPTERS,
  CLASS_BASES,
  EQUIPMENT_ITEMS,
  SKILLS,
  TALENTS,
  getItem,
  getSkill,
  SLOT_NAMES,
  STAT_NAMES,
} from './content';
import { expNeeded, rerollPrice, sellPrice } from './rules';
import { sound } from './audio';
import {
  getProfile,
  history,
  resetTalents,
  saveRun,
  upgradeTalent,
  unlockChapter,
  CHAPTER_UNLOCK_COSTS,
  exportSaveData,
  importSaveData,
} from './save';
import type {
  HeroClass,
  MapChapter,
  Mode,
  ProfileData,
  RunResult,
  Slot,
  TalentKey,
  Upgrade,
  ActiveRunSnapshot,
} from './types';
import { assets, setAssetManifest, type Manifest } from './renderer';
import { assetUrl } from './utils';

let framePositions: Record<string, { x: number; y: number }> = {};
let assetManifest: Manifest | null = null;

export async function loadArtPositions() {
  try {
    const r = await fetch(assetUrl('assets/mir/manifest.json'));
    if (!r.ok) return;
    const manifest = (await r.json()) as Manifest;
    assetManifest = manifest;
    setAssetManifest(manifest);
    framePositions = {};
    await Promise.all(
      manifest.pages.map(async (page) => {
        try {
          const resp = await fetch(assetUrl('assets/mir/' + page.data));
          if (!resp.ok) return;
          const atlas = await resp.json();
          for (const [key, val] of Object.entries(atlas.frames)) {
            framePositions[key] = (val as { frame: { x: number; y: number } }).frame;
          }
        } catch {}
      })
    );
  } catch (e) {
    console.warn('loadArtPositions warning:', e);
  }
}

export function Icon({ frame, className = '' }: { frame?: string; className?: string }) {
  const m = assetManifest ?? assets;
  let targetFrame = frame;
  if (targetFrame && m && !m.frames[targetFrame]) {
    if (m.frames[targetFrame + '（男）']) {
      targetFrame = targetFrame + '（男）';
    } else if (m.frames['item/' + targetFrame]) {
      targetFrame = 'item/' + targetFrame;
    }
  }
  const f = targetFrame && m?.frames[targetFrame];
  const position = targetFrame && framePositions[targetFrame];
  const page = f && m?.pages?.find((p) => p.key === f.texture);

  return (
    <span className={`icon-box ${className}`} aria-hidden="true">
      {f && position && page ? (
        <svg viewBox={`0 0 ${f.width} ${f.height}`} preserveAspectRatio="xMidYMid meet">
          <svg width={f.width} height={f.height} viewBox={`${position.x} ${position.y} ${f.width} ${f.height}`} overflow="hidden">
            <image width={page.width} height={page.height} href={assetUrl('assets/mir/' + page.image)} />
          </svg>
        </svg>
      ) : (
        <span className="art-empty">◇</span>
      )}
    </span>
  );
}

export function App() {
  useSyncExternalStore(game.subscribe, () => game.version);
  const g = game;

  const [muted, setMuted] = useState(sound.isMuted());
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [selectedClass, setSelectedClass] = useState<HeroClass>('wizard');
  const [selectedChapter, setSelectedChapter] = useState<MapChapter>('bichon');
  const [customSeed, setCustomSeed] = useState('');
  const [copiedSeed, setCopiedSeed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTalents, setShowTalents] = useState(false);
  const [showCompendium, setShowCompendium] = useState(false);
  const [compendiumTab, setCompendiumTab] = useState<'skills' | 'equipments'>('skills');
  const [compSkillFilter, setCompSkillFilter] = useState<'all' | 'wizard' | 'taoist' | 'warrior'>('all');
  const [compEquipFilter, setCompEquipFilter] = useState<'all' | 'weapon' | 'armor' | 'helmet' | 'necklace' | 'bracelet' | 'ring'>('all');
  const [showGuide, setShowGuide] = useState(false);
  const [guideTab, setGuideTab] = useState<'rules' | 'classes' | 'stats' | 'controls'>('rules');
  const [importText, setImportText] = useState('');
  const [guideMsg, setGuideMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeRunSnapshot, setActiveRunSnapshot] = useState<ActiveRunSnapshot | null>(null);
  const [showSandbox, setShowSandbox] = useState(false);
  const [unlockModal, setUnlockModal] = useState<MapChapter | null>(null);

  useEffect(() => {
    getProfile().then(setProfile);
    history().then(setRuns);
    setActiveRunSnapshot(Game.getSavedActiveRun());

    const handleBeforeUnload = () => {
      if (game.phase === 'battle' || game.phase === 'paused' || game.phase === 'upgrade') {
        game.saveActiveRun();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (g.result) {
      saveRun(g.result).then(() => {
        getProfile().then(setProfile);
        history().then(setRuns);
      });
    }
  }, [g.result]);

  const toggleSound = () => {
    const next = sound.toggleMute();
    setMuted(next);
  };

  const handleStart = (mode: Mode) => {
    sound.playClick();
    const seedNum = customSeed.trim() ? parseInt(customSeed.trim(), 10) : undefined;
    game.start(
      selectedClass,
      selectedChapter,
      mode,
      isNaN(seedNum!) ? undefined : seedNum,
      profile || undefined
    );
  };

  const handleUpgradeTalent = async (key: TalentKey) => {
    sound.playClick();
    const next = await upgradeTalent(key);
    setProfile(next);
  };

  const handleResetTalents = async () => {
    sound.playClick();
    const next = await resetTalents();
    setProfile(next);
  };

  return (
    <div className="game-overlay">
      {/* Sound Toggle Floating Button */}
      <button
        className="sound-toggle-btn"
        onClick={toggleSound}
        title={muted ? '开启音效' : '静音'}
      >
        {muted ? '静音' : '音效'}
      </button>

      {/* LOBBY VIEW */}
      {g.phase === 'lobby' && (
        <div className="modal-container lobby-modal">
          <div className="panel gold-panel lobby-panel">
            <div className="title-header">
              <span className="badge-legend">经典 1.76 语汇 · 战法道三职业肉鸽</span>
              <h1 className="main-title">玛法幸存者</h1>
              <p className="subtitle">比奇荒野 · 废弃矿洞 · 祖玛神庙</p>

              {profile && (
                <div className="crystal-badge">
                  玛法结晶: <strong>{profile.crystals}</strong>
                </div>
              )}
            </div>

            {/* ACTIVE RUN RESUME BANNER */}
            {activeRunSnapshot && (
              <div className="active-run-banner">
                <div className="active-run-info">
                  <span className="banner-tag">【发现未完成战局】</span>
                  <span>
                    {CLASS_BASES[activeRunSnapshot.heroClass]?.name ?? '战士'} ·{' '}
                    {CHAPTERS[activeRunSnapshot.chapter]?.name ?? '比奇'} · 第 {activeRunSnapshot.wave} 波
                  </span>
                  <span className="banner-detail">
                    存活 {Math.round(activeRunSnapshot.clock)}s · 击杀 {activeRunSnapshot.kills} · 金币 {activeRunSnapshot.gold}
                  </span>
                </div>
                <div className="active-run-actions">
                  <button
                    className="primary-btn resume-run-btn"
                    onClick={() => {
                      sound.playClick();
                      game.resumeActiveRun(activeRunSnapshot);
                      setActiveRunSnapshot(null);
                    }}
                  >
                    恢复战局
                  </button>
                  <button
                    className="secondary-btn abandon-run-btn"
                    onClick={() => {
                      sound.playClick();
                      Game.clearSavedActiveRun();
                      setActiveRunSnapshot(null);
                    }}
                  >
                    放弃
                  </button>
                </div>
              </div>
            )}

            {/* CLASS SELECTOR */}
            <div className="class-selector-tabs">
              {(['wizard', 'taoist', 'warrior'] as HeroClass[]).map((cls) => {
                const base = CLASS_BASES[cls];
                const active = selectedClass === cls;
                const iconFrame =
                  cls === 'wizard' ? 'item/海魂' : cls === 'taoist' ? 'item/降魔' : 'item/斩马刀';
                return (
                  <button
                    key={cls}
                    className={`class-tab ${active ? 'active' : ''}`}
                    onClick={() => {
                      sound.playClick();
                      setSelectedClass(cls);
                    }}
                  >
                    <div className="class-tab-icon">
                      <Icon frame={iconFrame} />
                    </div>
                    <div className="class-tab-name">【{base.name}】</div>
                  </button>
                );
              })}
            </div>

            {/* HERO OVERVIEW */}
            {CLASS_BASES[selectedClass] && (
              <div className="hero-card">
                <div className="hero-avatar">
                  <div className="hero-icon-display">
                    <Icon
                      frame={
                        selectedClass === 'wizard'
                          ? 'item/海魂'
                          : selectedClass === 'taoist'
                            ? 'item/降魔'
                            : 'item/斩马刀'
                      }
                    />
                  </div>
                  <div className="hero-role">{CLASS_BASES[selectedClass].role}</div>
                </div>
                <div className="hero-stats">
                  <div className="hero-stat-row">
                    <span>生命基础: <strong>{CLASS_BASES[selectedClass].hp}</strong></span>
                    <span>移动速度: <strong>{CLASS_BASES[selectedClass].speed} px/s</strong></span>
                  </div>
                  <div className="hero-stat-row">
                    <span>物理防御: <strong>{CLASS_BASES[selectedClass].def}</strong></span>
                    <span>魔法防御: <strong>{CLASS_BASES[selectedClass].mdef}</strong></span>
                  </div>
                  <p className="hero-desc">{CLASS_BASES[selectedClass].description}</p>
                </div>
              </div>
            )}

            {/* CHAPTER SELECTOR */}
            <div className="chapter-selector">
              <span className="chapter-label">出征章节：</span>
              {(['bichon', 'mine', 'temple'] as MapChapter[]).map((chapKey) => {
                const chap = CHAPTERS[chapKey];
                const active = selectedChapter === chapKey;
                const isUnlocked =
                  profile?.unlockedChapters?.includes(chapKey) ?? chapKey === 'bichon';
                return (
                  <button
                    key={chapKey}
                    className={`chap-btn ${active ? 'active' : ''} ${!isUnlocked ? 'locked-chap' : ''}`}
                    onClick={() => {
                      sound.playClick();
                      if (!isUnlocked) {
                        setUnlockModal(chapKey);
                        return;
                      }
                      setSelectedChapter(chapKey);
                    }}
                  >
                    <span className="chap-name">{chap.name}</span>
                    <span className="chap-boss">({chap.bossName})</span>
                    {!isUnlocked && <span className="chap-lock-tag">【未解锁】</span>}
                  </button>
                );
              })}
            </div>

            {/* SEED INPUT */}
            <div className="seed-input-row">
              <span className="seed-label">随机种子:</span>
              <input
                type="text"
                placeholder="留空随机，或输入数字种子如 176"
                value={customSeed}
                onChange={(e) => setCustomSeed(e.target.value.replace(/\D/g, ''))}
                className="seed-input"
              />
            </div>

            {/* START BUTTONS */}
            <div className="mode-select-grid">
              <button
                className="mode-btn primary-btn"
                onClick={() => handleStart('normal')}
              >
                <div className="btn-title">标准远征 (Normal)</div>
                <div className="btn-desc">12 波次 × 75 秒 · 15 分钟决战章节 Boss</div>
              </button>
              <button
                className="mode-btn secondary-btn"
                onClick={() => handleStart('trial')}
              >
                <div className="btn-title">快速试炼 (Trial)</div>
                <div className="btn-desc">3 波次 × 35 秒 · 快速测试流派构筑</div>
              </button>
            </div>

            <div className="lobby-footer">
              <div className="lobby-actions-row">
                <button
                  className="crystal-shrine-btn"
                  onClick={() => {
                    sound.playClick();
                    setShowTalents(true);
                  }}
                >
                  结晶祭坛 · 永久天赋
                </button>
                <button
                  className="comp-btn-lobby"
                  onClick={() => {
                    sound.playClick();
                    setShowCompendium(true);
                  }}
                >
                  玛法图鉴 · 藏经阁
                </button>
                <button
                  className="guide-btn-lobby"
                  onClick={() => {
                    sound.playClick();
                    setShowGuide(true);
                  }}
                >
                  玩法秘籍 · 键位
                </button>
                <button
                  className="text-btn"
                  onClick={() => {
                    sound.playClick();
                    setShowHistory(!showHistory);
                  }}
                >
                  历次远征战绩 ({runs.length})
                </button>
                <button
                  className="text-btn"
                  onClick={() => {
                    sound.playClick();
                    setShowSandbox(true);
                  }}
                  title="开启开发者快速测试沙盒控制台"
                >
                  调试沙盒
                </button>
              </div>
              <div className="controls-hint">
                操作: WASD 或方向键移动 / 鼠标触屏拖拽 / 空格释放位移技能 / 键盘 1 2 3 选择升级
              </div>
            </div>

            {/* HISTORY DRAWER */}
            {showHistory && (
              <div className="history-drawer">
                <h3>历次试炼记录</h3>
                {runs.length === 0 ? (
                  <p className="empty-hint">暂无记录，开启你的第一局吧！</p>
                ) : (
                  <div className="history-list">
                    {runs.map((r, i) => (
                      <div key={i} className={`history-item ${r.won ? 'won' : 'lost'}`}>
                        <span className="hist-status">{r.won ? '胜利' : '阵亡'}</span>
                        <span className="hist-mode">
                          {CLASS_BASES[r.heroClass]?.name ?? '法师'} · {CHAPTERS[r.chapter]?.name ?? '比奇'} · {r.mode === 'normal' ? '标准' : '试炼'}
                        </span>
                        <span className="hist-detail">
                          波次 {r.wave} · 等级 {r.level} · 击杀 {r.kills} · 金币 {r.gold}
                        </span>
                        <span className="hist-time">{r.seconds}秒</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TALENT SHRINE MODAL */}
      {showTalents && profile && (
        <div className="modal-container talent-modal">
          <div className="panel gold-panel talent-panel">
            <div className="talent-header">
              <h2>玛法结晶祭坛 · 永久天赋</h2>
              <p>消耗每局击杀 Boss 与通关获得的玛法结晶，永久强化战力</p>
              <div className="crystal-balance">
                持有结晶: <strong>{profile.crystals}</strong>
              </div>
            </div>

            <div className="talents-grid">
              {TALENTS.map((t) => {
                const currentLvl = profile.talents[t.key] || 0;
                const cost = t.costPerLevel * (currentLvl + 1);
                const isMax = currentLvl >= t.maxLevel;
                const canAfford = profile.crystals >= cost;

                return (
                  <div key={t.key} className="talent-card">
                    <div className="talent-card-header">
                      <span className="talent-name">{t.name}</span>
                      <span className="talent-level">Lv.{currentLvl} / {t.maxLevel}</span>
                    </div>
                    <p className="talent-desc">{t.description}</p>
                    <div className="talent-card-footer">
                      {isMax ? (
                        <span className="max-tag">已满级</span>
                      ) : (
                        <button
                          className="upgrade-talent-btn"
                          disabled={!canAfford}
                          onClick={() => handleUpgradeTalent(t.key)}
                        >
                          加点 (结晶 {cost})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="talent-actions">
              <button
                className="secondary-btn"
                onClick={handleResetTalents}
                title="全额返还已加点的全部结晶"
              >
                重置天赋 (全额返还)
              </button>
              <button
                className="primary-btn"
                onClick={() => {
                  sound.playClick();
                  setShowTalents(false);
                }}
              >
                完成退出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAPTER UNLOCK MODAL */}
      {unlockModal && profile && (
        <div className="modal-container chapter-unlock-modal">
          <div className="panel gold-panel unlock-panel">
            <h2>章节解锁 · {CHAPTERS[unlockModal].name}</h2>
            <div className="unlock-theme-box">【{CHAPTERS[unlockModal].theme}】</div>
            <p className="unlock-description">{CHAPTERS[unlockModal].description}</p>
            <div className="unlock-cost-box">
              <p>通关上一章节可免费解锁，或消耗玛法结晶直接开启：</p>
              <div className="cost-row">
                所需结晶: <strong>{CHAPTER_UNLOCK_COSTS[unlockModal]}</strong> / 当前持有: <strong>{profile.crystals}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => {
                  sound.playClick();
                  setUnlockModal(null);
                }}
              >
                返回
              </button>
              <button
                className="primary-btn"
                disabled={profile.crystals < CHAPTER_UNLOCK_COSTS[unlockModal]}
                onClick={async () => {
                  sound.playClick();
                  const res = await unlockChapter(unlockModal, true);
                  if (res.success) {
                    const prof = await getProfile();
                    setProfile(prof);
                    setSelectedChapter(unlockModal);
                    setUnlockModal(null);
                  }
                }}
              >
                消耗结晶立即解锁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPENDIUM MODAL (玛法图鉴 · 藏经阁) */}
      {showCompendium && (
        <div className="modal-container compendium-modal">
          <div className="panel gold-panel compendium-panel">
            <div className="compendium-header">
              <div className="compendium-title-row">
                <h2>玛法图鉴 · 藏经阁</h2>
                <span className="compendium-subtitle">收录传奇 1.76 经典武学绝技与神兵宝甲</span>
              </div>
              <button
                className="compendium-close-btn"
                onClick={() => {
                  sound.playClick();
                  setShowCompendium(false);
                }}
              >
                返回
              </button>
            </div>

            {/* MAIN TAB SWITCHER */}
            <div className="compendium-nav">
              <button
                className={`compendium-tab-btn ${compendiumTab === 'skills' ? 'active' : ''}`}
                onClick={() => {
                  sound.playClick();
                  setCompendiumTab('skills');
                }}
              >
                技能真传 ({SKILLS.length} 门)
              </button>
              <button
                className={`compendium-tab-btn ${compendiumTab === 'equipments' ? 'active' : ''}`}
                onClick={() => {
                  sound.playClick();
                  setCompendiumTab('equipments');
                }}
              >
                神兵宝甲 ({EQUIPMENT_ITEMS.length} 件)
              </button>
            </div>

            {/* TAB CONTENT: SKILLS */}
            {compendiumTab === 'skills' && (() => {
              const unlockedSkills = profile?.unlockedSkills || ['fireball', 'heal_self', 'basic_swordplay'];
              const filteredSkills = SKILLS.filter(
                (s) => compSkillFilter === 'all' || s.heroClass === compSkillFilter
              );
              const unlockedCount = SKILLS.filter((s) => unlockedSkills.includes(s.id)).length;

              return (
                <>
                  <div className="compendium-subnav-row">
                    <div className="compendium-filters">
                      {(['all', 'wizard', 'taoist', 'warrior'] as const).map((cf) => (
                        <button
                          key={cf}
                          className={`comp-filter-btn ${compSkillFilter === cf ? 'active' : ''}`}
                          onClick={() => {
                            sound.playClick();
                            setCompSkillFilter(cf);
                          }}
                        >
                          {cf === 'all'
                            ? `全部 (${SKILLS.length})`
                            : cf === 'wizard'
                            ? '法师武学 (14)'
                            : cf === 'taoist'
                            ? '道家道术 (13)'
                            : '战士剑法 (6)'}
                        </button>
                      ))}
                    </div>
                    <div className="compendium-progress-info">
                      已参悟技能: <strong>{unlockedCount}</strong> / {SKILLS.length} (进度:{' '}
                      {Math.round((unlockedCount / SKILLS.length) * 100)}%)
                    </div>
                  </div>

                  <div className="compendium-content-scroll">
                    <div className="compendium-grid">
                      {filteredSkills.map((s) => {
                        const isUnlocked = unlockedSkills.includes(s.id);
                        const branches = SKILL_ENHANCEMENTS[s.id] || [];
                        return (
                          <div
                            key={s.id}
                            className={`compendium-card ${isUnlocked ? 'unlocked' : 'locked'}`}
                          >
                            <div className="comp-card-top">
                              <div className="comp-card-icon">
                                <Icon frame={s.asset} />
                              </div>
                              <div className="comp-card-info">
                                <div className="comp-card-name-row">
                                  <span className="comp-card-name">{s.name}</span>
                                  <span
                                    className={`comp-card-status ${
                                      isUnlocked ? 'comp-status-unlocked' : 'comp-status-locked'
                                    }`}
                                  >
                                    {isUnlocked ? '【已参悟】' : '【未习得】'}
                                  </span>
                                </div>
                                <div className="comp-card-tags">
                                  <span className={`comp-tag ${s.heroClass}`}>
                                    {s.heroClass === 'wizard'
                                      ? '法师'
                                      : s.heroClass === 'taoist'
                                      ? '道士'
                                      : '战士'}
                                  </span>
                                  <span className="comp-tag">CD {s.cooldown}s</span>
                                  {s.passive && <span className="comp-tag">被动心法</span>}
                                </div>
                              </div>
                            </div>

                            <p className="comp-card-desc">{s.description}</p>

                            {branches.length > 0 && (
                              <div className="comp-card-branches">
                                <span className="comp-branch-title">
                                  进阶参悟路径 ({branches.length}):
                                </span>
                                {branches.map((b, idx) => (
                                  <div key={idx} className="comp-branch-item">
                                    <strong>【{b.name}】</strong>{' '}
                                    {b.desc(2).replace('升至 Lv.2，', '')}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* TAB CONTENT: EQUIPMENTS */}
            {compendiumTab === 'equipments' && (() => {
              const unlockedEquips = profile?.unlockedEquipments || ['wpn-wood', 'arm-cloth-m', 'arm-cloth-f'];
              const filteredEquips = EQUIPMENT_ITEMS.filter((item) => {
                if (compEquipFilter === 'all') return true;
                if (compEquipFilter === 'weapon') return item.slot === 'weapon';
                if (compEquipFilter === 'armor') return item.slot === 'armor';
                if (compEquipFilter === 'helmet') return item.slot === 'helmet';
                if (compEquipFilter === 'necklace') return item.slot === 'necklace';
                if (compEquipFilter === 'bracelet')
                  return item.slot === 'braceletL' || item.slot === 'braceletR';
                if (compEquipFilter === 'ring')
                  return item.slot === 'ringL' || item.slot === 'ringR';
                return true;
              });
              const unlockedCount = EQUIPMENT_ITEMS.filter((item) =>
                unlockedEquips.includes(item.id)
              ).length;

              return (
                <>
                  <div className="compendium-subnav-row">
                    <div className="compendium-filters">
                      {(
                        [
                          { key: 'all', label: '全部' },
                          { key: 'weapon', label: '武器' },
                          { key: 'armor', label: '衣服' },
                          { key: 'helmet', label: '头盔' },
                          { key: 'necklace', label: '项链' },
                          { key: 'bracelet', label: '手镯' },
                          { key: 'ring', label: '戒指' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.key}
                          className={`comp-filter-btn ${compEquipFilter === f.key ? 'active' : ''}`}
                          onClick={() => {
                            sound.playClick();
                            setCompEquipFilter(f.key);
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="compendium-progress-info">
                      已收录装备: <strong>{unlockedCount}</strong> / {EQUIPMENT_ITEMS.length} (进度:{' '}
                      {Math.round((unlockedCount / EQUIPMENT_ITEMS.length) * 100)}%)
                    </div>
                  </div>

                  <div className="compendium-content-scroll">
                    <div className="compendium-grid">
                      {filteredEquips.map((item) => {
                        const isUnlocked = unlockedEquips.includes(item.id);
                        const tierLabel =
                          item.tier === 1
                            ? '初阶'
                            : item.tier === 2
                            ? '沃玛'
                            : item.tier === 3
                            ? '祖玛'
                            : '赤月神品';
                        const statEntries = Object.entries(item.stats);

                        return (
                          <div
                            key={item.id}
                            className={`compendium-card ${isUnlocked ? 'unlocked' : 'locked'}`}
                          >
                            <div className="comp-card-top">
                              <div className="comp-card-icon">
                                <Icon frame={item.icon || 'item/' + item.name} />
                              </div>
                              <div className="comp-card-info">
                                <div className="comp-card-name-row">
                                  <span className="comp-card-name">{item.name}</span>
                                  <span
                                    className={`comp-card-status ${
                                      isUnlocked ? 'comp-status-unlocked' : 'comp-status-locked'
                                    }`}
                                  >
                                    {isUnlocked ? '【已收录】' : '【未探索】'}
                                  </span>
                                </div>
                                <div className="comp-card-tags">
                                  <span className={`comp-tag tier-${item.tier}`}>
                                    {tierLabel}
                                  </span>
                                  {item.slot && (
                                    <span className="comp-tag">
                                      {SLOT_NAMES[item.slot] || item.slot}
                                    </span>
                                  )}
                                  <span className="comp-tag">
                                    {item.classReq
                                      ? item.classReq === 'wizard'
                                        ? '法师专用'
                                        : item.classReq === 'taoist'
                                        ? '道士专用'
                                        : '战士专用'
                                      : '全职业通用'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <p className="comp-card-desc">{item.description}</p>

                            {statEntries.length > 0 && (
                              <div className="comp-card-stats">
                                {statEntries.map(([k, v]) => (
                                  <span key={k}>
                                    {STAT_NAMES[k as keyof typeof STAT_NAMES] ?? k}: +{v}
                                  </span>
                                ))}
                              </div>
                            )}

                            {item.special && (
                              <div className="comp-special-badge">
                                {item.special === 'revive' &&
                                  '【特殊神器: 涅槃复活 · 受到致命伤立刻复原50%生命】'}
                                {item.special === 'paralyze' &&
                                  '【特殊神器: 麻痹神力 · 攻击概率彻底麻痹魔物】'}
                                {item.special === 'mana_shield' &&
                                  '【特殊神器: 护身神力 · 受到伤害额外削减20%】'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* GAMEPLAY GUIDE & SETTINGS MODAL (玩法秘籍 · 说明与键位) */}
      {showGuide && (
        <div className="modal-container guide-modal">
          <div className="panel gold-panel guide-panel">
            <div className="guide-header">
              <div className="guide-title-row">
                <h2>玛法秘籍 · 游戏说明</h2>
                <span className="guide-subtitle">传奇 1.76 基础法则、职业精要与键位设置</span>
              </div>
              <button
                className="guide-close-btn"
                onClick={() => {
                  sound.playClick();
                  setShowGuide(false);
                  setGuideMsg(null);
                }}
              >
                返回
              </button>
            </div>

            {/* GUIDE NAV TABS */}
            <div className="guide-nav">
              <button
                className={`guide-tab-btn ${guideTab === 'rules' ? 'active' : ''}`}
                onClick={() => {
                  sound.playClick();
                  setGuideTab('rules');
                }}
              >
                基础规则
              </button>
              <button
                className={`guide-tab-btn ${guideTab === 'classes' ? 'active' : ''}`}
                onClick={() => {
                  sound.playClick();
                  setGuideTab('classes');
                }}
              >
                三职精要
              </button>
              <button
                className={`guide-tab-btn ${guideTab === 'stats' ? 'active' : ''}`}
                onClick={() => {
                  sound.playClick();
                  setGuideTab('stats');
                }}
              >
                属性与特戒
              </button>
              <button
                className={`guide-tab-btn ${guideTab === 'controls' ? 'active' : ''}`}
                onClick={() => {
                  sound.playClick();
                  setGuideTab('controls');
                }}
              >
                操作键位与存档
              </button>
            </div>

            {/* TAB: RULES */}
            {guideTab === 'rules' && (
              <div className="guide-content-scroll">
                <div className="guide-section">
                  <div className="guide-card">
                    <h3>【远征目标与波次】</h3>
                    <p>
                      在比奇荒野、废弃矿洞、祖玛神庙等玛法古迹中生存。标准远征共 12 波次（每波 75 秒），试炼模式为 3 波次（每波 35 秒）。
                    </p>
                    <p>
                      在最终波次将迎战章节霸主（骷髅精灵、尸王、沃玛教主）。斩杀最终 Boss 即可通关本章节，并赢取玛法结晶与解锁下一未知地图！
                    </p>
                  </div>

                  <div className="guide-card">
                    <h3>【升级领悟与技能槽位】</h3>
                    <p>
                      击杀魔物掉落晶石经验，累积经验升级时游戏自动暂停并提供 3 个参悟选项。
                    </p>
                    <p>
                      最多可同时掌握 6 门技能。未满 6 槽时可领悟全新本职武学；已掌握技能可继续升级并选择进阶分支（最高 Lv.3）。
                    </p>
                  </div>

                  <div className="guide-card">
                    <h3>【波次补给与神兵掉落】</h3>
                    <p>
                      每波结束后自动结算剩余经验与回收折现金币，随后开启四格军备补给黑市，可购买或重掷装备首饰与无格被动秘宝。
                    </p>
                    <p>
                      在战斗中击败精英怪与 Boss 必掉落冲天光柱（金色/紫色神兵）与黄金宝箱。角色走近即可吸附，若装备品质更优将自动替换并旧物折现！
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CLASSES */}
            {guideTab === 'classes' && (
              <div className="guide-content-scroll">
                <div className="guide-section">
                  <div className="guide-card">
                    <h3>【法师 · 元素与天雷的主宰】</h3>
                    <p>
                      初始技能为火球术。拥有抗拒火环、诱惑之光、火墙、雷电术、地狱雷光、冰咆哮、魔法盾等 14 门经典绝技。
                    </p>
                    <p>
                      定位：超强全屏 AOE 与清场爆发。身板较脆但拥有魔法盾与瞬息移动保命，适合风筝走位和大范围火海封路。
                    </p>
                  </div>

                  <div className="guide-card">
                    <h3>【道士 · 精神力与通灵的大师】</h3>
                    <p>
                      初始技能为灵魂火符与治愈术。拥有召唤变异骷髅、烈焰神兽、施毒术、隐身术、幽灵盾、神圣战甲术等 13 门道术。
                    </p>
                    <p>
                      定位：召唤仆从协同输出、持续绿毒腐蚀魔物双防与持久自愈。擅长以宠物吸引群怪火力并在安全距离输出。
                    </p>
                  </div>

                  <div className="guide-card">
                    <h3>【战士 · 刚猛无匹的钢铁先锋】</h3>
                    <p>
                      初始技能为攻杀与基本剑术。拥有刺杀剑术、半月弯刀、野蛮冲撞、烈火剑法等 6 大核心剑招。
                    </p>
                    <p>
                      定位：拥有全职业最高的生命上限、重甲防御与正面扇形绞杀力。野蛮冲撞可强行推开迫近魔物，烈火剑法则能瞬间打出巨额单体暴击。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: STATS */}
            {guideTab === 'stats' && (
              <div className="guide-content-scroll">
                <div className="guide-section">
                  <div className="guide-card">
                    <h3>【核心攻防属性】</h3>
                    <p>
                      <strong>DC (物理攻击)</strong>：决定战士全技能与通用近战武器的基础输出。
                    </p>
                    <p>
                      <strong>MC (魔法攻击)</strong>：决定法师全技能的基础伤害与魔法盾吸伤上限。
                    </p>
                    <p>
                      <strong>SC (道术攻击)</strong>：决定道士灵魂火符、施毒威力与骷髅/神兽的攻击和生命加成。
                    </p>
                    <p>
                      <strong>DEF / MDEF (防御与魔防)</strong>：按 1.76 原版公式直接削减受到的物理与法系伤害。
                    </p>
                  </div>

                  <div className="guide-card">
                    <h3>【玛法三大传奇特戒】</h3>
                    <p>
                      <strong>复活戒指 (涅槃神力)</strong>：佩戴后受到致死伤害时免除阵亡，并立刻恢复 50% 最大生命值（每局可触发一次）。
                    </p>
                    <p>
                      <strong>麻痹戒指 (石化神力)</strong>：近战物理攻击有概率彻底将目标敌人定身，使其无法移动与攻击。
                    </p>
                    <p>
                      <strong>护身戒指 (魔力神盾)</strong>：受到的全类型伤害额外恒定减免 20%，极大增强生存能力。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CONTROLS & SAVE */}
            {guideTab === 'controls' && (
              <div className="guide-content-scroll">
                <div className="guide-section">
                  <div className="guide-card">
                    <h3>【操作键位对照表】</h3>
                    <table className="guide-key-table">
                      <thead>
                        <tr>
                          <th>操作动作</th>
                          <th>键盘键位</th>
                          <th>触屏/鼠标操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>移动走位</td>
                          <td>
                            <span className="key-badge">W</span> <span className="key-badge">A</span>{' '}
                            <span className="key-badge">S</span> <span className="key-badge">D</span> 或{' '}
                            <span className="key-badge">方向键</span>
                          </td>
                          <td>按住屏幕/鼠标拖拽滑动</td>
                        </tr>
                        <tr>
                          <td>升级选技</td>
                          <td>
                            <span className="key-badge">1</span> <span className="key-badge">2</span>{' '}
                            <span className="key-badge">3</span>
                          </td>
                          <td>点击对应卡片</td>
                        </tr>
                        <tr>
                          <td>位移/冲撞</td>
                          <td>
                            <span className="key-badge">空格 Space</span>
                          </td>
                          <td>冷却完毕自动或点击技能槽</td>
                        </tr>
                        <tr>
                          <td>游戏暂停</td>
                          <td>
                            <span className="key-badge">ESC</span> 或 <span className="key-badge">P</span>
                          </td>
                          <td>点击右上角 [暂停] 按钮</td>
                        </tr>
                        <tr>
                          <td>静音开关</td>
                          <td>
                            <span className="key-badge">M</span>
                          </td>
                          <td>点击右上角 [静音] 按钮</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="guide-save-box">
                    <h3>【存档导出与恢复管理】</h3>
                    <p>
                      游戏进度（结晶、天赋、图鉴点亮、解锁章节）自动双重保存在浏览器 IndexedDB 与 LocalStorage 中。
                    </p>
                    <div className="guide-save-actions">
                      <button
                        className="secondary-btn"
                        onClick={async () => {
                          sound.playClick();
                          try {
                            const data = await exportSaveData();
                            navigator.clipboard.writeText(data);
                            setGuideMsg({ type: 'success', text: '存档 JSON 已成功复制到剪贴板！' });
                          } catch {
                            setGuideMsg({ type: 'error', text: '复制失败，请手动在下方文本框全选复制。' });
                          }
                        }}
                      >
                        复制存档 JSON
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={async () => {
                          sound.playClick();
                          const data = await exportSaveData();
                          const blob = new Blob([data], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `mafa-survivor-save-${Date.now()}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          setGuideMsg({ type: 'success', text: '存档文件下载完成！' });
                        }}
                      >
                        下载存档文件 (.json)
                      </button>
                    </div>

                    <textarea
                      className="guide-textarea"
                      placeholder="在此处粘贴存档 JSON 字符串以进行数据恢复..."
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                    />

                    <div>
                      <button
                        className="primary-btn"
                        disabled={!importText.trim()}
                        onClick={async () => {
                          sound.playClick();
                          const res = await importSaveData(importText.trim());
                          if (res.success) {
                            const prof = await getProfile();
                            setProfile(prof);
                            const r = await history();
                            setRuns(r);
                            setImportText('');
                            setGuideMsg({ type: 'success', text: '存档恢复成功！已重新载入最新进度。' });
                          } else {
                            setGuideMsg({ type: 'error', text: res.error || '存档导入失败' });
                          }
                        }}
                      >
                        立即导入恢复存档
                      </button>
                    </div>

                    {guideMsg && (
                      <div className={guideMsg.type === 'success' ? 'guide-msg-success' : 'guide-msg-error'}>
                        {guideMsg.text}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DEVELOPER QUICK TEST SANDBOX MODAL (调试沙盒) */}
      {showSandbox && (
        <div className="modal-container sandbox-modal">
          <div className="panel sandbox-panel">
            <div className="sandbox-header">
              <h2>开发者测试沙盒 · 快速调优控制台</h2>
              <button
                className="guide-close-btn"
                onClick={() => {
                  sound.playClick();
                  setShowSandbox(false);
                }}
              >
                关闭
              </button>
            </div>

            <div className="sandbox-desc">
              【提示】开启测试工具后该局游戏将自动标记为沙盒模式，退出时不计入正式排行榜或战绩记录，供数值调参与快速验证！
            </div>

            <div className="sandbox-grid">
              <button
                className={`sandbox-btn ${game.isInvincible ? 'active' : ''}`}
                onClick={() => {
                  game.toggleInvincible();
                }}
              >
                无敌模式: {game.isInvincible ? '【已开启】' : '【已关闭】'}
              </button>

              <button
                className="sandbox-btn"
                onClick={() => {
                  game.healFull();
                }}
              >
                全额回满生命
              </button>

              <button
                className="sandbox-btn"
                onClick={() => {
                  game.addCheatGold(500);
                }}
              >
                增加 500 金币
              </button>

              <button
                className="sandbox-btn"
                onClick={() => {
                  game.addCheatLevel();
                  setShowSandbox(false);
                }}
              >
                立即提升 1 级 (选技)
              </button>

              <button
                className="sandbox-btn"
                onClick={() => {
                  game.resetCooldowns();
                }}
              >
                清空全技能 CD
              </button>

              <button
                className="sandbox-btn"
                onClick={() => {
                  game.spawnBossCheat();
                  setShowSandbox(false);
                }}
              >
                召唤当前章节 Boss
              </button>

              <button
                className="sandbox-btn"
                onClick={() => {
                  game.skipWaveCheat();
                  setShowSandbox(false);
                }}
              >
                跳过波次 (进商店)
              </button>

              <button
                className={`sandbox-btn ${game.debugAssets ? 'active' : ''}`}
                onClick={() => {
                  game.toggleDebugAssets();
                }}
              >
                替身灰盒 (ART-09): {game.debugAssets ? '【已开启】' : '【已关闭】'}
              </button>
            </div>

            <div className="speed-buttons-row">
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>运行速度:</span>
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  className={`speed-btn ${game.timeScale === spd ? 'active' : ''}`}
                  onClick={() => {
                    sound.playClick();
                    game.setTimeScale(spd);
                  }}
                >
                  {spd}x 倍速
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* IN-GAME BATTLE HUD */}
      {(g.phase === 'battle' || g.phase === 'upgrade' || g.phase === 'shop' || g.phase === 'paused') && (
        <div className="hud-container">
          {/* TOP BAR */}
          <header className="top-hud">
            {/* HP Bar */}
            <div className="hud-box hp-box">
              <div className="hud-label">
                <span>{g.base.name} · 生命值</span>
                <span className="hud-val">{Math.round(g.player.hp)} / {g.maxHP}</span>
              </div>
              <div className="bar-track hp-track">
                <div
                  className="bar-fill hp-fill"
                  style={{ width: `${Math.max(0, Math.min(100, (g.player.hp / g.maxHP) * 100))}%` }}
                />
              </div>
            </div>

            {/* Wave Countdown */}
            <div className="hud-box wave-box">
              <div className="wave-badge">
                {CHAPTERS[g.chapter]?.name} · 第 {g.wave}/{g.maxWaves} 波
              </div>
              <div className="wave-timer">
                {Math.max(0, Math.ceil(g.duration - g.waveTime))}s
              </div>
            </div>

            {/* Level & EXP */}
            <div className="hud-box exp-box">
              <div className="hud-label">
                <span>Lv. {g.level}</span>
                <span className="hud-val">{g.exp} / {expNeeded(g.level)}</span>
              </div>
              <div className="bar-track exp-track">
                <div
                  className="bar-fill exp-fill"
                  style={{ width: `${Math.max(0, Math.min(100, (g.exp / expNeeded(g.level)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Gold & Kills */}
            <div className="hud-box counters-box">
              <span className="counter-item">金币: {g.gold}</span>
              <span className="counter-item">击杀: {g.kills}</span>
              <button
                className="pause-hud-btn"
                onClick={() => {
                  sound.playClick();
                  game.pause();
                }}
                title="暂停游戏 (ESC)"
              >
                {g.phase === 'paused' ? '继续' : '暂停'}
              </button>
            </div>
          </header>

          {/* BOTTOM SKILLS BAR */}
          <footer className="bottom-hud">
            <div className="skills-bar">
              {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
                const skill = g.skills[slotIdx];
                if (!skill) {
                  return (
                    <div key={slotIdx} className="skill-slot empty-slot">
                      <span className="slot-num">{slotIdx + 1}</span>
                      <span className="slot-empty-icon">空</span>
                    </div>
                  );
                }
                const def = getSkill(skill.id);
                const cdMax = Math.max(
                  0.35,
                  def.cooldown * (1 - (g.stats.cooldown_reduction ?? 0) / 100) * (1 - skill.localCDR / 100)
                );
                const cdPct = cdMax > 0 ? Math.min(1, skill.cd / cdMax) : 0;

                return (
                  <div key={slotIdx} className={`skill-slot active-slot skill-${skill.id}`}>
                    <Icon frame={def.asset} />
                    <div className="skill-slot-info">
                      <span className="slot-num">{slotIdx + 1}</span>
                      <span className="skill-rank">Lv.{skill.rank}</span>
                      <div className="skill-name">{def.name}</div>
                    </div>
                    {skill.cd > 0 && (
                      <div
                        className="cd-sweep"
                        style={{ height: `${cdPct * 100}%` }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </footer>
        </div>
      )}

      {/* UPGRADE MODAL (3-Choice) */}
      {g.phase === 'upgrade' && (
        <div className="modal-container upgrade-modal">
          <div className="panel gold-panel upgrade-panel">
            <div className="upgrade-header">
              <h2>境界晋升 · 技能与属性选择 (Lv.{g.level})</h2>
              <p>请选择一项技能或属性强化（按键盘 1、2、3 快速选择）</p>
            </div>

            <div className="choices-grid">
              {g.choices.map((c: Upgrade, idx: number) => (
                <div
                  key={c.id}
                  className="choice-card"
                  onClick={() => {
                    sound.playClick();
                    game.choose(c.id);
                  }}
                >
                  <div className="card-key-tag">[{idx + 1}]</div>
                  <div className={`card-type-tag ${c.kind}`}>
                    {c.kind === 'skill' ? (c.id.startsWith('learn-') ? '领悟新技能' : '技能进阶') : '属性增幅'}
                  </div>
                  {c.skill && (
                    <div className="choice-icon-wrap">
                      <Icon frame={getSkill(c.skill).asset} />
                    </div>
                  )}
                  <h3 className="card-title">{c.name}</h3>
                  <p className="card-desc">{c.description}</p>
                  <button className="card-select-btn">选择此项</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SHOP MODAL */}
      {g.phase === 'shop' && (
        <div className="modal-container shop-modal">
          <div className="panel gold-panel shop-panel">
            <div className="shop-header">
              <h2>第 {g.wave} 波清剿完成 · 比奇行脚商人</h2>
              <div className="shop-gold-info">
                <span>当前持有金币: <strong>金币 {g.gold}</strong></span>
                <span>本波收益: +{g.lastWaveGold} (含未拾取50%折算)</span>
              </div>
            </div>

            {/* Shop Offers Grid */}
            <div className="shop-offers-grid">
              {g.offers.map((o) => {
                const item = getItem(o.itemId);
                const canAfford = g.gold >= o.price;
                return (
                  <div key={o.id} className={`offer-card ${o.sold ? 'sold' : ''} ${o.locked ? 'locked' : ''}`}>
                    <div className="offer-header">
                      <Icon frame={item.icon} />
                      <div className="offer-meta">
                        <span className={`item-tier tier-${item.tier}`}>{item.name}</span>
                        <span className="item-price">金币 {o.price}</span>
                      </div>
                    </div>
                    <div className="item-type-tag">
                      {item.kind === 'equipment' ? '装备' : item.kind === 'passive' ? '被动道具' : '恢复品'}
                    </div>
                    <p className="item-desc">{item.description}</p>

                    <div className="offer-actions">
                      {o.sold ? (
                        <span className="sold-label">已购买</span>
                      ) : (
                        <>
                          <button
                            className="buy-btn"
                            disabled={!canAfford}
                            onClick={() => {
                              sound.playGem();
                              game.buy(o.id);
                            }}
                          >
                            购买
                          </button>
                          <button
                            className={`lock-btn ${o.locked ? 'active' : ''}`}
                            onClick={() => {
                              sound.playClick();
                              game.lock(o.id);
                            }}
                          >
                            {o.locked ? '已锁定' : '锁定'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Equipped Items Drawer */}
            <div className="equipment-strip">
              <h4>当前穿戴装备 (8槽固定栏位)</h4>
              <div className="equip-slots-grid">
                {(['weapon', 'armor', 'helmet', 'necklace', 'braceletL', 'braceletR', 'ringL', 'ringR'] as Slot[]).map((slot) => {
                  const eq = g.equipment[slot];
                  const item = eq ? getItem(eq.itemId) : null;
                  return (
                    <div key={slot} className={`equip-slot-box ${item ? 'has-item' : 'empty'}`}>
                      <div className="slot-title">{SLOT_NAMES[slot]}</div>
                      {item ? (
                        <div className="slot-item-info">
                          <Icon frame={item.icon} />
                          <span className="item-name">{item.name}</span>
                          <button
                            className="sell-btn"
                            onClick={() => {
                              sound.playGem();
                              game.sell(slot);
                            }}
                            title={`折价变卖 (返还金币 ${sellPrice(eq!.paid, item.price)})`}
                          >
                            卖出
                          </button>
                        </div>
                      ) : (
                        <span className="slot-empty-text">空</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shop Footer Controls */}
            <div className="shop-footer">
              <button
                className="reroll-btn"
                disabled={g.gold < g.cooldownCost}
                onClick={() => {
                  sound.playClick();
                  game.reroll();
                }}
              >
                刷新货架 ({g.freeRerolls > 0 ? `免费 (${g.freeRerolls})` : `金币 ${g.cooldownCost}`})
              </button>
              <button
                className="next-wave-btn primary-btn"
                onClick={() => {
                  sound.playClick();
                  game.nextWave();
                }}
              >
                进入第 {g.wave + 1} 波
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {g.phase === 'paused' && (
        <div className="modal-container pause-modal">
          <div className="panel gold-panel pause-panel">
            <h2>游戏暂停</h2>
            <div className="pause-stats-summary">
              <p>出征职业: {g.base.name} ({g.base.role})</p>
              <p>当前章节: {CHAPTERS[g.chapter]?.name} · 第 {g.wave} / {g.maxWaves} 波</p>
              <p>存活时间: {Math.round(g.clock)} 秒 · 击杀魔物: {g.kills} 只</p>
              <p>玩家生命: {Math.round(g.player.hp)} / {g.maxHP}</p>

              {/* Combat Attributes Overview */}
              <div className="pause-attributes-grid">
                <div className="pause-attr-item">
                  <span>物防:</span>
                  <strong>{Math.round(g.stats.def_flat ?? 0)}</strong>
                </div>
                <div className="pause-attr-item">
                  <span>魔御:</span>
                  <strong>{Math.round(g.stats.mdef_flat ?? 0)}</strong>
                </div>
                <div className="pause-attr-item">
                  <span>移速:</span>
                  <strong>+{Math.round(g.stats.move_speed ?? 0)}%</strong>
                </div>
                <div className="pause-attr-item">
                  <span>冷缩:</span>
                  <strong>-{Math.round(g.stats.cooldown_reduction ?? 0)}%</strong>
                </div>
                <div className="pause-attr-item">
                  <span>范围:</span>
                  <strong>+{Math.round(g.stats.skill_radius ?? 0)}%</strong>
                </div>
                <div className="pause-attr-item">
                  <span>暴击:</span>
                  <strong>{Math.round(g.stats.crit_chance ?? 0)}%</strong>
                </div>
                <div className="pause-attr-item">
                  <span>闪避:</span>
                  <strong>{Math.round(5 + (g.stats.dodge ?? 0))}%</strong>
                </div>
                <div className="pause-attr-item">
                  <span>金币:</span>
                  <strong>+{Math.round(g.stats.gold_gain ?? 0)}%</strong>
                </div>
              </div>
            </div>

            {/* Equipped Items Section */}
            <div className="pause-equipped-section">
              <h4>当前穿戴装备 (8槽)</h4>
              <div className="equip-slots-grid">
                {(['weapon', 'armor', 'helmet', 'necklace', 'braceletL', 'braceletR', 'ringL', 'ringR'] as Slot[]).map((slot) => {
                  const eq = g.equipment[slot];
                  const item = eq ? getItem(eq.itemId) : null;
                  return (
                    <div key={slot} className={`equip-slot-box ${item ? 'has-item' : 'empty'}`}>
                      <div className="slot-title">{SLOT_NAMES[slot]}</div>
                      {item ? (
                        <div className="slot-item-info">
                          <Icon frame={item.icon} />
                          <span className="item-name">{item.name}</span>
                        </div>
                      ) : (
                        <span className="slot-empty-text">空</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Passive Items Section */}
            {Object.keys(g.passives).length > 0 && (
              <div className="pause-passives-section">
                <h4>持有被动道具</h4>
                <div className="passives-list">
                  {Object.entries(g.passives).map(([itemId, count]) => {
                    const item = getItem(itemId);
                    return (
                      <div key={itemId} className="passive-badge">
                        <Icon frame={item.icon} />
                        <span>{item.name} ×{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="audio-volume-controls">
              <div className="volume-slider-row">
                <span className="slider-label">音效音量:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(sound.getSfxVolume() * 100)}
                  onChange={(e) => {
                    const val = Number(e.target.value) / 100;
                    sound.setSfxVolume(val);
                    setProfile((p) => (p ? { ...p } : p));
                  }}
                  className="volume-slider"
                />
                <span className="volume-val">{Math.round(sound.getSfxVolume() * 100)}%</span>
              </div>
              <div className="volume-slider-row">
                <span className="slider-label">环境背景音:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(sound.getBgmVolume() * 100)}
                  onChange={(e) => {
                    const val = Number(e.target.value) / 100;
                    sound.setBgmVolume(val);
                    setProfile((p) => (p ? { ...p } : p));
                  }}
                  className="volume-slider"
                />
                <span className="volume-val">{Math.round(sound.getBgmVolume() * 100)}%</span>
              </div>
            </div>

            <div className="pause-actions">
              <button
                className="secondary-btn sound-toggle-pause-btn"
                onClick={() => {
                  toggleSound();
                }}
              >
                音效: {muted ? '已静音' : '已开启'}
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  sound.playClick();
                  setShowCompendium(true);
                }}
              >
                查阅图鉴
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  sound.playClick();
                  setShowGuide(true);
                }}
              >
                玩法秘籍
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  sound.playClick();
                  setShowSandbox(true);
                }}
              >
                调试沙盒
              </button>
              <button
                className="primary-btn"
                onClick={() => {
                  sound.playClick();
                  game.pause();
                }}
              >
                继续战斗
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  sound.playClick();
                  game.start(g.heroClass, g.chapter, g.mode, g.seed, profile || undefined);
                }}
              >
                重开本局 (相同种子)
              </button>
              <button
                className="danger-btn"
                onClick={() => {
                  sound.playClick();
                  game.quitToLobby();
                }}
              >
                放弃并返回营地
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULT MODAL (VICTORY / DEFEAT) */}
      {(g.phase === 'won' || g.phase === 'dead') && g.result && (
        <div className="modal-container result-modal">
          <div className={`panel gold-panel result-panel ${g.result.won ? 'victory' : 'defeat'}`}>
            <div className="result-header">
              <h1>
                {g.result.won
                  ? `玛法凯旋 · 诛灭 ${CHAPTERS[g.chapter]?.bossName}`
                  : '喋血荒野 · 试炼落幕'}
              </h1>
              <p className="result-subtitle">
                {g.result.won
                  ? '斩杀终极邪祟，威震玛法大陆！获得玛法结晶奖励！'
                  : '力战至最后一刻，倒在无穷无尽的魔物狂潮之中...'}
              </p>
            </div>

            <div className="result-stats-grid">
              <div className="stat-card">
                <span className="label">生存波次</span>
                <span className="val">{g.result.wave} / {g.maxWaves}</span>
              </div>
              <div className="stat-card">
                <span className="label">总生存时间</span>
                <span className="val">{g.result.seconds} 秒</span>
              </div>
              <div className="stat-card">
                <span className="label">击杀总数</span>
                <span className="val">{g.result.kills}</span>
              </div>
              <div className="stat-card">
                <span className="label">获取金币</span>
                <span className="val">{g.result.gold}</span>
              </div>
              <div className="stat-card crystal-highlight">
                <span className="label">获得结晶</span>
                <span className="val">+{g.result.crystals} 结晶</span>
              </div>
            </div>

            {/* Skill Damage Breakdown */}
            <div className="damage-breakdown-card">
              <h3>技能输出伤害统计</h3>
              <div className="damage-bars">
                {Object.entries(g.result.skillDamage).map(([skillKey, dmg]) => {
                  const total = Object.values(g.result!.skillDamage).reduce((a, b) => a + b, 0) || 1;
                  const pct = Math.round((dmg / total) * 100);
                  let skillName = skillKey;
                  try {
                    skillName = getSkill(skillKey as any).name;
                  } catch {
                    if (skillKey === 'shinsu_fire') skillName = '神兽烈焰';
                    if (skillKey === 'skeleton_slash') skillName = '骷髅重斩';
                    if (skillKey === 'poison_tick') skillName = '绿毒侵蚀';
                    if (skillKey === 'pet_attack') skillName = '随从攻击';
                  }

                  return (
                    <div key={skillKey} className="dmg-bar-row">
                      <div className="dmg-bar-info">
                        <span>{skillName}</span>
                        <span>{dmg} 伤 ({pct}%)</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill dmg-skill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Build summary */}
            <div className="build-summary">
              <span>最终构筑技能: </span>
              {g.result.skills.map((s, i) => (
                <span key={i} className="skill-pill">{s}</span>
              ))}
            </div>

            {/* Seed Replay Row */}
            <div className="seed-replay-row">
              <span className="seed-code-text">本局随机种子: <code>{g.result.seed}</code></span>
              <button
                className="copy-seed-btn"
                onClick={() => {
                  sound.playClick();
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(String(g.result?.seed));
                    setCopiedSeed(true);
                    setTimeout(() => setCopiedSeed(false), 2000);
                  }
                }}
              >
                {copiedSeed ? '种子已复制' : '复制种子'}
              </button>
            </div>

            <div className="result-actions">
              <button
                className="primary-btn"
                onClick={() => handleStart(g.mode)}
              >
                再次出征
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  sound.playClick();
                  game.quitToLobby();
                }}
              >
                返回大厅
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
