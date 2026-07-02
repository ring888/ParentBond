import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { GameRecordInput, GameSummary, GameSummaryItem, GameType } from "@parentbond/shared";
import { fetchGameSummary, saveGameRecord } from "../../services/api";
import { localDateString } from "../../app/formatters";

const gameOrder: GameType[] = ["schulte", "stroop", "nback", "reaction"];

const fallbackGameMeta: Record<GameType, Pick<GameSummaryItem, "name" | "icon" | "metricLabel">> = {
  schulte: { name: "舒尔特方格", icon: "🔢", metricLabel: "视觉搜索 · 注意广度" },
  stroop: { name: "Stroop 冲突", icon: "🎨", metricLabel: "抑制干扰 · 执行控制" },
  nback: { name: "N-back 记忆", icon: "🧠", metricLabel: "工作记忆 · 持续注意" },
  reaction: { name: "反应挑战", icon: "⚡", metricLabel: "反应速度 · 抑制平衡" },
};

const gameTone: Record<GameType, string> = {
  schulte: "game-blue",
  stroop: "game-purple",
  nback: "game-green",
  reaction: "game-gold",
};

function fallbackGameSummary(userId: string): GameSummary {
  const date = localDateString();
  return {
    userId,
    date,
    todaySessions: 0,
    todayMinutes: 0,
    totalSessions: 0,
    games: gameOrder.map((gameType) => ({
      gameType,
      ...fallbackGameMeta[gameType],
      bestLabel: "暂无记录",
      recentLabel: "先完成一轮",
      todayCount: 0,
      history: [],
      trend: [],
    })),
    updatedAt: new Date().toISOString(),
  };
}

function gameRecordDisplay(gameType: GameType, record: GameSummaryItem["history"][number]) {
  if (gameType === "schulte") return `${((record.score ?? record.durationMs) / 1000).toFixed(1)}s`;
  if (gameType === "reaction") return `${record.reactionMs ?? record.score ?? 0}ms`;
  return `${record.accuracy ?? record.score ?? 0}%`;
}

