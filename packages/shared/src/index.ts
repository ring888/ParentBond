export type UserRole = "child" | "parent" | "elder";

export type Subject = "math" | "chinese" | "english" | "reading" | "other";

export interface HomeworkTask {
  id: string;
  subject: Subject;
  title: string;
  estimatedMinutes: number;
  priority: 1 | 2 | 3;
  completedAt?: string | null;
}

export interface LlmTaskParseRequest {
  rawText: string;
  childAge?: number;
  provider?: "openai" | "claude" | "deepseek" | "mimo";
  userId?: string;
  date?: string;
  persist?: boolean;
}

export interface LlmTaskParseResponse {
  tasks: HomeworkTask[];
  provider: string;
  latencyMs: number;
}

export interface FocusSummary {
  totalMinutesToday: number;
  currentSessionMinutes: number;
  parentStatus: "focused" | "away" | "offline";
}

export interface FocusStats {
  completedSessionsToday: number;
  totalSecondsToday: number;
  streakDays: number;
}

export interface FocusRecordInput {
  userId: string;
  mode: "daily" | "task";
  taskId?: string;
  durationSeconds: number;
  completed?: boolean;
}

export interface CompanionFocusSession {
  id: string;
  familyName: string;
  childUserId: string;
  parentUserId?: string | null;
  mode: "daily" | "task";
  taskId?: string | null;
  taskTitle?: string | null;
  status: "active" | "ended";
  secondsLeft: number;
  totalSeconds: number;
  endsAt?: string | null;
  childRunning: boolean;
  parentJoined: boolean;
  startedAt: string;
  endedAt?: string | null;
  lastChildSeenAt?: string | null;
  lastParentSeenAt?: string | null;
  updatedAt: string;
}

export interface CompanionFocusState {
  familyName: string;
  childUserId?: string | null;
  parentUserId?: string | null;
  parentName?: string | null;
  childOnline: boolean;
  parentOnline: boolean;
  childLastSeenAt?: string | null;
  parentLastSeenAt?: string | null;
  activeSession?: CompanionFocusSession | null;
  serverNow: string;
  updatedAt: string;
}

export interface CompanionFocusHeartbeatInput {
  userId: string;
  mode?: "daily" | "task";
  taskId?: string | null;
  taskTitle?: string | null;
  secondsLeft?: number;
  totalSeconds?: number;
  running?: boolean;
  active?: boolean;
}

export type GameType = "schulte" | "stroop" | "nback" | "reaction";

export interface GameRecord {
  id: string;
  userId: string;
  gameType: GameType;
  date: string;
  difficulty: string;
  durationMs: number;
  score?: number | null;
  accuracy?: number | null;
  reactionMs?: number | null;
  missCount: number;
  detail?: Record<string, unknown> | null;
  completedAt: string;
  createdAt: string;
}

export interface GameRecordInput {
  userId: string;
  gameType: GameType;
  date?: string;
  difficulty: string;
  durationMs: number;
  score?: number | null;
  accuracy?: number | null;
  reactionMs?: number | null;
  missCount?: number;
  detail?: Record<string, unknown> | null;
}

export interface GameSummaryItem {
  gameType: GameType;
  name: string;
  icon: string;
  metricLabel: string;
  bestLabel: string;
  recentLabel: string;
  todayCount: number;
  history: GameRecord[];
  trend: Array<{
    label: string;
    value: number;
  }>;
}

export interface GameSummary {
  userId: string;
  date: string;
  todaySessions: number;
  todayMinutes: number;
  totalSessions: number;
  games: GameSummaryItem[];
  updatedAt: string;
}

export interface ChildProfileSettings {
  pinMode: "pin" | "pattern";
  unlockAge: number;
  weeklyReminder: boolean;
}

export interface ChildProfileBadge {
  id: string;
  icon: string;
  label: string;
  earned: boolean;
  tone: "gold" | "purple" | "green" | "neutral";
}

export interface ChildFocusDay {
  date: string;
  label: string;
  totalSeconds: number;
}

export interface ChildProfileSummary {
  userId: string;
  familyName: string;
  childName: string;
  childGrade: string;
  childAvatar: string;
  avatarLabel: string;
  stats: {
    tomatoCount: number;
    streakDays: number;
    walletBalance: number;
    monthlyRewardAmount: number;
    pendingRewardAmount: number;
    pendingRewardCount: number;
    growthStories: number;
    pendingLetters: number;
    completedTasksToday: number;
    totalTasksToday: number;
    totalFocusSecondsToday: number;
  };
  focusWeek: ChildFocusDay[];
  badges: ChildProfileBadge[];
  settings: ChildProfileSettings;
  updatedAt: string;
}

