import type { FocusStats } from "@parentbond/shared";
import type { ViewId } from "../data/mock";

export const TASK_FOCUS_STORAGE_KEY = "parentbond.task-focus.v1";
export const FOCUS_AUTO_FLUSH_SECONDS = 60;
export const PATTERN_HIT_RADIUS = 23;

export const moodOptions = [
  { mood: "😊", label: "开心" },
  { mood: "😌", label: "平静" },
  { mood: "💪", label: "有力量" },
  { mood: "😔", label: "有点难过" },
  { mood: "😤", label: "有点生气" },
  { mood: "✨", label: "想记录" },
] as const;

export const emptyFocusStats: FocusStats = {
  completedSessionsToday: 0,
  totalSecondsToday: 0,
  streakDays: 0,
};

export const childBottomNavigation = [
  { id: "home", label: "首页", icon: "🏠" },
  { id: "tasks", label: "任务", icon: "📋" },
  { id: "games", label: "游戏", icon: "🎯" },
  { id: "profile", label: "我的", icon: "🦊" },
] as const satisfies Array<{ id: ViewId; label: string; icon: string }>;

export const parentBottomNavigation = [
  { id: "home", label: "首页", icon: "🏠" },
  { id: "tasks", label: "孩子", icon: "👦" },
  { id: "memory", label: "时光机", icon: "📓" },
  { id: "profile", label: "我的", icon: "👨" },
] as const satisfies Array<{ id: ViewId; label: string; icon: string }>;

export const parentNavigation = [
  { id: "home", label: "观察" },
  { id: "tasks", label: "孩子详情" },
  { id: "focus", label: "专注" },
  { id: "memory", label: "记录" },
  { id: "profile", label: "我的" },
] as const satisfies Array<{ id: ViewId; label: string }>;

export const childAvatarOptions = [
  { avatar: "🦊", label: "小狐狸" },
  { avatar: "🐼", label: "熊猫" },
  { avatar: "🦁", label: "小狮子" },
  { avatar: "🐯", label: "小老虎" },
  { avatar: "🦋", label: "蝴蝶" },
  { avatar: "🐉", label: "小龙" },
  { avatar: "🦄", label: "独角兽" },
  { avatar: "🚀", label: "火箭" },
];
