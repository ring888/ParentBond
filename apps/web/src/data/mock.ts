import type { Subject } from "@parentbond/shared";

export type ViewId = "home" | "tasks" | "focus" | "games" | "wallet" | "memory" | "profile";

export const navigation = [
  { id: "home", label: "首页" },
  { id: "tasks", label: "今日任务" },
  { id: "focus", label: "专注" },
  { id: "games", label: "小游戏" },
  { id: "wallet", label: "零花钱" },
  { id: "memory", label: "时光机" },
  { id: "profile", label: "我的" },
] satisfies Array<{ id: ViewId; label: string }>;

export const subjectMeta: Record<Subject, { label: string; className: string }> = {
  math: { label: "数学", className: "subject-math" },
  chinese: { label: "语文", className: "subject-chinese" },
  english: { label: "英语", className: "subject-english" },
  reading: { label: "阅读", className: "subject-reading" },
  other: { label: "其他", className: "subject-other" },
};

export const quickCards = [
  {
    view: "focus",
    className: "quick-focus",
    title: "共同专注",
    description: "爸爸在线\n18 分钟",
    tag: "进行中",
    icon: "⏱️",
  },
  {
    view: "games",
    className: "quick-game",
    title: "专注热身",
    description: "舒尔特方格\n最佳 24.3s",
    tag: "作业前",
    icon: "🎯",
  },
  {
    view: "wallet",
    className: "quick-wallet",
    title: "星光奖励",
    description: "本月已获得\n47.5 元",
    tag: "+20 待确认",
    icon: "💰",
  },
  {
    view: "memory",
    className: "quick-memory",
    title: "成长时光",
    description: "本周记录\n还差一句",
    tag: "今晚写",
    icon: "📓",
  },
] satisfies Array<{
  view: ViewId;
  className: string;
  title: string;
  description: string;
  tag: string;
  icon: string;
}>;

export const games = [
  {
    name: "舒尔特方格",
    metric: "视觉搜索",
    record: "24.3s",
    className: "game-blue",
    icon: "🔢",
  },
  {
    name: "颜色冲突",
    metric: "抗干扰",
    record: "92%",
    className: "game-purple",
    icon: "🎨",
  },
  {
    name: "N-back",
    metric: "工作记忆",
    record: "Level 2",
    className: "game-green",
    icon: "🧠",
  },
  {
    name: "反应挑战",
    metric: "反应抑制",
    record: "0.42s",
    className: "game-gold",
    icon: "⚡",
  },
];

export const walletEntries = [
  { id: "w1", type: "reward", reason: "主动完成数学纠错", amount: 20, status: "待确认" },
  { id: "w2", type: "reward", reason: "连续 3 天共同专注", amount: 15, status: "已入账" },
  { id: "w3", type: "promise", reason: "周末一起骑车约定", amount: 0, status: "待兑现" },
];

export const memories = [
  {
    week: "本周闪光",
    text: "今天小明自己先把数学难题圈出来，说想等爸爸专注结束后一起研究。",
    author: "爸爸",
    locked: false,
  },
  {
    week: "18 岁后见",
    text: "孩子已写下 12 条给未来自己的小纸条。",
    author: "小明",
    locked: true,
  },
];