export interface UpdateChildProfileInput {
  userId: string;
  childName?: string;
  childGrade?: string;
  childAvatar?: string;
  avatarLabel?: string;
  pinMode?: "pin" | "pattern";
  unlockAge?: number;
  weeklyReminder?: boolean;
}

export interface ParentProfileMember {
  id: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  avatar: string;
  badge: string;
}

export interface ParentProfileSummary {
  userId: string;
  displayName: string;
  familyName: string;
  role: "parent" | "elder";
  inviteCode: string;
  child: {
    userId: string;
    name: string;
    grade: string;
    avatar: string;
    joined: boolean;
  };
  stats: {
    memberCount: number;
    childRecordDays: number;
    monthlyRewards: number;
    monthlyDeductions: number;
    walletBalance: number;
    monthlyRewardAmount: number;
    monthlyDeductAmount: number;
    pendingRewardAmount: number;
    pendingRewardCount: number;
    companionStreakDays: number;
    childFocusSecondsToday: number;
    completedTasksToday: number;
    totalTasksToday: number;
  };
  focusWeek: ChildFocusDay[];
  members: ParentProfileMember[];
  updatedAt: string;
}

export type ParentChildTimelineKind = "focus" | "task" | "game" | "wallet";

export type ParentChildTimelineTone = "green" | "purple" | "gold" | "blue" | "coral";

export interface ParentChildTimelineItem {
  id: string;
  kind: ParentChildTimelineKind;
  time: string;
  occurredAt: string;
  title: string;
  detail: string;
  icon: string;
  tone: ParentChildTimelineTone;
  value?: string | null;
}

export interface ParentChildSubjectStat {
  subject: Subject;
  label: string;
  icon: string;
  completed: number;
  total: number;
  percent: number;
}

export interface ParentChildWalletItem {
  id: string;
  type: "reward" | "deduct";
  amount: number;
  reason: string;
  status: "pending" | "approved" | "appealing" | "resolved" | "cancelled";
  initiatorName: string;
  createdAt: string;
}

export interface ParentChildDetailSummary {
  userId: string;
  familyName: string;
  child: ParentProfileSummary["child"];
  stats: {
    completedTasksToday: number;
    totalTasksToday: number;
    totalFocusSecondsToday: number;
    walletBalance: number;
    pendingRewardAmount: number;
    pendingRewardCount: number;
    streakDays: number;
    monthlyRewardAmount: number;
    monthlyDeductAmount: number;
    gameSessionsToday: number;
  };
  timeline: ParentChildTimelineItem[];
  subjectStats: ParentChildSubjectStat[];
  focusWeek: ChildFocusDay[];
  walletHistory: ParentChildWalletItem[];
  updatedAt: string;
}

export interface UpdateParentProfileInput {
  userId: string;
  displayName?: string;
  familyName?: string;
}

export type WalletEntryType = "reward" | "deduct";

export type WalletEntryStatus = "pending" | "approved" | "appealing" | "resolved" | "cancelled";

export type WalletEvidenceKind = "photo" | "audio" | "video";

export interface WalletEvidence {
  kind: WalletEvidenceKind;
  label: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface WalletEntry {
  id: string;
  childUserId: string;
  initiatorUserId: string;
  initiatorName: string;
  type: WalletEntryType;
  amount: number;
  reason: string;
  evidence?: WalletEvidence | null;
  status: WalletEntryStatus;
  appealReason?: string | null;
  appealEvidence?: WalletEvidence | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface WalletWeekBucket {
  label: string;
  rewardAmount: number;
  deductAmount: number;
  current: boolean;
}

export interface WalletSummary {
  viewerRole: UserRole;
  child: {
    userId: string;
    name: string;
    grade: string;
    avatar: string;
    joined: boolean;
  };
  balance: number;
  stats: {
    monthlyRewardAmount: number;
    monthlyDeductAmount: number;
    monthlyRewardCount: number;
    monthlyDeductCount: number;
    pendingAmount: number;
    pendingCount: number;
  };
  weekBuckets: WalletWeekBucket[];
  entries: WalletEntry[];
  updatedAt: string;
}

export interface WalletSummaryQuery {
  userId: string;
}

export interface CreateWalletEntryInput {
  userId: string;
  childUserId?: string;
  type: WalletEntryType;
  amount: number;
  reason: string;
  evidence?: WalletEvidence | null;
}

export interface ResolveWalletEntryInput {
  userId: string;
  status: Extract<WalletEntryStatus, "approved" | "appealing">;
  appealReason?: string;
  appealEvidence?: WalletEvidence | null;
}

export interface ParentReviewWalletEntryInput {
  userId: string;
  status: Extract<WalletEntryStatus, "approved" | "cancelled">;
  resolutionNote?: string;
}

export interface UploadWalletEvidenceInput {
  userId: string;
  kind: WalletEvidenceKind;
  fileName: string;
  mimeType: string;
  dataBase64: string;
}
