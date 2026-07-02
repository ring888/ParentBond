import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Bell, Coins, Flame, ListChecks, MoonStar, Timer, Trophy, Users, Volume2 } from "lucide-react";
import type { ChildProfileSummary, CompanionFocusState, FocusStats, HomeworkTask, ParentChildDetailSummary, ParentProfileSummary, Subject } from "@parentbond/shared";
import { quickCards, subjectMeta, type ViewId } from "../../data/mock";
import type { ProfileSyncStatus, TaskSyncStatus } from "../../app/types";
import { fallbackFocusWeek, formatFocusDuration, formatFocusMinutes, formatTimer, formatTimerParts } from "../../app/formatters";
import { ProgressBar, SectionHeader, StatTile } from "../../components/ui";
import { formatWalletDate, walletStatusLabel } from "../wallet/wallet-formatters";

export function HomeView({
  completed,
  progress,
  remaining,
  total,
  nextTask,
  walletStats,
  totalFocusSeconds,
  companionFocus,
  setActiveView,
}: {
  completed: number;
  progress: number;
  remaining: number;
  total: number;
  nextTask: HomeworkTask | null;
  walletStats: ChildProfileSummary["stats"] | null;
  totalFocusSeconds: number;
  companionFocus: CompanionFocusState | null;
  setActiveView: (view: ViewId) => void;
}) {
  const resolvedQuickCards = quickCards.map((card) => {
    if (card.title !== "星光奖励") return card;
    const walletBalance = walletStats?.walletBalance ?? 0;
    const monthlyRewardAmount = walletStats?.monthlyRewardAmount ?? 0;
    const pendingRewardAmount = walletStats?.pendingRewardAmount ?? 0;
    const pendingRewardCount = walletStats?.pendingRewardCount ?? 0;
    return {
      ...card,
      description: `余额 ¥${formatMoneyNumber(walletBalance)}\n本月 +¥${formatMoneyNumber(monthlyRewardAmount)}`,
      tag: pendingRewardCount > 0 ? `+¥${formatMoneyNumber(pendingRewardAmount)} 待确认` : "已同步",
    };
  });
  const focusTodayLabel = formatFocusMinutes(totalFocusSeconds);
  const parentOnline = Boolean(companionFocus?.parentOnline);
  const activeCompanionSession = companionFocus?.activeSession ?? null;
  const taskSyncLabel = total > 0 ? `${completed}/${total}` : "待创建";
  const companionTitle = total > 0 && completed === total ? "爸爸看到你今天已经收尾啦" : "爸爸正在守护你的今日计划";
  const companionText =
    total > 0
      ? nextTask
        ? `下一项「${nextTask.title}」 · 完成后会实时同步给爸爸`
        : "任务已经整理好，完成后会实时同步给爸爸"
      : "先写下今天的任务，爸爸端会同步看到你的进度";

  return (
    <section className="view-stack">
      <button className="hero-card star-card" type="button" onClick={() => setActiveView("tasks")}>
        <span className="label-dot">今日作业</span>
        <h2>
          {total > 0 ? <>还有 <strong>{remaining} 项</strong> 等你完成</> : <>今天还没有<strong>任务</strong></>}
        </h2>
        <div className="progress-row">
          <span>完成进度</span>
          <strong>{completed} / {total}</strong>
        </div>
        <ProgressBar value={progress} />
        <div className="chip-row">
          <span className="meta-chip lavender">
            {nextTask ? `${subjectMeta[nextTask.subject].label} · ${nextTask.estimatedMinutes}min` : "等待输入任务"}
          </span>
          <span className={parentOnline ? "meta-chip gold" : "meta-chip lavender"}>{parentOnline ? "爸爸在线" : "爸爸离线"}</span>
          <span className="meta-chip green">今日 {focusTodayLabel}</span>
        </div>
      </button>

      <SectionHeader title="快捷入口" />
      <div className="quick-grid">
        {resolvedQuickCards.map(({ view, className, title, description, tag, icon }) => (
          <button
            key={title}
            className={`quick-card ${className}`}
            type="button"
            onClick={() => setActiveView(view)}
          >
            <span className="card-shine" />
            <span className="quick-tag">{tag}</span>
            <span className="quick-icon" aria-hidden="true">{icon}</span>
            <strong>{title}</strong>
            <span>{description}</span>
          </button>
        ))}
      </div>

      <SectionHeader title="爸爸在做什么" action="一起专注" />
      <button className="companion-card" type="button" onClick={() => setActiveView("focus")}>
        <span className="companion-glow" aria-hidden="true" />
        <div className="companion-icon" aria-hidden="true">
          👨
        </div>
        <div className="companion-copy">
          <strong>{companionTitle}</strong>
          <span>{companionText}</span>
          <div className="companion-mini-row" aria-hidden="true">
            <em>任务 {taskSyncLabel}</em>
            <em>专注 {focusTodayLabel}</em>
          </div>
        </div>
        <span className="live-pill">
          <span />
          {parentOnline ? (activeCompanionSession?.parentJoined ? "陪伴中" : "在线") : "待同步"}
        </span>
      </button>
    </section>
  );
}

