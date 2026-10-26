import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { game } from './game';
import {
  CHAPTERS,
  CLASS_BASES,
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
} from './types';

export function App() {
  const g = useSyncExternalStore(game.subscribe, () => game);
  const [muted, setMuted] = useState(sound.isMuted());
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [selectedClass, setSelectedClass] = useState<HeroClass>('wizard');
  const [selectedChapter, setSelectedChapter] = useState<MapChapter>('bichon');
  const [showHistory, setShowHistory] = useState(false);
  const [showTalents, setShowTalents] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile);
    history().then(setRuns);
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
    game.start(selectedClass, selectedChapter, mode, undefined, profile || undefined);
  };

  const handleUpgradeTalent = async (key: TalentKey) => {
    const next = await upgradeTalent(key);
    setProfile(next);
  };

  const handleResetTalents = async () => {
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
        {muted ? '🔇' : '🔊'}
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
                  💎 玛法结晶: <strong>{profile.crystals}</strong>
                </div>
              )}
            </div>

            {/* CLASS SELECTOR */}
            <div className="class-selector-tabs">
              {(['wizard', 'taoist', 'warrior'] as HeroClass[]).map((cls) => {
                const base = CLASS_BASES[cls];
                const active = selectedClass === cls;
                return (
                  <button
                    key={cls}
                    className={`class-tab ${active ? 'active' : ''}`}
                    onClick={() => setSelectedClass(cls)}
                  >
                    <div className="class-tab-icon">
                      {cls === 'wizard' ? '🧙‍♂️' : cls === 'taoist' ? '☯️' : '⚔️'}
                    </div>
                    <div className="class-tab-name">{base.name}</div>
                  </button>
                );
              })}
            </div>

            {/* HERO OVERVIEW */}
            {CLASS_BASES[selectedClass] && (
              <div className="hero-card">
                <div className="hero-avatar">
                  <div className="wizard-icon">
                    {selectedClass === 'wizard' ? '🧙‍♂️' : selectedClass === 'taoist' ? '☯️' : '⚔️'}
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
                return (
                  <button
                    key={chapKey}
                    className={`chap-btn ${active ? 'active' : ''}`}
                    onClick={() => setSelectedChapter(chapKey)}
                  >
                    <span className="chap-name">{chap.name}</span>
                    <span className="chap-boss">({chap.bossName})</span>
                  </button>
                );
              })}
            </div>

            {/* START BUTTONS */}
            <div className="mode-select-grid">
              <button
                className="mode-btn primary-btn"
                onClick={() => handleStart('normal')}
              >
                <div className="btn-title">⚔️ 标准远征 (Normal)</div>
                <div className="btn-desc">12 波次 × 75 秒 · 15 分钟决战章节 Boss</div>
              </button>
              <button
                className="mode-btn secondary-btn"
                onClick={() => handleStart('trial')}
              >
                <div className="btn-title">⚡ 快速试炼 (Trial)</div>
                <div className="btn-desc">3 波次 × 35 秒 · 快速测试流派构筑</div>
              </button>
            </div>

            <div className="lobby-footer">
              <div className="lobby-actions-row">
                <button
                  className="crystal-shrine-btn"
                  onClick={() => setShowTalents(true)}
                >
                  🏛️ 结晶祭坛 / 永久天赋
                </button>
                <button
                  className="text-btn"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  📜 历次远征战绩 ({runs.length})
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
                        <span className="hist-status">{r.won ? '👑 胜利' : '💀 阵亡'}</span>
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
              <h2>🏛️ 玛法结晶祭坛 · 永久天赋</h2>
              <p>消耗每局击杀 Boss 与通关获得的玛法结晶，永久强化战力</p>
              <div className="crystal-balance">
                持有结晶: <strong>💎 {profile.crystals}</strong>
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
                          加点 (💎 {cost})
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
                🔄 重置天赋 (全额返还)
              </button>
              <button
                className="primary-btn"
                onClick={() => setShowTalents(false)}
              >
                完成退出
              </button>
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
              <span className="counter-item">💰 {g.gold}</span>
              <span className="counter-item">💀 {g.kills}</span>
              <button
                className="pause-hud-btn"
                onClick={() => game.pause()}
                title="暂停游戏 (ESC)"
              >
                ⏸️
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
                      <span className="slot-empty-icon">➕</span>
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
                    <span className="slot-num">{slotIdx + 1}</span>
                    <span className="skill-rank">Lv.{skill.rank}</span>
                    <div className="skill-name">{def.name}</div>
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
                  onClick={() => game.choose(c.id)}
                >
                  <div className="card-key-tag">[{idx + 1}]</div>
                  <div className={`card-type-tag ${c.kind}`}>
                    {c.kind === 'skill' ? (c.id.startsWith('learn-') ? '★ 领悟新技能' : '▲ 技能进阶') : '◆ 属性增幅'}
                  </div>
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
                <span>当前持有金币: <strong>💰 {g.gold}</strong></span>
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
                      <span className={`item-tier tier-${item.tier}`}>{item.name}</span>
                      <span className="item-price">💰 {o.price}</span>
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
                            onClick={() => game.buy(o.id)}
                          >
                            购买
                          </button>
                          <button
                            className={`lock-btn ${o.locked ? 'active' : ''}`}
                            onClick={() => game.lock(o.id)}
                          >
                            {o.locked ? '🔒 已锁定' : '🔓 锁定'}
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
                          <span className="item-name">{item.name}</span>
                          <button
                            className="sell-btn"
                            onClick={() => game.sell(slot)}
                            title={`折价变卖 (返还 💰${sellPrice(eq!.paid, item.price)})`}
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
                onClick={() => game.reroll()}
              >
                🔄 刷新货架 ({g.freeRerolls > 0 ? `免费 (${g.freeRerolls})` : `💰 ${g.cooldownCost}`})
              </button>
              <button
                className="next-wave-btn primary-btn"
                onClick={() => game.nextWave()}
              >
                ⚔️ 进入第 {g.wave + 1} 波
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
            </div>
            <div className="pause-actions">
              <button className="primary-btn" onClick={() => game.pause()}>
                ▶️ 继续战斗
              </button>
              <button
                className="secondary-btn"
                onClick={() => game.start(g.heroClass, g.chapter, g.mode, g.seed, profile || undefined)}
              >
                🔄 重开本局 (相同种子)
              </button>
              <button
                className="danger-btn"
                onClick={() => { game.phase = 'lobby'; game.emit(); }}
              >
                🚪 放弃并返回营地
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
                  ? `👑 玛法凯旋 · 诛灭 ${CHAPTERS[g.chapter]?.bossName}`
                  : '💀 喋血荒野 · 试炼落幕'}
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
                <span className="val">💎 +{g.result.crystals}</span>
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

            <div className="result-actions">
              <button
                className="primary-btn"
                onClick={() => handleStart(g.mode)}
              >
                ⚔️ 再次出征
              </button>
              <button
                className="secondary-btn"
                onClick={() => { game.phase = 'lobby'; game.emit(); }}
              >
                🏠 返回大厅
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
