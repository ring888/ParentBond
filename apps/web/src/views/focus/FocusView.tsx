import type { CSSProperties } from "react";
import { ListChecks, Square } from "lucide-react";
import type { CompanionFocusState, HomeworkTask } from "@parentbond/shared";
import { subjectMeta } from "../../data/mock";
import type { FocusMode } from "../../app/types";
import { formatFocusDuration, formatTimerParts } from "../../app/formatters";
import { StatTile } from "../../components/ui";

export function FocusView({
  secondsLeft,
  timerRunning,
  ringProgress,
  focusTask,
  focusMode,
  focusRoundSeconds,
  focusRounds,
  totalFocusSeconds,
  streakDays,
  sessionFinished,
  companionFocus,
  onSelectDailyFocus,
  onSelectTaskFocus,
  onToggleTimer,
  onEndFocus,
  onGoToTasks,
}: {
  secondsLeft: number;
  timerRunning: boolean;
  ringProgress: number;
  focusTask: HomeworkTask | null;
  focusMode: FocusMode;
  focusRoundSeconds: number;
  focusRounds: number;
  totalFocusSeconds: number;
  streakDays: number;
  sessionFinished: boolean;
  companionFocus: CompanionFocusState | null;
  onSelectDailyFocus: () => void;
  onSelectTaskFocus: () => void;
  onToggleTimer: () => void;
  onEndFocus: () => void;
  onGoToTasks: () => void;
}) {
  const taskReady = Boolean(focusTask && !focusTask.completedAt);
  const taskCompleted = Boolean(focusTask?.completedAt);
  const canRun = focusMode === "daily" || taskReady;
  const timerParts = formatTimerParts(secondsLeft);
  const focusSubject = focusTask ? subjectMeta[focusTask.subject] : null;
  const focusPhase = ringProgress >= 80 ? "sprint" : ringProgress >= 60 ? "accelerating" : "calm";
  const phasePalette = {
    calm: { start: "#c4b5fd", end: "#4c1d95", label: "专注时间" },
    accelerating: { start: "#ffe085", end: "#8a6800", label: "加速冲刺" },
    sprint: { start: "#ffa598", end: "#b91c1c", label: "最后冲刺！" },
  }[focusPhase];
  const parentOnline = Boolean(companionFocus?.parentOnline);
  const parentJoined = Boolean(companionFocus?.activeSession?.parentJoined);
  const companionStatusTitle = parentOnline
    ? parentJoined
      ? "爸爸正在共同专注"
      : "爸爸在线，状态已同步"
    : "爸爸暂时离线";
  const companionStatusText = parentOnline
    ? "共同专注只同步任务、倒计时和在线陪伴，不会打扰你。"
    : "你专注时系统会继续保存进度，爸爸回来后会看到。";
  const companionStatusPill = parentOnline ? (parentJoined ? "陪伴中" : "已同步") : "待查看";
  const focusStateText = sessionFinished
    ? "本轮结束"
    : timerRunning
      ? "专注中…"
      : "点击开始";

  const hasFocusProgress = secondsLeft < focusRoundSeconds;
  const canEnd = canRun && (timerRunning || hasFocusProgress);

  return (
    <section className="focus-page">
      <div className="focus-mode-switch" role="tablist" aria-label="专注模式">
        <button
          className={focusMode === "task" ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={focusMode === "task"}
          onClick={onSelectTaskFocus}
        >
          <span className="focus-mode-icon" aria-hidden="true">📋</span>
          任务专注
        </button>
        <button
          className={focusMode === "daily" ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={focusMode === "daily"}
          onClick={onSelectDailyFocus}
        >
          <span className="focus-mode-icon" aria-hidden="true">🍅</span>
          自由番茄
        </button>
      </div>

      <section className={`focus-hero phase-${focusPhase} ${timerRunning ? "is-running" : ""}`}>

        {focusMode === "task" && !focusTask ? (
          <div className="focus-empty-state">
            <ListChecks size={38} />
            <strong>先从任务清单选择一项</strong>
            <span>选定任务后，这里会按它的预计时长倒计时</span>
            <button className="primary-button purple" type="button" onClick={onGoToTasks}>
              去选择任务
            </button>
          </div>
        ) : (
          <>
            <div className="focus-ring-stage">
              <span className="focus-ring-ambient" />
              <div
                className="ring-wrap focus-ring-large"
                style={{ "--dash": 754 * (1 - ringProgress / 100) } as CSSProperties}
              >
                <span className="focus-ring-glow" />
                <svg viewBox="0 0 272 272" aria-hidden="true">
                  <defs>
                    <linearGradient id="focus-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={phasePalette.start} />
                      <stop offset="100%" stopColor={phasePalette.end} />
                    </linearGradient>
                    <filter id="focus-ring-blur">
                      <feGaussianBlur stdDeviation="3.5" />
                    </filter>
                  </defs>
                  <circle className="ring-tick-line" cx="136" cy="136" r="126" />
                  <circle className="ring-bg" cx="136" cy="136" r="120" />
                  <circle className="ring-inner-line" cx="136" cy="136" r="107" />
                  <circle className="ring-glow-track" cx="136" cy="136" r="120" />
                  <circle className="ring-fg" cx="136" cy="136" r="120" />
                </svg>
                <div>
                  <span className="focus-ring-mode">{phasePalette.label}</span>
                  <strong>
                    {timerParts.minutes}
                    <i className={timerRunning ? "focus-colon" : "focus-colon paused"}>:</i>
                    {timerParts.seconds}
                  </strong>
                  <span className="focus-ring-sub">{focusStateText}</span>
                  <em>{Math.round(ringProgress)}%</em>
                </div>
              </div>
            </div>

            {focusMode === "task" && (
              <div className="focus-task-card-below">
                <span className="focus-task-card-dot" />
                <span className="focus-task-card-label">{focusSubject?.label ?? "任务"}</span>
                <strong>{focusTask?.title ?? "— 从任务页开始，或在下方选择 —"}</strong>
                <span className="focus-task-card-duration">
                  本轮 {Math.ceil(focusRoundSeconds / 60)}m
                </span>
              </div>
            )}

            <div className="focus-tomato-row" aria-label={`今日番茄进度 ${focusRounds} / 4`}>
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={
                    index < focusRounds
                      ? "done"
                      : index === focusRounds && focusRounds < 4 && timerRunning
                        ? "current"
                        : ""
                  }
                />
              ))}
            </div>

            {!sessionFinished && !taskCompleted && (
              <div className="focus-main-action focus-actions">
                <button
                  className="primary-button purple full"
                  type="button"
                  onClick={onToggleTimer}
                  disabled={!canRun}
                >
                  <span className="focus-action-glyph" aria-hidden="true">{timerRunning ? "⏸" : "▶"}</span>
                  {timerRunning ? "暂停" : "开始专注"}
                </button>
                <button className="focus-secondary-action focus-end-action" type="button" onClick={onEndFocus} disabled={!canEnd}>
                  <Square size={15} strokeWidth={3} aria-hidden="true" />
                  结束
                </button>
              </div>
            )}

          </>
        )}
      </section>

      <div className="focus-stats">
        <StatTile label="今日番茄" value={String(focusRounds)} />
        <StatTile label="专注时长" value={formatFocusDuration(totalFocusSeconds)} />
        <StatTile label="连续天数" value={streakDays > 0 ? `${streakDays}🔥` : "0"} />
      </div>

      <section className="focus-dad-sync" aria-label="家长端同步状态">
        <span className="focus-dad-avatar" aria-hidden="true">👨</span>
        <div>
          <strong>{companionStatusTitle}</strong>
          <span>{companionStatusText}</span>
        </div>
        <span className={parentOnline ? "focus-dad-live" : "focus-dad-live muted"}><i />{companionStatusPill}</span>
      </section>
    </section>
  );
}