export function ParentHomeView({
  profile,
  profileSyncStatus,
  taskSyncStatus,
  focusStats,
  tasks,
  completed,
  progress,
  nextTask,
  companionFocus,
  fallback,
  setActiveView,
}: {
  profile: ParentProfileSummary | null;
  profileSyncStatus: ProfileSyncStatus;
  taskSyncStatus: TaskSyncStatus;
  focusStats: FocusStats;
  tasks: HomeworkTask[];
  completed: number;
  progress: number;
  nextTask: HomeworkTask | null;
  companionFocus: CompanionFocusState | null;
  fallback: {
    displayName: string;
    familyName: string;
    childName: string;
    childGrade: string;
    childAvatar: string;
  };
  setActiveView: (view: ViewId) => void;
}) {
  const now = new Date();
  const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const greeting = now.getHours() < 11 ? "早上好" : now.getHours() < 18 ? "下午好" : "晚上好";
  const dateLabel = `${weekDays[now.getDay()]} ${now.getMonth() + 1}/${now.getDate()}`;
  const child = profile?.child ?? {
    userId: "pending-child",
    name: fallback.childName,
    grade: fallback.childGrade,
    avatar: fallback.childAvatar,
    joined: false,
  };
  const stats = profile?.stats ?? {
    memberCount: 2,
    childRecordDays: 0,
    monthlyRewards: 0,
    monthlyDeductions: 0,
    walletBalance: 0,
    monthlyRewardAmount: 0,
    monthlyDeductAmount: 0,
    pendingRewardAmount: 0,
    pendingRewardCount: 0,
    companionStreakDays: 0,
    childFocusSecondsToday: 0,
    completedTasksToday: completed,
    totalTasksToday: tasks.length,
  };
  const focusWeek = profile?.focusWeek ?? fallbackFocusWeek();
  const taskTotal = tasks.length || stats.totalTasksToday;
  const taskDone = tasks.length ? completed : stats.completedTasksToday;
  const taskProgress = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : progress;
  const openTask = tasks.find((task) => !task.completedAt) ?? (taskTotal > 0 ? nextTask : null);
  const activeCompanionSession = companionFocus?.activeSession ?? null;
  const childJoined = Boolean(child.joined);
  const hasLiveCompanion = Boolean(childJoined && activeCompanionSession && activeCompanionSession.status === "active");
  const childOnline = Boolean(childJoined && companionFocus?.childOnline);
  const childFocusing = Boolean(hasLiveCompanion && activeCompanionSession?.childRunning);
  const companionLiveLabel = hasLiveCompanion
    ? activeCompanionSession?.childRunning
      ? "共同专注中"
      : "等待继续"
    : "等待开始";
  const companionTaskLabel = hasLiveCompanion
    ? activeCompanionSession?.mode === "task" && activeCompanionSession.taskTitle
      ? `任务专注 · ${activeCompanionSession.taskTitle}`
      : "自由番茄 · 共同专注"
    : openTask
      ? `${subjectMeta[openTask.subject].label} · ${openTask.title}`
      : "暂无进行中的任务";
  const companionTimeLabel = hasLiveCompanion ? formatTimer(activeCompanionSession?.secondsLeft ?? 0) : formatFocusMinutes(stats.childFocusSecondsToday);
  const maxFocusSeconds = Math.max(1, ...focusWeek.map((day) => day.totalSeconds));
  const totalFocusSecondsToday = Math.max(stats.childFocusSecondsToday, focusStats.totalSecondsToday);
  const totalFocusMinutes = Math.round(totalFocusSecondsToday / 60);
  const focusTargetMinutes = Math.max(60, totalFocusMinutes, openTask?.estimatedMinutes ?? 25);
  const focusProgress = Math.min(100, Math.round((totalFocusMinutes / focusTargetMinutes) * 100));
  const taskRingOffset = 226 * (1 - taskProgress / 100);
  const focusRingOffset = 176 * (1 - focusProgress / 100);
  const weekTotalSeconds = focusWeek.reduce((sum, day) => sum + day.totalSeconds, 0);
  const weekTotalLabel = formatFocusDuration(weekTotalSeconds);
  const focusWeekStart = focusWeek[0]?.date ? new Date(`${focusWeek[0].date}T00:00:00`) : null;
  const focusWeekEnd = focusWeek[focusWeek.length - 1]?.date
    ? new Date(`${focusWeek[focusWeek.length - 1].date}T00:00:00`)
    : null;
  const weekRange =
    focusWeekStart && focusWeekEnd
      ? `${focusWeekStart.getMonth() + 1}月${focusWeekStart.getDate()}–${focusWeekEnd.getDate()}日`
      : "近 7 天";
  const taskStateLabel =
    !childJoined
      ? "待加入家庭"
      : childFocusing
      ? activeCompanionSession?.mode === "task" && openTask
        ? `专注中 · ${subjectMeta[openTask.subject].label}`
        : "专注中"
      : taskTotal === 0
      ? "等待清单"
      : taskDone === taskTotal
        ? "全部完成"
        : openTask
          ? taskDone > 0
            ? `进行中 · ${subjectMeta[openTask.subject].label}`
            : `待开始 · ${subjectMeta[openTask.subject].label}`
          : "今日同步";
  const stateClass = !childJoined
    ? "csp-offline"
    : childFocusing
    ? "csp-focus"
    : taskTotal === 0
      ? "csp-offline"
      : taskDone === taskTotal
        ? "csp-study"
        : taskDone > 0
          ? "csp-focus"
          : "csp-wait";
  const mood = !childJoined
    ? { icon: "···", label: "待加入", tone: "muted" }
    : childFocusing
    ? { icon: "⏱️", label: "专注中", tone: "purple" }
    : taskTotal > 0 && taskDone === taskTotal
      ? { icon: "😊", label: "很棒", tone: "green" }
      : taskDone > 0
        ? { icon: "🙂", label: "推进中", tone: "gold" }
        : totalFocusSecondsToday > 0
          ? { icon: "🧘", label: "已专注", tone: "purple" }
          : taskTotal > 0
            ? { icon: "⏳", label: "待开始", tone: "muted" }
            : childOnline
              ? { icon: "🌙", label: "待计划", tone: "muted" }
              : { icon: "···", label: "未上线", tone: "muted" };
  const childLiveLabel = !childJoined ? "待加入" : childFocusing ? "正在专注" : childOnline ? "当前在线" : "等待上线";
  const footerHint =
    !childJoined
      ? `等待${child.name}加入家庭后，这里会显示实时任务和专注状态。`
      : taskTotal > 0 && taskDone === taskTotal
      ? `今天很认真，${child.name}已经完成了全部任务。`
      : openTask
        ? `${child.name}今天已经完成 ${taskDone} 项，下一项是「${openTask.title}」。`
        : `${child.name}今天还没有创建任务清单。`;
  const displayedTasks = tasks.length ? tasks.slice(0, 4) : nextTask ? [nextTask] : [];
  const rewardPendingBadge = stats.pendingRewardCount > 0 ? String(stats.pendingRewardCount) : undefined;
  const taskProgressClass = taskTotal > 0 && taskDone === taskTotal ? "done" : "partial";
  const latestCompletedTask = tasks.find((task) => task.completedAt);

  return (
    <section className="parent-template-home">
      <div className="parent-page-header">
        <div>
          <div className="parent-greeting">
            <span>{greeting}</span>
            <span className="parent-date-pill">{dateLabel}</span>
          </div>
          <div className="parent-title-name">
            {profile?.displayName ?? fallback.displayName} <em>·</em>
          </div>
          <div className="parent-subtitle">
            观察者视角 · 今天陪伴第 <span>{Math.max(1, stats.companionStreakDays || stats.childRecordDays || 1)}</span> 天
          </div>
        </div>
        <div className="parent-header-actions">
          <button className="parent-header-avatar" type="button" onClick={() => setActiveView("profile")}>
            👨
          </button>
          <button className="parent-notification-button" type="button" onClick={() => setActiveView("memory")}>
            <span aria-hidden="true">🔔</span>
            {profileSyncStatus === "offline" ? <i /> : null}
          </button>
        </div>
      </div>

      <button className="child-hero-card" type="button" onClick={() => setActiveView("tasks")}>
        <span className="ch-glow" />
        <div className="ch-top">
          <div className="ch-av-wrap">
            <div className="ch-av">{child.avatar}</div>
            <div className={childOnline ? "ch-status-dot online" : "ch-status-dot offline"} />
          </div>
          <div className="ch-meta">
            <div className="ch-name">{child.name}</div>
            <div className="ch-grade">{child.grade} · <span>{childLiveLabel}</span></div>
            <div className={`ch-state-pill ${stateClass}`}>
              <div className="pulse-dot" />
              {taskStateLabel}
            </div>
          </div>
          <div className={`ch-evaluation ${mood.tone}`}>
            <div>今日评价</div>
            <strong>{mood.icon}</strong>
            <span>{mood.label}</span>
          </div>
        </div>

        <div className="ch-body">
          <div className="ring-mini-wrap">
            <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
              <defs>
                <linearGradient id="parent-task-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3DD68C" />
                  <stop offset="100%" stopColor="#0A5C38" />
                </linearGradient>
              </defs>
              <circle fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7" cx="44" cy="44" r="36" />
              <circle
                fill="none"
                stroke="url(#parent-task-ring)"
                strokeWidth="7"
                strokeLinecap="round"
                cx="44"
                cy="44"
                r="36"
                strokeDasharray="226"
                strokeDashoffset={taskRingOffset}
              />
            </svg>
            <div className="ring-mini-inner">
              <div className="ring-mini-val">{taskDone}/{taskTotal || 0}</div>
              <div className="ring-mini-lbl">任务</div>
            </div>
          </div>

          <div className="ch-stats">
            <ParentStatBar icon="⏱" label="专注时长" value={`${totalFocusMinutes}m`} percent={focusProgress} tone="purple" />
            <ParentStatBar icon="🎯" label="游戏训练" value={stats.companionStreakDays > 0 ? "✓ 完成" : "待开始"} percent={stats.companionStreakDays > 0 ? 100 : 12} tone="gold" />
            <ParentStatBar icon="📝" label="作业进度" value={`${taskDone}/${taskTotal || 0}`} percent={taskProgress} tone="coral" />
          </div>
        </div>

        <div className="ch-footer">
          <div className="ch-footer-icon">💬</div>
          <div className="ch-footer-txt">{footerHint}</div>
          <div className="ch-footer-arr">›</div>
        </div>
      </button>

      <div className="parent-sec-row compact"><div className="parent-sec-title"><span className="parent-sec-dot" />快捷操作</div></div>
      <div className="parent-quick-grid">
        <button className="parent-qa" type="button" onClick={() => setActiveView("wallet")}>
          <span className="parent-qa-icon gold">💰{rewardPendingBadge ? <i>{rewardPendingBadge}</i> : null}</span>
          <span>发奖励</span>
        </button>
        <button className="parent-qa" type="button" onClick={() => setActiveView("focus")}>
          <span className="parent-qa-icon purple">⏱</span>
          <span>加入陪伴</span>
        </button>
        <button className="parent-qa" type="button" onClick={() => setActiveView("memory")}>
          <span className="parent-qa-icon blue">📓</span>
          <span>写记录</span>
        </button>
        <button className="parent-qa" type="button" onClick={() => setActiveView("memory")}>
          <span className="parent-qa-icon green">💬</span>
          <span>心情分享</span>
        </button>
      </div>

      <div className="parent-sec-row">
        <div className="parent-sec-title"><span className="parent-sec-dot" />今日作业</div>
        <button className="parent-sec-action" type="button" onClick={() => setActiveView("tasks")}>详情</button>
      </div>
      <div className="task-snapshot-card">
        <div className="ts-header">
          <div className="ts-title">{child.name}的任务清单</div>
          <div className={`ts-prog ${taskProgressClass}`}>{taskDone} / {taskTotal || 0} 完成</div>
        </div>
        <div className="ts-track"><div className="ts-fill" style={{ width: `${taskProgress}%` }} /></div>
        {displayedTasks.map((task) => {
          const isDone = Boolean(task.completedAt);
          const isActive = !isDone && openTask?.id === task.id;
          return (
            <button className="task-row-snapshot" type="button" key={task.id} onClick={() => setActiveView("tasks")}>
              <div className={isDone ? "tr-check done" : isActive ? "tr-check active" : "tr-check pending"}>
                {isDone ? "✓" : null}
              </div>
              <span className={`tr-subj ${subjectMeta[task.subject].className}`}>{subjectMeta[task.subject].label}</span>
              <div className={isDone ? "tr-name done" : "tr-name"}>{task.title}</div>
              <div className={isActive ? "tr-dur active" : "tr-dur"}>{isActive ? "进行中…" : `${task.estimatedMinutes}m`}</div>
            </button>
          );
        })}
      </div>

      <div className="parent-sec-row">
        <div className="parent-sec-title"><span className="parent-sec-dot" />专注动态</div>
        <button className="parent-sec-action" type="button" onClick={() => setActiveView("focus")}>加入陪伴</button>
      </div>
      <button className="focus-live-card" type="button" onClick={() => setActiveView("focus")}>
        <span className="fl-glow" />
        <div className="fl-header">
          <div className="fl-label">陪伴房间</div>
          <div className="fl-live-pill"><span className="pulse-dot" />{companionLiveLabel}</div>
        </div>
        <div className="fl-body">
          <div className="fl-ring-wrap">
            <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
              <defs>
                <linearGradient id="parent-focus-live-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#4C1D95" />
                </linearGradient>
              </defs>
              <circle fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="6" cx="34" cy="34" r="28" />
              <circle
                fill="none"
                stroke="url(#parent-focus-live-ring)"
                strokeWidth="6"
                strokeLinecap="round"
                cx="34"
                cy="34"
                r="28"
                strokeDasharray="176"
                strokeDashoffset={focusRingOffset}
              />
            </svg>
            <div className="fl-ring-inner">
            <div className="fl-ring-time">{formatFocusMinutes(totalFocusSecondsToday)}</div>
              <div className="fl-ring-lbl">今日</div>
            </div>
          </div>
          <div className="fl-info">
            <div className="fl-task">{companionTaskLabel}</div>
            <div className="fl-sub">{hasLiveCompanion ? `当前剩余 ${companionTimeLabel}` : `今日 ${focusRoundsLabel(totalFocusSecondsToday)} · 共 ${formatFocusMinutes(totalFocusSecondsToday)}`}</div>
            <div className="fl-tomatoes">
              {[0, 1, 2, 3].map((index) => (
                <span key={index} className={index < Math.min(4, Math.floor(totalFocusMinutes / 25)) ? "done" : index === Math.floor(totalFocusMinutes / 25) ? "cur" : ""} />
              ))}
              <em>今日进度</em>
            </div>
          </div>
        </div>
        <div className="fl-sync">
          <span>💡 加入后你只负责安静在场，孩子端会看到爸爸正在陪伴。</span>
          <strong>加入陪伴 →</strong>
        </div>
      </button>

      <div className="parent-sec-row">
        <div className="parent-sec-title"><span className="parent-sec-dot" />零花钱</div>
        <button className="parent-sec-action" type="button" onClick={() => setActiveView("wallet")}>账单详情</button>
      </div>
      <button className="wallet-strip-card" type="button" onClick={() => setActiveView("wallet")}>
        <span className="ws-glow" />
        <div className="ws-top">
          <div>
            <div className="ws-label">{child.name}零花钱</div>
            <div className="ws-balance"><sup>¥</sup>{formatMoneyNumber(stats.walletBalance)}</div>
          </div>
          <div className="ws-month">
            <span>本月</span>
            <strong>+¥{formatMoneyNumber(stats.monthlyRewardAmount)}</strong>
            <em>-¥{formatMoneyNumber(stats.monthlyDeductAmount)}</em>
          </div>
        </div>
        <div className="ws-bottom">
          <div className="ws-stat">
            <div className="ws-stat-v green">{stats.monthlyRewards}次</div>
            <div className="ws-stat-l">获奖次数</div>
          </div>
          <div className="ws-stat">
            <div className="ws-stat-v coral">{stats.monthlyDeductions}次</div>
            <div className="ws-stat-l">扣款次数</div>
          </div>
          <div className="ws-pending">
            <span />
            <div>待确认</div>
            <strong>+¥{formatMoneyNumber(stats.pendingRewardAmount)}</strong>
          </div>
        </div>
      </button>

      <div className="parent-sec-row">
        <div className="parent-sec-title"><span className="parent-sec-dot" />本周专注</div>
        <button className="parent-sec-action" type="button" onClick={() => setActiveView("profile")}>月度报告</button>
      </div>
      <div className="week-chart-card">
        <div className="wc-head">
          <div className="wc-title">{child.name} · 专注时长（分钟）</div>
          <div className="wc-range">{weekRange}</div>
        </div>
        <div className="wc-bars">
          {focusWeek.map((day) => {
            const minutes = Math.round(day.totalSeconds / 60);
            const percent = Math.max(4, Math.round((day.totalSeconds / maxFocusSeconds) * 100));
            return (
              <div className="wc-col" key={day.date}>
                <div className="wc-bar-wrap">
                  <div className={day.label === "今天" ? "wc-bar today" : "wc-bar"} style={{ height: `${day.totalSeconds > 0 ? percent : 4}%` }}>
                    <span>{minutes}m</span>
                  </div>
                </div>
                <div className="wc-lbl">{day.label}</div>
              </div>
            );
          })}
        </div>
        <div className="wc-footer">
          <div>本周合计 <strong>{weekTotalLabel}</strong></div>
          <span>{stats.companionStreakDays > 0 ? `连续 ${stats.companionStreakDays} 天` : "等待形成节律"}</span>
        </div>
      </div>

      <div className="parent-sec-row"><div className="parent-sec-title"><span className="parent-sec-dot" />专注洞察</div></div>
      <InsightCard
        icon="📈"
        title={stats.companionStreakDays > 0 ? `连续 ${stats.companionStreakDays} 天有专注记录` : "今晚适合建立第一次节律"}
        text={stats.companionStreakDays > 0 ? `${child.name}正在形成稳定学习节律，今晚可以表扬具体努力。` : "先从一个短任务开始，让孩子感到可完成，而不是被监督。"}
        tone="green"
      />
      <InsightCard
        icon="🎯"
        title={taskTotal > 0 ? `今日任务完成 ${taskProgress}%` : "等待孩子创建今日清单"}
        text={taskTotal > 0 ? `还有 ${Math.max(0, taskTotal - taskDone)} 项任务需要看一眼，建议只提醒下一件事。` : "孩子创建清单后，家长端会自动看到任务和专注进度。"}
        tone="purple"
      />

      <div className="parent-sec-row">
        <div className="parent-sec-title"><span className="parent-sec-dot" />近期动态</div>
        <button className="parent-sec-action" type="button" onClick={() => setActiveView("profile")}>全部</button>
      </div>
      <div className="parent-feed-list">
        {latestCompletedTask ? (
          <FeedItem icon="✓" title={<><strong>{child.name}</strong> 完成了「{latestCompletedTask.title}」</>} meta="任务" value="✓" tone="green" />
        ) : null}
        <FeedItem icon="🍅" title={<><strong>{child.name}</strong> 今日专注 {formatFocusMinutes(totalFocusSecondsToday)}</>} meta="专注" value={`+${Math.floor(totalFocusMinutes / 25)}🍅`} tone="purple" />
        {stats.pendingRewardCount > 0 ? (
          <FeedItem icon="⭐" title={<><strong>家人</strong> 给{child.name}发起奖励申请</>} meta="零花钱 · 待确认" value={`+¥${formatMoneyNumber(stats.pendingRewardAmount)}`} sub="待确认" tone="gold" />
        ) : null}
        <FeedItem icon="📓" title={<><strong>你</strong> 可以写下本周成长记录</>} meta="时光机" value="📝" tone="blue" />
      </div>
    </section>
  );
}