export function GamesView({ userId }: { userId: string }) {
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [syncStatus, setSyncStatus] = useState<"loading" | "live" | "saving" | "offline">("loading");
  const [activeGame, setActiveGame] = useState<GameType>("schulte");
  const date = localDateString();
  const effectiveSummary = summary ?? fallbackGameSummary(userId);
  const activeItem = effectiveSummary.games.find((game) => game.gameType === activeGame) ?? effectiveSummary.games[0];

  const refreshSummary = useCallback(() => {
    setSyncStatus("loading");
    fetchGameSummary(userId, date)
      .then((nextSummary) => {
        setSummary(nextSummary);
        setSyncStatus("live");
      })
      .catch(() => {
        setSyncStatus("offline");
      });
  }, [date, userId]);

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  const persistGameRecord = useCallback(
    (record: Omit<GameRecordInput, "userId" | "date">) => {
      setSyncStatus("saving");
      saveGameRecord({ ...record, userId, date })
        .then((nextSummary) => {
          setSummary(nextSummary);
          setSyncStatus("live");
        })
        .catch(() => {
          setSyncStatus("offline");
        });
    },
    [date, userId],
  );

  const syncText =
    syncStatus === "saving" ? "保存中" : syncStatus === "loading" ? "同步中" : syncStatus === "offline" ? "离线" : "已同步";

  return (
    <section className="view-stack games-template-view">
      <div className="hint-bar games-hint">
        💡 建议做作业前先训练 <strong>5–10 分钟</strong>，让大脑先进入专注频道
      </div>

      <div className="game-summary-strip">
        <div>
          <span className="label-dot green">专注游戏</span>
          <strong>{effectiveSummary.todaySessions}</strong>
          <em>今日训练次数</em>
        </div>
        <div>
          <span className={syncStatus === "offline" ? "games-sync offline" : "games-sync"}>{syncText}</span>
          <strong>{effectiveSummary.todayMinutes}m</strong>
          <em>今日游戏时长</em>
        </div>
      </div>

      <div className="sec-row games-section-row"><div className="sec-t">选择游戏</div></div>
      <div className="game-scroll">
        {effectiveSummary.games.map((item) => (
          <button
            key={item.gameType}
            className={`game-card ${gameTone[item.gameType]} ${activeGame === item.gameType ? "game-active" : ""}`}
            type="button"
            onClick={() => setActiveGame(item.gameType)}
          >
            <span className="card-shine" />
            <span className="game-active-check">✓</span>
            <span className="game-icon" aria-hidden="true">{item.icon}</span>
            <strong>{item.name}</strong>
            <span>{item.metricLabel}</span>
            <em>最佳 {item.bestLabel}</em>
          </button>
        ))}
      </div>

      {activeGame === "schulte" && <SchulteGame item={activeItem} onComplete={persistGameRecord} />}
      {activeGame === "stroop" && <StroopGame item={activeItem} onComplete={persistGameRecord} />}
      {activeGame === "nback" && <NbackGame item={activeItem} onComplete={persistGameRecord} />}
      {activeGame === "reaction" && <ReactionGame item={activeItem} onComplete={persistGameRecord} />}

      <GameTrend item={activeItem} />

      <div className="sec-row games-section-row"><div className="sec-t">最近记录</div><div className="sec-m">真实数据</div></div>
      <div className="game-record-list">
        {activeItem.history.length ? (
          activeItem.history.slice(0, 4).map((record) => (
            <div className="game-record-row" key={record.id}>
              <div className="gr-dot">{activeItem.icon}</div>
              <div>
                <strong>{record.difficulty}</strong>
                <span>{new Date(record.completedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <em>{gameRecordDisplay(activeItem.gameType, record)}</em>
            </div>
          ))
        ) : (
          <div className="game-empty-state">完成任意一轮训练后，这里会显示真实历史记录。</div>
        )}
      </div>
    </section>
  );
}

function GameTrend({ item }: { item: GameSummaryItem }) {
  const trend = item.trend.length ? item.trend : [{ label: "暂无", value: 0 }];
  const max = Math.max(1, ...trend.map((point) => point.value));
  return (
    <>
      <div className="sec-row games-section-row"><div className="sec-t">{item.name} · 最近趋势</div><div className="sec-m">详情</div></div>
      <div className="game-trend-card">
        <div className="game-trend-head">
          <div>{item.gameType === "schulte" || item.gameType === "reaction" ? "成绩趋势（越低越好）" : "正确率趋势（越高越好）"}</div>
          <span>{item.recentLabel}</span>
        </div>
        <div className="game-trend-bars">
          {trend.map((point, index) => (
            <div className="game-trend-col" key={`${point.label}-${index}`}>
              <div className="game-trend-bar-wrap">
                <div
                  className={index === trend.length - 1 ? "game-trend-bar today" : "game-trend-bar"}
                  style={{ height: `${point.value > 0 ? Math.max(8, Math.round((point.value / max) * 100)) : 5}%` }}
                />
              </div>
              <span>{point.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

type GameCompleteHandler = (record: Omit<GameRecordInput, "userId" | "date">) => void;

function shuffleNumbers(total: number) {
  const values = Array.from({ length: total }, (_, index) => index + 1);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

function SchulteGame({ item, onComplete }: { item: GameSummaryItem; onComplete: GameCompleteHandler }) {
  const [size, setSize] = useState(5);
  const [numbers, setNumbers] = useState(() => shuffleNumbers(25));
  const [target, setTarget] = useState(1);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [message, setMessage] = useState("点击“开始训练”挑战自己");
  const startAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  const resetGrid = (nextSize = size) => {
    setNumbers(shuffleNumbers(nextSize * nextSize));
    setTarget(1);
    setElapsedMs(0);
    setMissCount(0);
    setRunning(false);
    setMessage("点击“开始训练”挑战自己");
    if (timerRef.current) window.clearInterval(timerRef.current);
  };

  const selectSize = (nextSize: number) => {
    if (running) {
      setMessage("请先完成或重新开始本轮训练");
      return;
    }
    setSize(nextSize);
    resetGrid(nextSize);
  };

  const start = () => {
    resetGrid(size);
    startAtRef.current = performance.now();
    setRunning(true);
    setMessage(`找到 1，加油！`);
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - startAtRef.current));
    }, 100);
  };

  const tap = (value: number) => {
    if (!running) return;
    if (value !== target) {
      setMissCount((current) => current + 1);
      setMessage(`现在要找 ${target}`);
      return;
    }
    const total = size * size;
    if (value === total) {
      const durationMs = Math.max(1, Math.round(performance.now() - startAtRef.current));
      if (timerRef.current) window.clearInterval(timerRef.current);
      setElapsedMs(durationMs);
      setRunning(false);
      setTarget(total + 1);
      setMessage(`完成！用时 ${(durationMs / 1000).toFixed(1)} 秒`);
      onComplete({
        gameType: "schulte",
        difficulty: `${size}x${size}`,
        durationMs,
        score: durationMs,
        accuracy: Math.max(0, Math.round(((total - missCount) / total) * 100)),
        missCount,
        detail: { size, total },
      });
      return;
    }
    setTarget((current) => current + 1);
    setMessage(`找到 ${value + 1}，继续！`);
  };

  return (
    <div className="game-panel-card schulte-panel">
      <GamePanelHeader icon={item.icon} title={item.name} tag={`${size}×${size}`} />
      <DifficultyTabs values={[3, 4, 5, 6, 7]} active={size} format={(value) => `${value}×${value}`} onSelect={selectSize} />
      <div className="game-hud">
        <HudItem value={running ? target : "—"} label="目标数字" />
        <HudItem value={`${(elapsedMs / 1000).toFixed(1)}s`} label="用时" />
        <HudItem value={`${Math.min(target - 1, size * size)}/${size * size}`} label="进度" />
      </div>
      <div className="game-target-text">{message}</div>
      <div className="schulte-grid rich" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {numbers.map((value) => (
          <button
            key={value}
            className={value < target ? "schulte-cell cleared" : "schulte-cell"}
            type="button"
            onClick={() => tap(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <button className="game-start-button green" type="button" onClick={start}>{running ? "重新开始" : "开始训练"}</button>
    </div>
  );
}

const stroopColors = [
  { key: "red", label: "红", value: "#FF7B6B" },
  { key: "green", label: "绿", value: "#3DD68C" },
  { key: "blue", label: "蓝", value: "#60A5FA" },
  { key: "yellow", label: "黄", value: "#F5C842" },
  { key: "purple", label: "紫", value: "#A78BFA" },
  { key: "orange", label: "橙", value: "#FF9F43" },
];

function pickStroopQuestion(size: number) {
  const pool = stroopColors.slice(0, size);
  return {
    word: pool[Math.floor(Math.random() * pool.length)],
    color: pool[Math.floor(Math.random() * pool.length)],
  };
}

function StroopGame({ item, onComplete }: { item: GameSummaryItem; onComplete: GameCompleteHandler }) {
  const [size, setSize] = useState(5);
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [locked, setLocked] = useState(false);
  const [question, setQuestion] = useState(() => pickStroopQuestion(5));
  const [message, setMessage] = useState("规则：点击文字的显示颜色，不是文字本身的意思");
  const startAtRef = useRef(0);

  const start = () => {
    startAtRef.current = performance.now();
    setRound(1);
    setCorrect(0);
    setStreak(0);
    setLocked(false);
    setRunning(true);
    setQuestion(pickStroopQuestion(size));
    setMessage("点击文字显示出来的颜色");
  };

  const choose = (key: string) => {
    if (!running || locked) return;
    const ok = key === question.color.key;
    const nextCorrect = correct + (ok ? 1 : 0);
    const nextStreak = ok ? streak + 1 : 0;
    setCorrect(nextCorrect);
    setStreak(nextStreak);
    setLocked(true);
    setMessage(ok ? "答对了，继续保持" : "看颜色，不看文字意思");
    if (round >= 10) {
      const durationMs = Math.max(1, Math.round(performance.now() - startAtRef.current));
      const accuracy = Math.round((nextCorrect / 10) * 100);
      setRunning(false);
      onComplete({
        gameType: "stroop",
        difficulty: `${size}色`,
        durationMs,
        score: accuracy,
        accuracy,
        missCount: 10 - nextCorrect,
        detail: { rounds: 10, colors: size },
      });
      setMessage(`完成！本轮正确率 ${accuracy}%`);
      return;
    }
    window.setTimeout(() => {
      setRound((current) => current + 1);
      setQuestion(pickStroopQuestion(size));
      setLocked(false);
      setMessage("点击文字显示出来的颜色");
    }, 520);
  };

  return (
    <div className="game-panel-card stroop-panel">
      <GamePanelHeader icon={item.icon} title={item.name} tag={`${size} 色`} />
      <DifficultyTabs values={[4, 5, 6]} active={size} format={(value) => `${value} 色`} onSelect={(value) => !running && setSize(value)} />
      <div className="game-hud">
        <HudItem value={running ? `${round}/10` : "—"} label="第几题" />
        <HudItem value={`${round ? Math.round((correct / round) * 100) : 0}%`} label="正确率" />
        <HudItem value={streak} label="连续答对" />
      </div>
      <div className="game-target-text">{message}</div>
      <div className="stroop-stage">
        {running || round > 0 ? (
          <div className="stroop-word" style={{ color: question.color.value }}>{question.word.label}</div>
        ) : (
          <div className="stroop-idle">点击下方“开始挑战”<br />准备好就立刻开始第 1 题</div>
        )}
      </div>
      <div className="stroop-swatches">
        {stroopColors.slice(0, size).map((color) => (
          <button
            key={color.key}
            className="swatch"
            type="button"
            style={{ background: color.value }}
            onClick={() => choose(color.key)}
            aria-label={color.label}
          >
            <span className="swatch-check">✓</span>
          </button>
        ))}
      </div>
      <button className="game-start-button purple" type="button" onClick={start}>{running ? "重新开始" : "开始挑战"}</button>
    </div>
  );
}

const nbackShapes = ["●", "■", "▲", "◆", "★", "⬟"];

function buildNbackSequence(level: number) {
  const sequence: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    if (index >= level && Math.random() < 0.38) {
      sequence.push(sequence[index - level]);
    } else {
      let shape = nbackShapes[Math.floor(Math.random() * nbackShapes.length)];
      while (index >= level && shape === sequence[index - level]) {
        shape = nbackShapes[Math.floor(Math.random() * nbackShapes.length)];
      }
      sequence.push(shape);
    }
  }
  return sequence;
}

function NbackGame({ item, onComplete }: { item: GameSummaryItem; onComplete: GameCompleteHandler }) {
  const [level, setLevel] = useState(2);
  const [sequence, setSequence] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("判断当前图形是否与 2 步前相同");
  const startAtRef = useRef(0);

  const awaiting = running && index >= level;

  useEffect(() => {
    if (!running || awaiting) return undefined;
    const timer = window.setTimeout(() => {
      setIndex((current) => current + 1);
      setMessage(`先记住这个图形`);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [awaiting, index, running]);

  const start = () => {
    startAtRef.current = performance.now();
    setSequence(buildNbackSequence(level));
    setIndex(0);
    setCorrect(0);
    setStreak(0);
    setRunning(true);
    setMessage("先记住前面出现的图形");
  };

  const answer = (isMatch: boolean) => {
    if (!awaiting) return;
    const actual = sequence[index] === sequence[index - level];
    const ok = isMatch === actual;
    const nextCorrect = correct + (ok ? 1 : 0);
    const answered = index - level + 1;
    setCorrect(nextCorrect);
    setStreak(ok ? streak + 1 : 0);
    setMessage(ok ? "判断正确" : "这题不对，下一题稳住");

    if (index >= sequence.length - 1) {
      const durationMs = Math.max(1, Math.round(performance.now() - startAtRef.current));
      const total = Math.max(1, sequence.length - level);
      const accuracy = Math.round((nextCorrect / total) * 100);
      setRunning(false);
      onComplete({
        gameType: "nback",
        difficulty: `${level}-back`,
        durationMs,
        score: accuracy,
        accuracy,
        missCount: total - nextCorrect,
        detail: { level, rounds: total },
      });
      setMessage(`完成！本轮正确率 ${accuracy}%`);
      return;
    }

    window.setTimeout(() => {
      setIndex((current) => current + 1);
      setMessage(`判断当前图形是否与 ${level} 步前相同`);
    }, 480);
  };

  const trail = sequence.slice(Math.max(0, index - 4), index + 1);

  return (
    <div className="game-panel-card nback-panel">
      <GamePanelHeader icon={item.icon} title={item.name} tag={`${level}-back`} />
      <DifficultyTabs values={[1, 2, 3]} active={level} format={(value) => `${value}-back`} onSelect={(value) => !running && setLevel(value)} />
      <div className="game-hud">
        <HudItem value={running ? `${Math.min(index + 1, sequence.length)}/10` : "—"} label="进度" />
        <HudItem value={`${index >= level ? Math.round((correct / Math.max(1, index - level + 1)) * 100) : 0}%`} label="正确率" />
        <HudItem value={streak} label="连续答对" />
      </div>
      <div className="game-target-text">{message}</div>
      <div className="nback-trail">
        {trail.map((shape, trailIndex) => (
          <div className={trailIndex === trail.length - 1 ? "nback-trail-item cur" : "nback-trail-item"} key={`${shape}-${trailIndex}`}>
            {shape}
          </div>
        ))}
      </div>
      <div className="nback-stage">
        {running ? (
          <>
            <div className="nback-memlabel">{level}-back</div>
            <div className="nback-shape">{sequence[index]}</div>
          </>
        ) : (
          <div className="nback-idle">点击“开始训练”<br />先记住前面出现的图形</div>
        )}
      </div>
      <div className="nback-actions">
        <button className="nback-btn match" type="button" disabled={!awaiting} onClick={() => answer(true)}>✓ 一样</button>
        <button className="nback-btn nomatch" type="button" disabled={!awaiting} onClick={() => answer(false)}>✗ 不一样</button>
      </div>
      <button className="game-start-button green" type="button" onClick={start}>{running ? "重新开始" : "开始训练"}</button>
    </div>
  );
}

const reactionConfig = {
  easy: { label: "简单", hold: 900 },
  std: { label: "标准", hold: 700 },
  fast: { label: "极速", hold: 500 },
} as const;

type ReactionDifficulty = keyof typeof reactionConfig;
type ReactionSignal = "idle" | "waiting" | "go" | "nogo" | "done";

function ReactionGame({ item, onComplete }: { item: GameSummaryItem; onComplete: GameCompleteHandler }) {
  const [difficulty, setDifficulty] = useState<ReactionDifficulty>("std");
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0);
  const [avgMs, setAvgMs] = useState<number | null>(null);
  const [missCount, setMissCount] = useState(0);
  const [signal, setSignal] = useState<ReactionSignal>("idle");
  const [message, setMessage] = useState("绿色立刻点；红色千万别点");
  const waitTimerRef = useRef<number | null>(null);
  const windowTimerRef = useRef<number | null>(null);
  const roundRef = useRef(0);
  const missRef = useRef(0);
  const hitsRef = useRef<number[]>([]);
  const signalRef = useRef<ReactionSignal>("idle");
  const signalStartRef = useRef(0);
  const sessionStartRef = useRef(0);

  const clearTimers = () => {
    if (waitTimerRef.current) window.clearTimeout(waitTimerRef.current);
    if (windowTimerRef.current) window.clearTimeout(windowTimerRef.current);
    waitTimerRef.current = null;
    windowTimerRef.current = null;
  };

  useEffect(() => () => clearTimers(), []);

  const setSignalState = (nextSignal: ReactionSignal) => {
    signalRef.current = nextSignal;
    setSignal(nextSignal);
  };

  const finish = () => {
    clearTimers();
    setRunning(false);
    setSignalState("done");
    const average = hitsRef.current.length
      ? Math.round(hitsRef.current.reduce((sum, value) => sum + value, 0) / hitsRef.current.length)
      : 0;
    setAvgMs(average || null);
    setMessage(average ? `完成！平均反应 ${average}ms，失误 ${missRef.current} 次` : "完成！这轮主要练了忍住不乱点");
    onComplete({
      gameType: "reaction",
      difficulty,
      durationMs: Math.max(1, Math.round(performance.now() - sessionStartRef.current)),
      score: average || null,
      accuracy: Math.max(0, Math.round(((8 - missRef.current) / 8) * 100)),
      reactionMs: average || null,
      missCount: missRef.current,
      detail: { hits: hitsRef.current, difficulty },
    });
  };

  const scheduleCue = (nextRound: number) => {
    if (nextRound > 8) {
      finish();
      return;
    }
    roundRef.current = nextRound;
    setRound(nextRound);
    setSignalState("waiting");
    setMessage("准备，等颜色出现");
    const delay = 650 + Math.random() * 1150;
    waitTimerRef.current = window.setTimeout(() => {
      const nextSignal: ReactionSignal = Math.random() < 0.72 ? "go" : "nogo";
      setSignalState(nextSignal);
      if (nextSignal === "go") {
        signalStartRef.current = performance.now();
        setMessage("现在点击！");
        windowTimerRef.current = window.setTimeout(() => {
          missRef.current += 1;
          setMissCount(missRef.current);
          scheduleCue(roundRef.current + 1);
        }, reactionConfig[difficulty].hold);
      } else {
        setMessage("红色别点，忍住");
        windowTimerRef.current = window.setTimeout(() => scheduleCue(roundRef.current + 1), reactionConfig[difficulty].hold);
      }
    }, delay);
  };

  const start = () => {
    clearTimers();
    sessionStartRef.current = performance.now();
    roundRef.current = 0;
    missRef.current = 0;
    hitsRef.current = [];
    setRound(0);
    setMissCount(0);
    setAvgMs(null);
    setRunning(true);
    scheduleCue(1);
  };

  const tap = () => {
    if (!running) {
      setMessage("先点击开始挑战");
      return;
    }
    if (signalRef.current === "waiting") {
      missRef.current += 1;
      setMissCount(missRef.current);
      setMessage("太早了，等绿色出现");
      return;
    }
    clearTimers();
    if (signalRef.current === "go") {
      const ms = Math.max(80, Math.round(performance.now() - signalStartRef.current));
      hitsRef.current = [...hitsRef.current, ms];
      const average = Math.round(hitsRef.current.reduce((sum, value) => sum + value, 0) / hitsRef.current.length);
      setAvgMs(average);
      setMessage(`很好，反应 ${ms}ms`);
    } else if (signalRef.current === "nogo") {
      missRef.current += 1;
      setMissCount(missRef.current);
      setMessage("红色不能点，练的是抑制力");
    }
    window.setTimeout(() => scheduleCue(roundRef.current + 1), 520);
  };

  const signalText =
    signal === "go" ? ["🟢", "现在点击！", "越快越好"] :
    signal === "nogo" ? ["🔴", "别点！", "忍住就是胜利"] :
    signal === "done" ? ["✓", "本轮完成", "可以再挑战一次"] :
    signal === "waiting" ? ["…", "准备", "不要提前点"] :
    ["👆", "点击“开始挑战”", "绿色出现立即点击，红色出现要忍住"];

  return (
    <div className="game-panel-card reaction-panel">
      <GamePanelHeader icon={item.icon} title={item.name} tag={reactionConfig[difficulty].label} />
      <DifficultyTabs
        values={["easy", "std", "fast"] as ReactionDifficulty[]}
        active={difficulty}
        format={(value) => reactionConfig[value].label}
        onSelect={(value) => !running && setDifficulty(value)}
      />
      <div className="game-hud">
        <HudItem value={running ? `${Math.max(0, 9 - round)}/8` : "—"} label="剩余次数" />
        <HudItem value={avgMs ? `${avgMs}ms` : "—"} label="平均反应" />
        <HudItem value={missCount} label="失误次数" />
      </div>
      <div className="game-target-text">{message}</div>
      <button className={`reaction-zone ${signal}`} type="button" onClick={tap}>
        <div className="rc-zone-icon">{signalText[0]}</div>
        <div className="rc-zone-txt">{signalText[1]}</div>
        <div className="rc-zone-sub">{signalText[2]}</div>
      </button>
      <button className="game-start-button coral" type="button" onClick={start}>{running ? "重新开始" : "开始挑战"}</button>
    </div>
  );
}

function GamePanelHeader({ icon, title, tag }: { icon: string; title: string; tag: string }) {
  return (
    <div className="game-panel-head">
      <div className="game-panel-title">{icon} {title}</div>
      <span>{tag}</span>
    </div>
  );
}

function DifficultyTabs<T extends string | number>({
  values,
  active,
  format,
  onSelect,
}: {
  values: T[];
  active: T;
  format: (value: T) => string;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="game-diff-row">
      {values.map((value) => (
        <button
          key={String(value)}
          className={value === active ? "game-diff-tab on" : "game-diff-tab"}
          type="button"
          onClick={() => onSelect(value)}
        >
          <strong>{format(value)}</strong>
        </button>
      ))}
    </div>
  );
}

function HudItem({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="game-hud-item">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
