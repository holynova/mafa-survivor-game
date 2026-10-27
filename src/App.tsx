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
  unlockAllChapters,
  addCrystals,
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
import {
  subscribePreload,
  getPreloadState,
  isAssetsReady,
  preloadAllAssets,
  framePositions,
  assetManifest,
  type PreloadState,
} from './assetLoader';

export function useArtReady() {
  return useSyncExternalStore(
    subscribePreload,
    () => getPreloadState().loadedCount
  );
}

export function AssetLoadingOverlay({
  state,
  onRetry,
}: {
  state: PreloadState;
  onRetry: () => void;
}) {
  return (
    <div className="asset-loading-overlay">
      <div className="asset-loading-box">
        <div className="asset-loading-title">玛法幸存者 · 核心资源预载入</div>
        <div className="asset-loading-subtitle">
          正在预加载传奇 1.76 原版美术图集、比奇荒野地图与经典法术音效，并写入本地持久缓存
        </div>

        <div className="asset-progress-track">
          <div
            className="asset-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, state.progress))}%` }}
          />
          <div className="asset-progress-percent">{state.progress}%</div>
        </div>

        <div className="asset-loading-status">{state.statusText}</div>

        <div className="asset-loading-meta">
          <span className="asset-cache-badge">
            ◇ 资源加载进度: {state.loadedCount} / {state.totalCount} 项
          </span>
          {state.phase === 'error' ? (
            <button className="asset-retry-btn" onClick={onRetry}>
              载入异常，点击重试
            </button>
          ) : (
            <span>持久缓存保护 · 免重复网络流量</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function Icon({ frame, className = '' }: { frame?: string; className?: string }) {
  useArtReady();
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

export function Mir2EquipmentView({
  game,
  onSell,
}: {
  game: Game;
  onSell?: (slot: Slot) => void;
}) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>('weapon');
  const selectedEq = selectedSlot ? game.equipment[selectedSlot] : null;
  const selectedItem = selectedEq ? getItem(selectedEq.itemId) : null;

  const renderSlotBox = (slot: Slot) => {
    const eq = game.equipment[slot];
    const item = eq ? getItem(eq.itemId) : null;
    const isSelected = selectedSlot === slot;

    return (
      <div
        key={slot}
        className={`mir2-slot-box ${item ? 'equipped' : 'empty'} ${isSelected ? 'selected' : ''}`}
        onClick={() => {
          sound.playClick();
          setSelectedSlot(slot);
        }}
        title={item ? `${item.name} (${SLOT_NAMES[slot]})` : `【${SLOT_NAMES[slot]}】空`}
      >
        <div className="mir2-slot-watermark">{SLOT_NAMES[slot]}</div>
        {item ? (
          <div className="mir2-slot-item">
            <Icon frame={item.icon} />
          </div>
        ) : (
          <div className="mir2-slot-placeholder" />
        )}
      </div>
    );
  };

  return (
    <div className="mir2-char-panel">
      <div
        className="mir2-char-doll-col"
        style={{
          backgroundImage: `url(${assetUrl('assets/mir/ui/equip_panel.png')})`,
        }}
      >
        {/* Helmet (Top Center) */}
        <div className="doll-slot-row doll-top">
          {renderSlotBox('helmet')}
        </div>

        {/* Upper Body: Weapon (Left) - Standee (Center) - Armor (Right) */}
        <div className="doll-middle-row">
          <div className="doll-col-left">
            {renderSlotBox('weapon')}
            {renderSlotBox('necklace')}
            {renderSlotBox('braceletL')}
            {renderSlotBox('ringL')}
          </div>

          <div className="doll-center-preview">
            <div className={`doll-avatar-figure ${game.heroClass}`}>
              <div className="doll-avatar-name">{CLASS_BASES[game.heroClass]?.name}</div>
              <div className="doll-avatar-lvl">Lv.{game.level}</div>
            </div>
          </div>

          <div className="doll-col-right">
            {renderSlotBox('armor')}
            <div style={{ height: '54px' }} />
            {renderSlotBox('braceletR')}
            {renderSlotBox('ringR')}
          </div>
        </div>
      </div>

      {/* Attributes & Inspection Column */}
      <div className="mir2-char-stats-col">
        <div className="char-stats-card">
          <div className="char-stats-title">玛法勇士 · 人物战斗属性</div>
          <div className="char-stat-row">
            <span>生命气血:</span>
            <strong style={{ color: '#4ade80' }}>{Math.round(game.player.hp)} / {game.maxHP}</strong>
          </div>
          <div className="char-stat-row">
            <span>物理攻击 (DC):</span>
            <strong style={{ color: '#facc15' }}>
              {10 + (game.stats.dc_flat ?? 0)}
              {game.stats.dc_bonus_pct ? ` (+${game.stats.dc_bonus_pct}%)` : ''}
            </strong>
          </div>
          <div className="char-stat-row">
            <span>魔法攻击 (MC):</span>
            <strong style={{ color: '#60a5fa' }}>
              {8 + (game.stats.mc_flat ?? 0)}
              {game.stats.mc_bonus_pct ? ` (+${game.stats.mc_bonus_pct}%)` : ''}
            </strong>
          </div>
          <div className="char-stat-row">
            <span>道术攻击 (SC):</span>
            <strong style={{ color: '#38bdf8' }}>
              {8 + (game.stats.sc_flat ?? 0)}
              {game.stats.sc_bonus_pct ? ` (+${game.stats.sc_bonus_pct}%)` : ''}
            </strong>
          </div>
          <div className="char-stat-row">
            <span>物理防御 (DEF):</span>
            <strong>{game.stats.def_flat ?? 0}</strong>
          </div>
          <div className="char-stat-row">
            <span>魔法防御 (MDEF):</span>
            <strong>{game.stats.mdef_flat ?? 0}</strong>
          </div>
          <div className="char-stat-row">
            <span>暴击几率:</span>
            <strong>{game.stats.crit_chance ?? 0}%</strong>
          </div>
          <div className="char-stat-row">
            <span>移动速度:</span>
            <strong>{Math.round(game.moveSpeed)} px/s</strong>
          </div>
        </div>

        {/* Selected Item Details */}
        <div className="char-item-inspect-card">
          {selectedItem ? (
            <div>
              <div className="inspect-item-header">
                <Icon frame={selectedItem.icon} />
                <div>
                  <div className={`inspect-item-name tier-${selectedItem.tier ?? 1}`}>
                    {selectedItem.name}
                  </div>
                  <div className="inspect-item-sub">
                    {selectedItem.slot ? SLOT_NAMES[selectedItem.slot] : '道具'} · 档次 Tier {selectedItem.tier ?? 1}
                  </div>
                </div>
              </div>
              <div className="inspect-item-desc">{selectedItem.description}</div>
              {onSell && selectedSlot && (
                <button
                  className="inspect-sell-btn"
                  onClick={() => {
                    sound.playGem();
                    onSell(selectedSlot);
                  }}
                >
                  折价变卖 (返还金币 {sellPrice(selectedEq!.paid, selectedItem.price)})
                </button>
              )}
            </div>
          ) : (
            <div className="inspect-empty-prompt">
              点击左侧装备格查看装备属性与变卖
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function App() {
  useSyncExternalStore(game.subscribe, () => game.version);
  const g = game;

  const [muted, setMuted] = useState(sound.isMuted());
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [selectedClass, setSelectedClass] = useState<HeroClass>('wizard');
  const [selectedChapter, setSelectedChapter] = useState<MapChapter>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('mafa_selected_chapter') as MapChapter | null;
      if (saved && (saved === 'bichon' || saved === 'mine' || saved === 'temple' || saved === 'tomb' || saved === 'desert' || saved === 'cangyue' || saved === 'moon')) {
        return saved;
      }
    }
    return 'bichon';
  });

  const handleSelectChapter = (chap: MapChapter) => {
    sound.playClick();
    setSelectedChapter(chap);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('mafa_selected_chapter', chap);
    }
  };
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
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [replaceTargetChoice, setReplaceTargetChoice] = useState<Upgrade | null>(null);
  const [debugTab, setDebugTab] = useState<'quick' | 'waves' | 'skills' | 'equip' | 'multipliers'>('quick');
  const [preloadState, setPreloadState] = useState<PreloadState>(getPreloadState());
  const [unlockModal, setUnlockModal] = useState<MapChapter | null>(null);

  useEffect(() => {
    return subscribePreload(() => {
      setPreloadState({ ...getPreloadState() });
    });
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~' || e.key === 'F1') {
        e.preventDefault();
        setShowSandbox((s) => !s);
      } else if (e.key === 'F10' || e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setShowEquipModal((s) => !s);
      } else if (e.key === 'Escape') {
        setShowSandbox(false);
        setShowEquipModal(false);
        setReplaceTargetChoice(null);
      } else if (game.phase === 'upgrade' && !replaceTargetChoice) {
        const choiceIdx = e.key === '1' ? 0 : e.key === '2' ? 1 : e.key === '3' ? 2 : -1;
        if (choiceIdx >= 0 && game.choices[choiceIdx]) {
          const c = game.choices[choiceIdx];
          sound.playClick();
          if (c.id.startsWith('learn-') && game.skills.length >= 6) {
            setReplaceTargetChoice(c);
          } else {
            game.choose(c.id);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

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

  const handleStart = (mode: Mode, debug = false) => {
    if (!isAssetsReady()) {
      return;
    }
    sound.playClick();
    if (debug) {
      game.isDebugMode = true;
      game.isSandbox = true;
    }
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
      {/* ASSET PRELOAD OVERLAY: Blocks lobby until 100% complete and cached */}
      {preloadState.phase !== 'complete' && (
        <AssetLoadingOverlay
          state={preloadState}
          onRetry={() => preloadAllAssets()}
        />
      )}

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
          <div
            className="panel gold-panel lobby-panel"
            style={{
              backgroundImage: `linear-gradient(rgba(14, 11, 8, 0.75), rgba(14, 11, 8, 0.88)), url(${assetUrl('assets/mir/ui/lobby_bg.png')})`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center top',
              backgroundSize: 'cover',
            }}
          >
            <div className="title-header">
              <span className="badge-legend">经典 1.76 语汇 · 战法道三职业肉鸽</span>
              <h1 className="main-title">玛法幸存者</h1>
              <p className="subtitle">比奇荒野 · 废弃矿洞 · 祖玛神庙</p>

              {profile && (
                <div className="crystal-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span>玛法结晶: <strong>{profile.crystals}</strong></span>
                  <button
                    className="test-crystal-btn"
                    title="点击补充 100 玛法结晶做测试"
                    onClick={async (e) => {
                      e.stopPropagation();
                      sound.playGem();
                      const updated = await addCrystals(100);
                      setProfile(updated);
                    }}
                    style={{
                      background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
                      color: '#ffffff',
                      border: '1px solid #60a5fa',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      boxShadow: '0 0 6px rgba(37, 99, 235, 0.4)',
                    }}
                  >
                    +100 测试结晶
                  </button>
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
                          ? 'wizard/idle/0/0'
                          : selectedClass === 'taoist'
                            ? 'taoist/idle/0/0'
                            : 'warrior/idle/0/0'
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
              {(['bichon', 'mine', 'temple', 'tomb', 'desert', 'cangyue', 'moon'] as MapChapter[]).map((chapKey) => {
                const chap = CHAPTERS[chapKey];
                const active = selectedChapter === chapKey;
                return (
                  <button
                    key={chapKey}
                    className={`chap-btn ${active ? 'active' : ''}`}
                    onClick={() => handleSelectChapter(chapKey)}
                  >
                    <span className="chap-name">{chap.name}</span>
                    <span className="chap-boss">({chap.bossName})</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Chapter Preview Banner */}
            <div className="selected-chapter-preview">
              <span className="chap-theme-badge">【{CHAPTERS[selectedChapter].theme}】</span>
              <span className="chap-desc-snippet">{CHAPTERS[selectedChapter].description}</span>
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
                disabled={!isAssetsReady()}
                onClick={() => handleStart('normal')}
              >
                <div className="btn-title">标准远征 (Normal)</div>
                <div className="btn-desc">
                  {isAssetsReady() ? '12 波次 × 75 秒 · 15 分钟决战章节 Boss' : '核心资源预载入中...'}
                </div>
              </button>
              <button
                className="mode-btn secondary-btn"
                disabled={!isAssetsReady()}
                onClick={() => handleStart('trial')}
              >
                <div className="btn-title">快速试炼 (Trial)</div>
                <div className="btn-desc">
                  {isAssetsReady() ? '3 波次 × 35 秒 · 快速测试流派构筑' : '核心资源预载入中...'}
                </div>
              </button>
              <button
                className="mode-btn debug-mode-btn"
                disabled={!isAssetsReady()}
                onClick={() => {
                  handleStart('normal', true);
                  setShowSandbox(true);
                }}
              >
                <div className="btn-title">【快速测试模式】</div>
                <div className="btn-desc">开启调试沙盒 · 自由跳波/自选满级技能/Boss调测</div>
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
                关闭 (ESC)
              </button>
            </div>

            <div className="sandbox-desc">
              【提示】开启测试工具后该局游戏将自动标记为沙盒测试，退出时不计入正式排行榜或历史战绩，支持波次跳转、全技能满级与神装调测！
            </div>

            {/* TAB NAVIGATION */}
            <div className="debug-tabs">
              {[
                { key: 'quick', label: '一键神力' },
                { key: 'waves', label: '波次与首领' },
                { key: 'skills', label: '全技能自选' },
                { key: 'equip', label: '神装穿戴' },
                { key: 'multipliers', label: '倍率调优' },
              ].map((t) => (
                <button
                  key={t.key}
                  className={`debug-tab-btn ${debugTab === t.key ? 'active' : ''}`}
                  onClick={() => {
                    sound.playClick();
                    setDebugTab(t.key as any);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB 1: QUICK POWERS */}
            {debugTab === 'quick' && (
              <div className="sandbox-grid">
                <button
                  className={`sandbox-btn ${game.isInvincible ? 'active' : ''}`}
                  onClick={() => game.toggleInvincible()}
                >
                  无敌模式: {game.isInvincible ? '【已开启】' : '【已关闭】'}
                </button>

                <button
                  className={`sandbox-btn ${game.infiniteCooldown ? 'active' : ''}`}
                  onClick={() => game.toggleInfiniteCooldown()}
                >
                  全技能0冷却: {game.infiniteCooldown ? '【已开启】' : '【已关闭】'}
                </button>

                <button className="sandbox-btn" onClick={() => game.healFull()}>
                  全额回满生命
                </button>

                <button className="sandbox-btn" onClick={() => game.killAllEnemies()}>
                  秒杀全屏魔物
                </button>

                <button className="sandbox-btn" onClick={() => game.collectAllDrops()}>
                  吸附全图掉落物
                </button>

                <button className="sandbox-btn" onClick={() => game.addCheatGold(1000)}>
                  增加 1,000 金币
                </button>

                <button className="sandbox-btn" onClick={() => game.addCheatGold(10000)}>
                  增加 10,000 金币
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

                <button className="sandbox-btn" onClick={() => game.maxLevelCheat()}>
                  直升满级 Lv.30
                </button>

                <button
                  className="sandbox-btn"
                  onClick={async () => {
                    const prof = await addCrystals(9999);
                    setProfile(prof);
                    sound.playGem();
                  }}
                >
                  增加 9999 玛法结晶
                </button>

                <button
                  className="sandbox-btn"
                  onClick={async () => {
                    const prof = await unlockAllChapters();
                    setProfile(prof);
                    sound.playLevelUp();
                  }}
                >
                  一键解锁全部章节
                </button>

                <button
                  className={`sandbox-btn ${game.debugAssets ? 'active' : ''}`}
                  onClick={() => game.toggleDebugAssets()}
                >
                  替身灰盒: {game.debugAssets ? '【已开启】' : '【已关闭】'}
                </button>
              </div>
            )}

            {/* TAB 2: WAVES & BOSSES */}
            {debugTab === 'waves' && (
              <div>
                <div className="debug-section-label">
                  ◇ 章节快速切换 (当前: 【{CHAPTERS[game.chapter]?.name}】)
                </div>
                <div className="debug-chip-group">
                  {(['bichon', 'mine', 'temple', 'tomb', 'desert', 'cangyue', 'moon'] as MapChapter[]).map((cKey) => (
                    <button
                      key={cKey}
                      className={`debug-chip ${game.chapter === cKey ? 'active' : ''}`}
                      onClick={() => {
                        game.switchChapter(cKey);
                        handleSelectChapter(cKey);
                        setShowSandbox(false);
                      }}
                    >
                      {CHAPTERS[cKey].name} ({CHAPTERS[cKey].bossName})
                    </button>
                  ))}
                </div>

                <div className="debug-section-label">◇ 波次快速直达 (当前: 第 {game.wave}/{game.maxWaves} 波)</div>
                <div className="debug-chip-group">
                  {[1, 3, 6, 9, game.maxWaves].map((w) => (
                    <button
                      key={w}
                      className={`debug-chip ${game.wave === w ? 'active' : ''}`}
                      onClick={() => {
                        game.jumpToWave(w);
                        setShowSandbox(false);
                      }}
                    >
                      {w === game.maxWaves ? `第 ${w} 波 (首领决战)` : `第 ${w} 波`}
                    </button>
                  ))}
                </div>

                <div className="debug-section-label">◇ 章节首领 Boss 即时召唤</div>
                <div className="debug-chip-group">
                  <button
                    className="debug-chip"
                    onClick={() => {
                      game.spawnSpecificBoss('boss_bichon');
                      setShowSandbox(false);
                    }}
                  >
                    比奇荒野 · 骷髅精灵
                  </button>
                  <button
                    className="debug-chip"
                    onClick={() => {
                      game.spawnSpecificBoss('boss_mine');
                      setShowSandbox(false);
                    }}
                  >
                    废弃矿洞 · 尸王
                  </button>
                  <button
                    className="debug-chip"
                    onClick={() => {
                      game.spawnSpecificBoss('boss_zuma');
                      setShowSandbox(false);
                    }}
                  >
                    祖玛神庙 · 祖玛教主
                  </button>
                  <button
                    className="debug-chip"
                    onClick={() => {
                      game.spawnSpecificBoss('boss_temple');
                      setShowSandbox(false);
                    }}
                  >
                    沃玛神殿 · 沃玛教主
                  </button>
                  <button
                    className="debug-chip"
                    onClick={() => {
                      game.spawnSpecificBoss('boss_boar');
                      setShowSandbox(false);
                    }}
                  >
                    石墓洞窟 · 白野猪
                  </button>
                  <button
                    className="debug-chip"
                    onClick={() => {
                      game.spawnSpecificBoss('boss_dragon');
                      setShowSandbox(false);
                    }}
                  >
                    盟重荒漠 · 触龙神
                  </button>
                  <button
                    className="debug-chip"
                    onClick={() => {
                      game.spawnSpecificBoss('boss_centipede');
                      setShowSandbox(false);
                    }}
                  >
                    死亡峡谷 · 邪恶钳虫
                  </button>
                  <button
                    className="debug-chip"
                    onClick={() => {
                      game.spawnSpecificBoss('boss_ox');
                      setShowSandbox(false);
                    }}
                  >
                    苍月海岛 · 牛魔王
                  </button>
                  <button
                    className="debug-chip"
                    onClick={() => {
                      game.spawnSpecificBoss('boss_kong');
                      setShowSandbox(false);
                    }}
                  >
                    赤月峡谷 · 双头金刚
                  </button>
                  <button
                    className="debug-chip"
                    onClick={() => {
                      game.spawnSpecificBoss('boss_blood');
                      setShowSandbox(false);
                    }}
                  >
                    赤月峡谷 · 双头血魔
                  </button>
                </div>

                <div className="debug-section-label">◇ 波次流程控制</div>
                <div className="debug-chip-group">
                  <button
                    className="debug-chip"
                    onClick={() => {
                      game.skipWaveCheat();
                      setShowSandbox(false);
                    }}
                  >
                    跳过当前波次 (结算进商店)
                  </button>
                  <button className="debug-chip" onClick={() => game.killAllEnemies()}>
                    秒杀全屏魔物
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: SKILLS SELECT */}
            {debugTab === 'skills' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div className="debug-section-label" style={{ margin: 0 }}>
                    ◇ 当前职业技能库 ({CLASS_BASES[game.heroClass]?.name})
                  </div>
                  <button
                    className="debug-mini-btn"
                    style={{ background: '#0284c7', color: '#fff', padding: '4px 10px' }}
                    onClick={() => game.maxAllSkills()}
                  >
                    一键全技能 8 级满配 MAX
                  </button>
                </div>

                <div className="debug-skill-list">
                  {SKILLS.filter((s) => s.heroClass === game.heroClass).map((def) => {
                    const current = game.skills.find((s) => s.id === def.id);
                    const lvl = current?.rank || 0;
                    return (
                      <div key={def.id} className="debug-skill-row">
                        <div className="debug-skill-info">
                          <Icon frame={def.asset} />
                          <div>
                            <strong>{def.name}</strong>
                            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>
                              {lvl > 0 ? `Lv.${lvl}/8` : '未习得'}
                            </span>
                          </div>
                        </div>
                        <div className="debug-skill-btns">
                          <button
                            className="debug-mini-btn"
                            onClick={() => game.addSkillDirectly(def.id, Math.min(8, lvl + 1))}
                          >
                            +1 级
                          </button>
                          <button
                            className="debug-mini-btn"
                            onClick={() => game.addSkillDirectly(def.id, 8)}
                          >
                            满级 (8)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: EQUIPMENT */}
            {debugTab === 'equip' && (
              <div>
                <div className="debug-section-label">◇ 传奇名兵神甲 (一键穿戴测试)</div>
                <div className="debug-chip-group">
                  {[
                    { id: 'wpn-judgment', name: '裁决之杖' },
                    { id: 'wpn-bone-staff', name: '骨玉权杖' },
                    { id: 'wpn-dragon-sword', name: '龙纹剑' },
                    { id: 'wpn-purgatory', name: '炼狱' },
                    { id: 'arm-war-god', name: '战神盔甲' },
                    { id: 'arm-devil-robe', name: '恶魔长袍' },
                    { id: 'arm-ghost-robe', name: '幽灵战衣' },
                    { id: 'helm-black-iron', name: '黑铁头盔' },
                    { id: 'neck-life', name: '生命项链' },
                    { id: 'brac-sanying', name: '三眼手镯' },
                  ].map((eq) => (
                    <button
                      key={eq.id}
                      className="debug-chip"
                      onClick={() => game.equipItemDirectly(eq.id)}
                    >
                      {eq.name}
                    </button>
                  ))}
                </div>

                <div className="debug-section-label">◇ 当前已穿戴装备</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '6px' }}>
                  {Object.entries(game.equipment).map(([slot, equipped]) => {
                    const item = equipped ? getItem(equipped.itemId) : null;
                    return (
                      <div key={slot} className="debug-skill-row" style={{ fontSize: '12px' }}>
                        <span style={{ color: '#94a3b8' }}>{SLOT_NAMES[slot as Slot]}:</span>
                        <strong style={{ color: item ? '#facc15' : '#64748b' }}>
                          {item ? item.name : '无'}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 5: MULTIPLIERS */}
            {debugTab === 'multipliers' && (
              <div>
                <div className="debug-section-label">◇ 游戏运行速度</div>
                <div className="debug-chip-group">
                  {[1, 2, 4, 8].map((spd) => (
                    <button
                      key={spd}
                      className={`debug-chip ${game.timeScale === spd ? 'active' : ''}`}
                      onClick={() => {
                        sound.playClick();
                        game.setTimeScale(spd);
                      }}
                    >
                      {spd}x 倍速
                    </button>
                  ))}
                </div>

                <div className="debug-section-label">◇ 伤害输出倍率</div>
                <div className="debug-chip-group">
                  {[
                    { val: 1, label: '1x (标准)' },
                    { val: 5, label: '5x (强力)' },
                    { val: 50, label: '50x (狂暴)' },
                    { val: 999, label: '999x (秒杀)' },
                  ].map((m) => (
                    <button
                      key={m.val}
                      className={`debug-chip ${game.damageMultiplier === m.val ? 'active' : ''}`}
                      onClick={() => game.setDamageMultiplier(m.val)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="debug-section-label">◇ 玩家移动速度</div>
                <div className="debug-chip-group">
                  {[
                    { val: 1, label: '1x (正常)' },
                    { val: 2, label: '2x (飞奔)' },
                    { val: 3, label: '3x (瞬行)' },
                    { val: 5, label: '5x (闪电)' },
                  ].map((m) => (
                    <button
                      key={m.val}
                      className={`debug-chip ${game.speedMultiplier === m.val ? 'active' : ''}`}
                      onClick={() => game.setSpeedMultiplier(m.val)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AUTHENTIC LEGEND OF MIR 2 EQUIPMENT & STATS MODAL (F10) */}
      {showEquipModal && (
        <div className="modal-container equip-modal">
          <div className="panel gold-panel mir2-equip-modal-panel">
            <div className="upgrade-header" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>玛法大陆 · 勇士装备与属性 (F10)</h2>
                <button
                  className="guide-close-btn"
                  style={{
                    backgroundImage: `url(${assetUrl('assets/mir/ui/btn_close.png')})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    paddingLeft: '28px',
                  }}
                  onClick={() => {
                    sound.playClick();
                    setShowEquipModal(false);
                  }}
                >
                  关闭 (ESC/F10)
                </button>
              </div>
              <p>传奇 1.76 原版八格装备栏布局与人物即时战斗属性一览</p>
            </div>

            <Mir2EquipmentView game={g} />
          </div>
        </div>
      )}

      {/* IN-GAME BATTLE HUD */}
      {(g.phase === 'battle' || g.phase === 'upgrade' || g.phase === 'shop' || g.phase === 'paused') && (
        <div className="hud-container">
          {/* FLOATING SUBTLE DEBUG BUTTON (TOP-LEFT) */}
          <button
            className="hud-debug-pill"
            title="快捷键: ~ 或 F1"
            onClick={() => {
              sound.playClick();
              setShowSandbox((s) => !s);
            }}
          >
            【◈ 调试 (F1)】
          </button>

          {/* AUTHENTIC LEGEND OF MIR 2 BOTTOM CONSOLE (MAINBAR: 800x133) */}
          <footer className="mir2-mainbar-container">
            <div
              className="mir2-mainbar-frame"
              style={{ backgroundImage: `url(${assetUrl('assets/mir/ui/mainbar.png')})` }}
            >
              {/* Authentic Mir2 Center Console Stone Frame & Log Underlay */}
              <div
                className="mir2-mainbar-center-bg"
                style={{ backgroundImage: `url(${assetUrl('assets/mir/ui/mainbar_center.png')})` }}
              />

              {/* LEFT: AUTHENTIC DUAL BLOOD/MANA ORB (阴阳红蓝太极血球) */}
              <div
                className="mir2-blood-orb-socket"
                title={`生命值: ${Math.round(g.player.hp)} / ${g.maxHP}`}
              >
                {/* Red HP Left Half */}
                <div className="mir2-orb-half hp-half">
                  <div
                    className="mir2-orb-fill hp-fill"
                    style={{
                      backgroundImage: `url(${assetUrl('assets/mir/ui/hp_ball.png')})`,
                      height: `${Math.max(0, Math.min(100, (g.player.hp / g.maxHP) * 100))}%`,
                    }}
                  />
                </div>
                {/* Blue MP Right Half */}
                <div className="mir2-orb-half mp-half">
                  <div
                    className="mir2-orb-fill mp-fill"
                    style={{
                      backgroundImage: `url(${assetUrl('assets/mir/ui/mp_ball.png')})`,
                      height: `${
                        g.player.shieldUntil > g.clock
                          ? 100
                          : 85
                      }%`,
                    }}
                  />
                </div>
                {/* HP Numeric Overlay */}
                <div className="mir2-orb-text">
                  <span className="orb-num-hp">{Math.round(g.player.hp)}</span>
                  <span className="orb-divider">/</span>
                  <span className="orb-num-max">{g.maxHP}</span>
                </div>
                {/* Character Name & Level tag in wooden plaque */}
                <div className="mir2-hero-badge">
                  <span>Lv.{g.level}</span>
                  <span>{g.base.name}</span>
                </div>
              </div>

              {/* CENTER: QUICK SKILLS BELT + RETRO TELEMETRY + EXP BAR */}
              <div className="mir2-center-console">
                {/* Authentic 6-slot Quick Skills Belt */}
                <div
                  className="mir2-quick-belt"
                  style={{ backgroundImage: `url(${assetUrl('assets/mir/ui/quick_bar.png')})` }}
                >
                  {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
                    const skill = g.skills[slotIdx];
                    if (!skill) {
                      return (
                        <div
                          key={slotIdx}
                          className="mir2-quick-slot empty-slot"
                          style={{ left: `${17 + 42 * slotIdx}px`, top: '6px' }}
                        >
                          <span className="slot-key">{slotIdx + 1}</span>
                        </div>
                      );
                    }
                    const def = getSkill(skill.id);
                    const cdMax = Math.max(
                      0.25,
                      def.cooldown *
                        (1 - (g.stats.cooldown_reduction ?? 0) / 100) *
                        (1 - skill.localCDR / 100)
                    );
                    const cdPct = cdMax > 0 ? Math.min(1, skill.cd / cdMax) : 0;

                    return (
                      <div
                        key={slotIdx}
                        className={`mir2-quick-slot active-slot skill-${skill.id}`}
                        style={{ left: `${17 + 42 * slotIdx}px`, top: '6px' }}
                        title={`${def.name} (Lv.${skill.rank})\n${def.description}`}
                      >
                        <Icon frame={def.asset} />
                        <span className="slot-key">{slotIdx + 1}</span>
                        <span className="slot-rank">{skill.rank}</span>
                        {skill.cd > 0 && (
                          <div
                            className="mir2-cd-sweep"
                            style={{ height: `${cdPct * 100}%` }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Middle Row: Battlefield Telemetry styled like Mir2 chat log */}
                <div className="mir2-telemetry-chat">
                  <div className="mir2-chat-line">
                    <span className="mir2-chat-tag">[战况]</span>
                    <span className="mir2-chat-highlight">【{CHAPTERS[g.chapter]?.name}】第 {g.wave}/{g.maxWaves} 波</span>
                    <span className="mir2-chat-timer">剩余 {Math.max(0, Math.ceil(g.duration - g.waveTime))}s</span>
                  </div>
                  <div className="mir2-chat-line">
                    <span className="mir2-chat-tag">[斩获]</span>
                    <span className="mir2-chat-stat">击杀: <strong>{g.kills}</strong></span>
                    <span className="mir2-chat-gold">金币: <strong>{g.gold}</strong></span>
                    <span className="mir2-chat-highlight">境界: <strong>Lv.{g.level}</strong></span>
                  </div>
                </div>

                {/* Bottom Row: Exp Bar aligned with center frame groove */}
                <div
                  className="mir2-exp-track"
                  title={`经验: ${g.exp} / ${expNeeded(g.level)}`}
                >
                  <div
                    className="mir2-exp-fill"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, (g.exp / expNeeded(g.level)) * 100)
                      )}%`,
                    }}
                  />
                  <div className="mir2-exp-text">
                    经验: {g.exp} / {expNeeded(g.level)} (
                    {Math.round((g.exp / expNeeded(g.level)) * 100)}%)
                  </div>
                </div>
              </div>

              {/* RIGHT: AUTHENTIC MIR 2 CONSOLE BUTTONS OVERLAID ON OVAL */}
              <div className="mir2-actions-cluster">
                <button
                  className="mir2-console-btn btn-bag"
                  title="随身包裹 (F9)"
                  onClick={() => {
                    sound.playClick();
                    setShowEquipModal((s) => !s);
                  }}
                />
                <button
                  className="mir2-console-btn btn-equip"
                  title="人物状态与装备 (F10 或 B)"
                  onClick={() => {
                    sound.playClick();
                    setShowEquipModal((s) => !s);
                  }}
                />
                <button
                  className="mir2-console-btn btn-skill"
                  title="技能藏经阁 (F11 或 K)"
                  onClick={() => {
                    sound.playClick();
                    setShowCompendium((s) => !s);
                  }}
                />
                <button
                  className="mir2-console-btn btn-opt"
                  title="系统设置 / 暂停 (ESC)"
                  onClick={() => {
                    sound.playClick();
                    game.pause();
                  }}
                />
              </div>
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
                  className={`choice-card ${c.isEvolution ? 'choice-card-evolution' : ''}`}
                  onClick={() => {
                    sound.playClick();
                    if (c.id.startsWith('learn-') && g.skills.length >= 6) {
                      setReplaceTargetChoice(c);
                    } else {
                      game.choose(c.id);
                    }
                  }}
                >
                  <div className="card-key-tag">[{idx + 1}]</div>
                  <div className={`card-type-tag ${c.isEvolution ? 'evolution' : c.kind}`}>
                    {c.isEvolution
                      ? '神技演化 · 终极奥义'
                      : c.kind === 'skill'
                      ? c.id.startsWith('learn-')
                        ? g.skills.length >= 6
                          ? '替换新技能'
                          : '领悟新技能'
                        : '技能进阶'
                      : '属性增幅'}
                  </div>
                  {c.skill && (
                    <div className="choice-icon-wrap">
                      <Icon frame={getSkill(c.skill).asset} />
                    </div>
                  )}
                  <h3 className="card-title">{c.name}</h3>
                  <p className="card-desc">{c.description}</p>
                  <button className="card-select-btn">{c.isEvolution ? '神技觉醒' : '选择此项'}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REPLACE SKILL MODAL (When full 6 skills) */}
      {replaceTargetChoice && (
        <div className="modal-container replace-skill-modal">
          <div className="panel gold-panel upgrade-panel" style={{ maxWidth: '720px' }}>
            <div className="upgrade-header">
              <h2>技能领悟 · 技能替换</h2>
              <p style={{ color: '#facc15' }}>
                当前技能槽已达上限 (6/6)，习得新技能【{getSkill(replaceTargetChoice.skill!).name}】需选择遗忘替换当前一个技能：
              </p>
            </div>

            <div className="replace-skills-grid">
              {g.skills.map((s) => {
                const def = getSkill(s.id);
                return (
                  <div key={s.id} className="replace-skill-card">
                    <div className="replace-skill-header">
                      <Icon frame={def.asset} />
                      <div>
                        <div className="replace-skill-title">{def.name}</div>
                        <div className="replace-skill-lvl">当前 Lv.{s.rank}</div>
                      </div>
                    </div>
                    <p className="replace-skill-desc">{def.description}</p>
                    <button
                      className="replace-confirm-btn"
                      onClick={() => {
                        sound.playLevelUp();
                        game.choose(replaceTargetChoice.id, s.id);
                        setReplaceTargetChoice(null);
                      }}
                    >
                      遗忘此技能并替换
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                className="guide-close-btn"
                style={{ float: 'none', padding: '6px 20px' }}
                onClick={() => {
                  sound.playClick();
                  setReplaceTargetChoice(null);
                }}
              >
                返回重新选择强化
              </button>
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

            {/* Equipped Items Drawer - Authentic Mir 2 Layout */}
            <div className="equipment-strip" style={{ marginTop: '14px' }}>
              <h4 style={{ color: '#facc15', marginBottom: '8px' }}>
                当前穿戴装备 · 传奇 1.76 原版八格神装 (点击装备格可查看详情与变卖)
              </h4>
              <Mir2EquipmentView game={g} onSell={(slot) => game.sell(slot)} />
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

            {/* Equipped Items Section - Authentic Mir 2 Layout */}
            <div className="pause-equipped-section">
              <h4 style={{ color: '#facc15', marginBottom: '8px' }}>当前穿戴装备 · 传奇 1.76 原版八格神装</h4>
              <Mir2EquipmentView game={g} />
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