export function ParentChildDetailView({
  detail,
  profile,
  focusStats,
  tasks,
  completed,
  companionFocus,
  fallback,
  onBack,
  onEdit,
  onReward,
  onFocus,
  onHistory,
}: {
  detail: ParentChildDetailSummary | null;
  profile: ParentProfileSummary | null;
  focusStats: FocusStats;
  tasks: HomeworkTask[];
  completed: number;
  companionFocus: CompanionFocusState | null;
  fallback: {
    childName: string;
    childGrade: string;
    childAvatar: string;
  };
  onBack: () => void;
  onEdit: () => void;
  onReward: () => void;
  onFocus: () => void;
  onHistory: () => void;
}) {
  const child = detail?.child ?? profile?.child ?? {
    userId: "pending-child",
    name: fallback.childName,
    grade: fallback.childGrade,
    avatar: fallback.childAvatar,
    joined: false,
  };
  const stats = detail?.stats ?? {
    completedTasksToday: completed,
    totalTasksToday: tasks.length,
    totalFocusSecondsToday: profile?.stats.childFocusSecondsToday ?? 0,
    walletBalance: profile?.stats.walletBalance ?? 0,
    pendingRewardAmount: profile?.stats.pendingRewardAmount ?? 0,
    pendingRewardCount: profile?.stats.pendingRewardCount ?? 0,
    streakDays: profile?.stats.companionStreakDays ?? 0,
    monthlyRewardAmount: profile?.stats.monthlyRewardAmount ?? 0,
    monthlyDeductAmount: profile?.stats.monthlyDeductAmount ?? 0,
    gameSessionsToday: 0,
  };
  const focusWeek = detail?.focusWeek ?? profile?.focusWeek ?? fallbackFocusWeek();
  const taskTotal = tasks.length || stats.totalTasksToday;
  const taskDone = tasks.length ? completed : stats.completedTasksToday;
  const taskPercent = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
  const childJoined = Boolean(child.joined);
  const isOnline = Boolean(childJoined && companionFocus?.childOnline);
  const activeSession = childJoined && companionFocus?.activeSession?.status === "active" ? companionFocus.activeSession : null;
  const isFocusing = Boolean(activeSession?.childRunning);
  const activeTaskTitle =
    activeSession?.taskTitle ||
    (activeSession?.taskId ? tasks.find((task) => task.id === activeSession.taskId)?.title : "") ||
    "日常番茄";
  const activeTomatoIndex = Math.max(1, focusStats.completedSessionsToday + 1);
  const today = new Date();
  const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const todayLabel = `今天 ${today.getMonth() + 1}月${today.getDate()}日`;
  const fallbackSubjectStats = (["math", "chinese", "english", "reading"] as Subject[]).map((subject) => {
    const subjectTasks = tasks.filter((task) => task.subject === subject);
    const subjectDone = subjectTasks.filter((task) => task.completedAt).length;
    return {
      subject,
      label: subjectMeta[subject].label,
      icon: subject === "math" ? "📐" : subject === "chinese" ? "✍️" : subject === "english" ? "🌍" : "📚",
      completed: subjectDone,
      total: subjectTasks.length,
      percent: subjectTasks.length ? Math.round((subjectDone / subjectTasks.length) * 100) : 0,
    };
  });
  const subjectStats = detail?.subjectStats?.length ? detail.subjectStats : fallbackSubjectStats;
  const maxFocusSeconds = Math.max(1, ...focusWeek.map((day) => day.totalSeconds));
  const weekTotalSeconds = focusWeek.reduce((sum, day) => sum + day.totalSeconds, 0);
  const averageSeconds = Math.round(weekTotalSeconds / Math.max(1, focusWeek.length));
  const longestSeconds = Math.max(0, ...focusWeek.map((day) => day.totalSeconds));
  const goalRate = Math.round((focusWeek.filter((day) => day.totalSeconds >= 25 * 60).length / Math.max(1, focusWeek.length)) * 100);
  const pendingWallet = detail?.walletHistory.find((entry) => entry.type === "reward" && entry.status === "pending") ?? null;
  const liveTimelineItem: ParentChildDetailSummary["timeline"][number] | null = activeSession
    ? {
        id: `live-${activeSession.id}`,
        kind: "focus",
        time: "现在",
        occurredAt: companionFocus?.serverNow ?? new Date().toISOString(),
        title: `开始第 ${activeTomatoIndex} 个番茄钟 · ${activeTaskTitle}`,
        detail: `${isFocusing ? "进行中" : "暂停中"} · ${formatTimer(activeSession.secondsLeft)}剩余`,
        icon: "⏱",
        tone: "purple",
        value: null,
      }
    : null;
  const timelineItems = liveTimelineItem
    ? [liveTimelineItem, ...(detail?.timeline ?? [])].slice(0, 8)
    : detail?.timeline ?? [];

  return (
    <section className="parent-child-detail-page">
      <div className="pcd-topbar">
        <button className="pcd-back" type="button" onClick={onBack} aria-label="返回家长首页">←</button>
        <div className="pcd-title">孩子详情</div>
        <button className="pcd-edit" type="button" onClick={onEdit}>编辑</button>
      </div>

      <div className="pcd-hero">
        <div className="pcd-hero-glow" />
        <div className="pcd-hero-row">
          <div className="pcd-hero-avatar">
            {child.avatar}
            <span className={isOnline ? "pcd-status-dot online" : "pcd-status-dot"} />
          </div>
          <div className="pcd-hero-meta">
            <div className="pcd-hero-name">{child.name}</div>
            <div className="pcd-hero-sub">{child.grade} · 10岁 · {childJoined ? (isOnline ? "刚刚活跃" : "等待上线") : "待加入家庭"}</div>
            <div className="pcd-tags">
              <span className={isOnline ? "pcd-pill green" : "pcd-pill muted"}><i />{childJoined ? (isOnline ? "在线" : "离线") : "待加入"}</span>
              <span className={isFocusing ? "pcd-pill purple" : "pcd-pill muted"}>{isFocusing ? "专注中" : "未专注"}</span>
              <span className="pcd-pill gold">连续{Math.max(0, stats.streakDays)}天</span>
            </div>
          </div>
        </div>
        <div className="pcd-stats-row">
          <div className="pcd-stat">
            <div className="pcd-stat-value green">{taskDone}/{taskTotal || 0}</div>
            <div className="pcd-stat-label">今日任务</div>
            <div className="pcd-stat-detail green">{taskPercent}%</div>
          </div>
          <div className="pcd-stat">
            <div className="pcd-stat-value purple">{formatFocusDuration(stats.totalFocusSecondsToday)}</div>
            <div className="pcd-stat-label">今日专注</div>
            <div className="pcd-stat-detail purple">{focusRoundsLabel(stats.totalFocusSecondsToday)}</div>
          </div>
          <div className="pcd-stat">
            <div className="pcd-stat-value gold">¥{formatMoneyNumber(stats.walletBalance)}</div>
            <div className="pcd-stat-label">零花钱</div>
            <div className="pcd-stat-detail green">+¥{formatMoneyNumber(stats.pendingRewardAmount)}待确认</div>
          </div>
        </div>
      </div>

      <div className="pcd-sec-row">
        <div className="pcd-sec-title"><span />今日动态</div>
        <button type="button" onClick={onHistory}>历史</button>
      </div>
      <div className="pcd-timeline-card">
        <div className="pcd-timeline-head">
          <div>{todayLabel}</div>
          <span>{weekDays[today.getDay()]}</span>
        </div>
        {timelineItems.length ? (
          timelineItems.map((item) => (
            <div className="pcd-timeline-item" key={item.id}>
              <div className={`pcd-timeline-dot ${item.tone}`}>{item.icon}</div>
              <div className="pcd-timeline-body">
                <div className="pcd-timeline-time">{item.time}</div>
                <div className="pcd-timeline-event">{item.title}</div>
                <div className={`pcd-timeline-badge ${item.tone}`}>{item.detail}</div>
              </div>
              {item.value ? <div className={`pcd-timeline-value ${item.tone}`}>{item.value}</div> : null}
            </div>
          ))
        ) : (
          <div className="pcd-empty-state">今天还没有同步到动态，等孩子完成任务或专注后会自动出现在这里。</div>
        )}
      </div>

      <div className="pcd-sec-row">
        <div className="pcd-sec-title"><span />各科完成率</div>
        <button type="button" onClick={onHistory}>月度</button>
      </div>
      <div className="pcd-subject-grid">
        {subjectStats.map((item) => (
          <div className="pcd-subject-item" key={item.subject}>
            <div className="pcd-subject-label">
              <span>{item.icon} {item.label}</span>
              <strong>{item.percent}%</strong>
            </div>
            <div className="pcd-subject-track">
              <div className={`pcd-subject-fill ${item.subject}`} style={{ width: `${item.percent}%` }} />
            </div>
            <div className="pcd-subject-sub">本月 {item.completed}/{item.total} 完成</div>
          </div>
        ))}
      </div>

      <div className="pcd-sec-row">
        <div className="pcd-sec-title"><span />专注趋势</div>
        <button type="button" onClick={onFocus}>30天</button>
      </div>
      <div className="pcd-trend-card">
        <div className="pcd-trend-head">
          <div>近7天 · 专注时长（分钟）</div>
          <span><i />专注 <i className="today" />今天</span>
        </div>
        <div className="pcd-sparkline">
          {focusWeek.map((day) => {
            const minutes = Math.round(day.totalSeconds / 60);
            const height = day.totalSeconds > 0 ? Math.max(8, Math.round((day.totalSeconds / maxFocusSeconds) * 100)) : 5;
            return (
              <div className="pcd-spark-col" key={day.date}>
                <div className={day.label === "今天" ? "pcd-spark-bar today" : "pcd-spark-bar"} style={{ height: `${height}%` }} />
                <span>{day.label}</span>
                <em>{minutes}m</em>
              </div>
            );
          })}
        </div>
        <div className="pcd-trend-footer">
          <div>日均 <b>{formatFocusDuration(averageSeconds)}</b></div>
          <div>最长连续 <b>{formatFocusDuration(longestSeconds)}</b></div>
          <div>目标达成率 <b>{goalRate}%</b></div>
        </div>
      </div>

      <div className="pcd-sec-row">
        <div className="pcd-sec-title"><span />近期账单</div>
        <button type="button" onClick={onReward}>发奖励</button>
      </div>
      <div className="pcd-history-card">
        {detail?.walletHistory.length ? (
          detail.walletHistory.slice(0, 4).map((entry) => {
            const isReward = entry.type === "reward";
            return (
              <button className="pcd-history-row" type="button" key={entry.id} onClick={onReward}>
                <div className={isReward ? "pcd-history-icon green" : "pcd-history-icon coral"}>{isReward ? "⭐" : "⚠️"}</div>
                <div className="pcd-history-body">
                  <div>{entry.reason}</div>
                  <span>{formatWalletDate(entry.createdAt)} · {entry.initiatorName}发起 · {walletStatusLabel(entry.status)}</span>
                </div>
                <strong className={isReward ? "green" : "coral"}>{isReward ? "+" : "-"}¥{formatMoneyNumber(entry.amount)}</strong>
              </button>
            );
          })
        ) : (
          <div className="pcd-empty-state">近期还没有零钱账单。</div>
        )}
      </div>

      {pendingWallet ? (
        <div className="pcd-pending-card">
          <div className="pcd-pending-icon">⏳</div>
          <div className="pcd-pending-body">
            <div>{pendingWallet.initiatorName}发起 +¥{formatMoneyNumber(pendingWallet.amount)} 奖励 · 待孩子确认</div>
            <span>原因：{pendingWallet.reason}</span>
            <div className="pcd-pending-actions">
              <button type="button" onClick={onReward}>去处理账单</button>
              <button type="button" onClick={onHistory}>提醒孩子</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ParentStatBar({
  icon,
  label,
  value,
  percent,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  percent: number;
  tone: "purple" | "gold" | "coral";
}) {
  return (
    <div className={`ch-stat-row ${tone}`}>
      <div className="ch-stat-icon">{icon}</div>
      <div className="ch-stat-body">
        <div className="ch-stat-label">{label}</div>
        <div className="ch-stat-bar-wrap">
          <div className="ch-stat-bar" style={{ width: `${Math.min(100, Math.max(4, percent))}%` }} />
        </div>
      </div>
      <div className="ch-stat-val">{value}</div>
    </div>
  );
}

export function ParentCompanionFocusView({
  childName,
  childAvatar,
  companionFocus,
  totalFocusSeconds,
  tasks,
  onLeave,
  onGoTasks,
}: {
  childName: string;
  childAvatar: string;
  companionFocus: CompanionFocusState | null;
  totalFocusSeconds: number;
  tasks: HomeworkTask[];
  onLeave: () => void;
  onGoTasks: () => void;
}) {
  const activeSession = companionFocus?.activeSession ?? null;
  const hasSession = Boolean(activeSession && activeSession.status === "active");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [snapshotReceivedAtMs, setSnapshotReceivedAtMs] = useState(() => Date.now());

  useEffect(() => {
    const receivedAt = Date.now();
    setSnapshotReceivedAtMs(receivedAt);
    setNowMs(receivedAt);
  }, [activeSession?.id, activeSession?.secondsLeft, activeSession?.lastChildSeenAt, activeSession?.updatedAt, companionFocus?.updatedAt]);

  useEffect(() => {
    if (!activeSession?.childRunning) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeSession?.childRunning, activeSession?.id]);

  const rawSecondsLeft = activeSession?.secondsLeft ?? 0;
  const totalSeconds = Math.max(1, activeSession?.totalSeconds ?? 1);
  const endsAtMs = Date.parse(activeSession?.endsAt ?? "");
  const serverNowAtResponseMs = Date.parse(companionFocus?.serverNow ?? companionFocus?.updatedAt ?? activeSession?.updatedAt ?? "");
  const localMinusServerMs = Number.isFinite(serverNowAtResponseMs)
    ? snapshotReceivedAtMs - serverNowAtResponseMs
    : 0;
  const estimatedServerNowMs = nowMs - localMinusServerMs;
  const localElapsedSeconds = activeSession?.childRunning
    ? Math.max(0, Math.floor((nowMs - snapshotReceivedAtMs) / 1000))
    : 0;
  const displaySecondsLeft =
    activeSession?.childRunning && Number.isFinite(endsAtMs)
      ? Math.max(0, Math.ceil((endsAtMs - estimatedServerNowMs) / 1000))
      : Math.max(0, rawSecondsLeft - localElapsedSeconds);
  const countdownFinishedLocally = hasSession && Boolean(activeSession?.childRunning) && displaySecondsLeft <= 0;
  const progress = hasSession ? Math.min(100, Math.max(0, Math.round(((totalSeconds - displaySecondsLeft) / totalSeconds) * 100))) : 0;
  const ringOffset = 754 * (1 - progress / 100);
  const timerParts = formatTimerParts(displaySecondsLeft);
  const taskTitle =
    activeSession?.taskTitle ||
    (activeSession?.taskId ? tasks.find((task) => task.id === activeSession.taskId)?.title : "") ||
    (activeSession?.mode === "daily" ? "自由番茄" : "等待孩子开始任务");
  const statusText = hasSession
    ? countdownFinishedLocally
      ? "等待孩子确认"
      : activeSession?.childRunning
        ? "孩子专注中"
        : "孩子暂停中"
    : "等待孩子开始";
  const joinedText = hasSession && activeSession?.parentJoined ? "你已陪伴中" : "进入后自动陪伴";

  return (
    <section className="parent-companion-focus">
      <header className="pcf-header">
        <span>安静陪伴</span>
        <h2>正在陪伴 {childName} 专注</h2>
        <p>你只需要在场，系统会同步任务、倒计时和完成结果，不打扰孩子的节奏。</p>
      </header>

      <section className={hasSession ? "pcf-hero active" : "pcf-hero waiting"}>
        <div className="pcf-child-row">
          <span className="pcf-avatar">{childAvatar}</span>
          <div>
            <strong>{childName}</strong>
            <span>{statusText}</span>
          </div>
          <em>{joinedText}</em>
        </div>

        {hasSession ? (
          <>
            <div className="pcf-ring-wrap" style={{ "--dash": ringOffset } as CSSProperties}>
              <span className="pcf-ring-glow" />
              <svg viewBox="0 0 272 272" aria-hidden="true">
                <defs>
                  <linearGradient id="parent-companion-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f5c842" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
                <circle className="pcf-ring-bg" cx="136" cy="136" r="120" />
                <circle className="pcf-ring-fg" cx="136" cy="136" r="120" />
              </svg>
              <div>
                <span>{activeSession?.mode === "task" ? "任务专注" : "自由番茄"}</span>
                <strong>{timerParts.minutes}<i>:</i>{timerParts.seconds}</strong>
                <em>剩余时间</em>
              </div>
            </div>

            <div className="pcf-task-card">
              <span>{activeSession?.mode === "task" ? "当前任务" : "当前模式"}</span>
              <strong>{taskTitle}</strong>
              <p>{countdownFinishedLocally ? "本轮倒计时已结束，正在等待孩子确认任务是否完成。" : activeSession?.childRunning ? "保持安静陪伴，等这轮结束后孩子会确认是否完成。" : "孩子暂停了计时，你仍然处于陪伴房间。"}</p>
            </div>
          </>
        ) : (
          <div className="pcf-empty">
            <Timer size={38} />
            <strong>孩子还没有开始专注</strong>
            <span>等孩子从任务清单开始倒计时后，这里会自动显示当前任务和剩余时间。</span>
          </div>
        )}
      </section>

      <div className="pcf-actions">
        <button className="pcf-primary" type="button" disabled={!hasSession}>
          <span aria-hidden="true">●</span>
          安静陪伴中
        </button>
        <button className="pcf-secondary" type="button" onClick={onLeave}>
          退出陪伴
        </button>
      </div>

      <div className="pcf-summary-grid">
        <StatTile label="今日陪伴专注" value={formatFocusDuration(totalFocusSeconds)} />
        <StatTile label="本轮状态" value={hasSession ? (activeSession?.childRunning ? "进行中" : "暂停") : "等待"} />
        <StatTile label="结束后" value="等孩子确认" />
      </div>

      <button className="pcf-task-link" type="button" onClick={onGoTasks}>
        查看今天任务清单
      </button>
    </section>
  );
}

function InsightCard({
  icon,
  title,
  text,
  tone,
}: {
  icon: string;
  title: string;
  text: string;
  tone: "green" | "purple";
}) {
  return (
    <div className={`insight-card-parent ${tone}`}>
      <div className="ic-icon">{icon}</div>
      <div>
        <div className="ic-title">{title}</div>
        <div className="ic-sub">{text}</div>
      </div>
    </div>
  );
}

function FeedItem({
  icon,
  title,
  meta,
  value,
  sub,
  tone,
}: {
  icon: string;
  title: ReactNode;
  meta: string;
  value: string;
  sub?: string;
  tone: "green" | "purple" | "gold" | "blue";
}) {
  return (
    <div className={`feed-item-parent ${tone}`}>
      <div className="fi-av">{icon}</div>
      <div className="fi-body">
        <div className="fi-text">{title}</div>
        <div className="fi-meta"><span>{meta}</span></div>
      </div>
      <div className="fi-right">
        <div className="fi-val">{value}</div>
        {sub ? <div className="fi-val-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

function formatMoneyNumber(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function focusRoundsLabel(totalSeconds: number) {
  const rounds = Math.floor(totalSeconds / (25 * 60));
  return rounds > 0 ? `第 ${rounds} 个番茄` : "还没有完成番茄";
}