export function FocusCompletionOverlay({
  focusTask,
  focusMode,
  finishedEarly,
  focusRoundSeconds,
  onExtendTimer,
  onContinueTimer,
  onCompleteTask,
  onGoToTasks,
}: {
  focusTask: HomeworkTask | null;
  focusMode: FocusMode;
  finishedEarly: boolean;
  focusRoundSeconds: number;
  onExtendTimer: () => void;
  onContinueTimer: () => void;
  onCompleteTask: () => void;
  onGoToTasks: () => void;
}) {
  const taskReady = Boolean(focusTask && !focusTask.completedAt);
  const taskCompleted = Boolean(focusTask?.completedAt);
  const focusSubject = focusTask ? subjectMeta[focusTask.subject] : null;

  return (
    <div className={taskCompleted ? "focus-completion-overlay success" : "focus-completion-overlay"}>
      <span className="focus-completion-icon" aria-hidden="true">🎉</span>
      {taskCompleted ? (
        <>
          <strong className="focus-completion-title">任务已自动勾选</strong>
          <span className="focus-completion-sub">很棒，完成清单上的一项，就是给自己的一颗星。</span>
          <div className="focus-completion-actions">
            <button className="primary-button green full" type="button" onClick={onGoToTasks}>
              回到任务清单
            </button>
          </div>
        </>
      ) : focusMode === "task" && taskReady ? (
        <>
          <strong className="focus-completion-title">本轮结束</strong>
          <span className="focus-completion-sub">本轮专注结束<br />你刚才在做这项任务：</span>
          <div className="focus-completion-task-box">
            <strong>{focusTask?.title}</strong>
            <span>{focusSubject?.label ?? "任务"} · 本轮专注 {Math.ceil(focusRoundSeconds / 60)} 分钟</span>
          </div>
          <div className="focus-completion-actions">
            <button className="primary-button green" type="button" onClick={onCompleteTask}>
              <span aria-hidden="true">✅</span>
              已完成，结束任务
            </button>
            <button className="focus-overlay-purple" type="button" onClick={finishedEarly ? onContinueTimer : onExtendTimer}>
              <span aria-hidden="true">⏱</span>
              {finishedEarly ? "还没完，继续专注" : "还没完，再来一个番茄"}
            </button>
          </div>
        </>
      ) : (
        <>
          <strong className="focus-completion-title">本轮结束</strong>
          <span className="focus-completion-sub">这一轮专注结束<br />先喝口水，准备好再开下一轮。</span>
          <div className="focus-completion-actions">
            <button className="focus-overlay-purple" type="button" onClick={finishedEarly ? onContinueTimer : onExtendTimer}>
              {finishedEarly ? "⏱ 继续专注" : "⏱ 再来一个番茄"}
            </button>
            <button className="focus-overlay-ghost" type="button" onClick={onGoToTasks}>
              跳过确认，回到任务清单
            </button>
          </div>
        </>
      )}
    </div>
  );
}
