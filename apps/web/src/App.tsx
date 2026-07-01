import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bell,
  BookOpen,
  Check,
  Coins,
  Flame,
  GripVertical,
  ListChecks,
  LoaderCircle,
  MoonStar,
  Pencil,
  Plus,
  Save,
  Send,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Trash2,
  Users,
  Volume2,
  X,
} from "lucide-react";
import type {
  ChildProfileSummary,
  CompanionFocusState,
  FocusStats,
  GameRecordInput,
  GameSummary,
  GameSummaryItem,
  GameType,
  HomeworkTask,
  MoodShareSummary,
  ParentChildDetailSummary,
  ParentProfileSummary,
  Subject,
  UpdateChildProfileInput,
  UpdateParentProfileInput,
  WalletEntry,
  WalletEvidence,
  WalletEvidenceKind,
  WalletEntryType,
  WalletSummary,
} from "@parentbond/shared";
import { Starfield } from "./components/Starfield";
import {
  navigation,
  quickCards,
  subjectMeta,
  type ViewId,
} from "./data/mock";
import {
  createMoodShare,
  createWalletEntry,
  fetchCompanionFocus,
  fetchChildProfile,
  fetchFocusStats,
  fetchGameSummary,
  fetchMoodShares,
  fetchParentChildDetail,
  fetchParentProfile,
  fetchTodayTasks,
  fetchWalletSummary,
  reviewWalletEntry,
  resolveWalletEntry,
  saveFocusRecord,
  saveCompanionFocusHeartbeat,
  saveGameRecord,
  saveTodayTasks,
  setTaskComplete,
  subscribeTaskUpdates,
  updateChildProfile,
  updateParentProfile,
  uploadWalletEvidence,
} from "./services/api";
import type { AuthUser } from "./services/auth";
import { setChildPattern } from "./services/auth";
import { parseHomeworkLocally } from "./services/task-fallback";

const DEFAULT_USER_ID = "demo-child-001";

type TaskSyncStatus = "loading" | "live" | "offline" | "saving";
type ProfileSyncStatus = "loading" | "live" | "offline" | "saving";
type MemorySyncStatus = "loading" | "live" | "offline" | "saving";
type TaskDropPlacement = "before" | "after";
type FocusMode = "daily" | "task";
type TaskFocusTimer = {
  taskId: string;
  secondsLeft: number;
  totalSeconds: number;
};

type StoredTaskFocusSession = {
  taskId: string;
  timer: TaskFocusTimer;
};

const TASK_FOCUS_STORAGE_KEY = "parentbond.task-focus.v1";
const FOCUS_AUTO_FLUSH_SECONDS = 60;

const moodOptions = [
  { mood: "😊", label: "开心" },
  { mood: "😌", label: "平静" },
  { mood: "💪", label: "有力量" },
  { mood: "😔", label: "有点难过" },
  { mood: "😤", label: "有点生气" },
  { mood: "✨", label: "想记录" },
] as const;

const patternNodePoints = [
  { x: 44, y: 44 },
  { x: 120, y: 44 },
  { x: 196, y: 44 },
  { x: 44, y: 120 },
  { x: 120, y: 120 },
  { x: 196, y: 120 },
  { x: 44, y: 196 },
  { x: 120, y: 196 },
  { x: 196, y: 196 },
];

const emptyFocusStats: FocusStats = {
  completedSessionsToday: 0,
  totalSecondsToday: 0,
  streakDays: 0,
};

type TaskEditorDraft = {
  id: string | null;
  subject: Subject;
  title: string;
  estimatedMinutes: number;
  priority: 1 | 2 | 3;
};

const childBottomNavigation = [
  { id: "home", label: "首页", icon: "🏠" },
  { id: "tasks", label: "任务", icon: "📋" },
  { id: "games", label: "游戏", icon: "🎮" },
  { id: "profile", label: "我的", icon: "🦊" },
] as const satisfies Array<{ id: ViewId; label: string; icon: string }>;

const parentBottomNavigation = [
  { id: "home", label: "首页", icon: "🏠" },
  { id: "tasks", label: "孩子", icon: "👦" },
  { id: "memory", label: "时光机", icon: "📓" },
  { id: "profile", label: "我的", icon: "👨" },
] as const satisfies Array<{ id: ViewId; label: string; icon: string }>;

const parentNavigation = [
  { id: "home", label: "观察" },
  { id: "tasks", label: "孩子详情" },
  { id: "focus", label: "专注" },
  { id: "memory", label: "记录" },
  { id: "profile", label: "我的" },
] as const satisfies Array<{ id: ViewId; label: string }>;

function formatTimer(value: number) {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatTimerParts(value: number) {
  return {
    minutes: Math.floor(value / 60)
      .toString()
      .padStart(2, "0"),
    seconds: Math.floor(value % 60)
      .toString()
      .padStart(2, "0"),
  };
}

function localDateString(date = new Date()) {
  const localTime = date.getTime() - date.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 10);
}

const childAvatarOptions = [
  { avatar: "🦊", label: "小狐狸" },
  { avatar: "🐼", label: "熊猫" },
  { avatar: "🦁", label: "小狮子" },
  { avatar: "🐯", label: "小老虎" },
  { avatar: "🦋", label: "蝴蝶" },
  { avatar: "🐉", label: "小龙" },
  { avatar: "🦄", label: "独角兽" },
  { avatar: "🚀", label: "火箭" },
];

function formatMoney(value: number) {
  return `¥${value.toFixed(value % 1 === 0 ? 0 : 1)}`;
}

function formatFocusMinutes(seconds: number) {
  return `${Math.round(seconds / 60)}分钟`;
}

function fallbackFocusWeek() {
  const labels = ["周一", "周二", "周三", "周四", "周五", "周六", "今天"];
  return labels.map((label, index) => ({
    date: String(index),
    label,
    totalSeconds: 0,
  }));
}

function focusWeekWithToday(focusWeek: ChildProfileSummary["focusWeek"], totalSecondsToday: number) {
  if (totalSecondsToday <= 0) return focusWeek;
  const todayIndex = focusWeek.findIndex((day) => day.label === "今天");
  if (todayIndex < 0) return focusWeek;

  return focusWeek.map((day, index) =>
    index === todayIndex
      ? { ...day, totalSeconds: Math.max(day.totalSeconds, totalSecondsToday) }
      : day,
  );
}

function fallbackBadges(): ChildProfileSummary["badges"] {
  return [
    { id: "streak-7", icon: "🔥", label: "7天连续", earned: false, tone: "gold" },
    { id: "tomato-50", icon: "🍅", label: "50个番茄", earned: false, tone: "purple" },
    { id: "perfect-day", icon: "⭐", label: "满分达人", earned: false, tone: "green" },
    { id: "tomato-100", icon: "🏆", label: "100个番茄", earned: false, tone: "neutral" },
    { id: "streak-30", icon: "📚", label: "30天连续", earned: false, tone: "neutral" },
  ];
}

function formatFocusDuration(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${totalMinutes}m`;
}

function readStoredTaskFocusSession(): StoredTaskFocusSession | null {
  if (typeof window === "undefined") return null;

  try {
    const value = JSON.parse(window.localStorage.getItem(TASK_FOCUS_STORAGE_KEY) ?? "null") as Partial<StoredTaskFocusSession>;
    const timer = value.timer;
    if (
      !value.taskId ||
      !timer ||
      timer.taskId !== value.taskId ||
      !Number.isFinite(timer.secondsLeft) ||
      !Number.isFinite(timer.totalSeconds) ||
      timer.secondsLeft < 1 ||
      timer.totalSeconds < 1
    ) {
      return null;
    }

    return {
      taskId: value.taskId,
      timer: {
        taskId: timer.taskId,
        secondsLeft: Math.floor(timer.secondsLeft),
        totalSeconds: Math.floor(timer.totalSeconds),
      },
    };
  } catch {
    return null;
  }
}

function doneCount(tasks: HomeworkTask[]) {
  return tasks.filter((task) => task.completedAt).length;
}

function playPositiveSound() {
  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
  gain.connect(context.destination);

  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.07);
    oscillator.stop(context.currentTime + 0.34 + index * 0.04);
  });
}

export function App({
  userId = DEFAULT_USER_ID,
  authUser,
  onLogout,
}: {
  userId?: string;
  authUser?: AuthUser;
  onLogout?: () => void;
}) {
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [tasks, setTasks] = useState<HomeworkTask[]>([]);
  const [taskSyncStatus, setTaskSyncStatus] = useState<TaskSyncStatus>("loading");
  const [taskDate, setTaskDate] = useState(() => localDateString());
  const [profileSyncStatus, setProfileSyncStatus] = useState<ProfileSyncStatus>("loading");
  const [childProfile, setChildProfile] = useState<ChildProfileSummary | null>(null);
  const [parentProfile, setParentProfile] = useState<ParentProfileSummary | null>(null);
  const [parentChildDetail, setParentChildDetail] = useState<ParentChildDetailSummary | null>(null);
  const [taskDraftText, setTaskDraftText] = useState("");
  const [taskFeedback, setTaskFeedback] = useState("请输入今日的任务，本地算法会整理成结构化清单");
  const [celebratedTaskId, setCelebratedTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [isParsingTasks, setIsParsingTasks] = useState(false);
  const [allDoneCelebration, setAllDoneCelebration] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string | null>(
    () => readStoredTaskFocusSession()?.taskId ?? null,
  );
  const [focusMode, setFocusMode] = useState<FocusMode>(
    () => (readStoredTaskFocusSession() ? "task" : "daily"),
  );
  const [focusSessionFinished, setFocusSessionFinished] = useState(false);
  const [focusStats, setFocusStats] = useState<FocusStats>(emptyFocusStats);
  const [companionFocus, setCompanionFocus] = useState<CompanionFocusState | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [dailyFocusSecondsLeft, setDailyFocusSecondsLeft] = useState(25 * 60);
  const [taskFocusTimer, setTaskFocusTimer] = useState<TaskFocusTimer | null>(
    () => readStoredTaskFocusSession()?.timer ?? null,
  );
  const [taskEditor, setTaskEditor] = useState<TaskEditorDraft | null>(null);
  const [memoryText, setMemoryText] = useState("");
  const [memoryMood, setMemoryMood] = useState("😊");
  const [memorySummary, setMemorySummary] = useState<MoodShareSummary | null>(null);
  const [memorySyncStatus, setMemorySyncStatus] = useState<MemorySyncStatus>("loading");

  const isParentSession = authUser ? authUser.role !== "child" : false;
  const taskOwnerUserId = isParentSession ? parentProfile?.child.userId ?? null : userId;
  const visibleNavigation = isParentSession ? parentNavigation : navigation;
  const visibleBottomNavigation = isParentSession ? parentBottomNavigation : childBottomNavigation;
  const completed = doneCount(tasks);
  const progress = Math.round((completed / Math.max(tasks.length, 1)) * 100);
  const remaining = tasks.length - completed;
  const nextTask = useMemo(
    () => tasks.find((task) => !task.completedAt) ?? tasks[tasks.length - 1] ?? null,
    [tasks],
  );
  const childName = childProfile?.childName ?? parentProfile?.child.name ?? authUser?.childName ?? "小明";
  const childGrade = childProfile?.childGrade ?? parentProfile?.child.grade ?? authUser?.childGrade ?? "四年级";
  const childAvatar = childProfile?.childAvatar ?? parentProfile?.child.avatar ?? authUser?.childAvatar ?? "🦊";
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId && !task.completedAt) ?? null,
    [selectedTaskId, tasks],
  );
  const activeFocusTask = useMemo(
    () => tasks.find((task) => task.id === activeFocusTaskId) ?? null,
    [activeFocusTaskId, tasks],
  );
  const focusRounds = focusStats.completedSessionsToday;
  const resumableTaskFocus =
    activeFocusTask &&
    !activeFocusTask.completedAt &&
    taskFocusTimer?.taskId === activeFocusTask.id &&
    taskFocusTimer.secondsLeft > 0 &&
    !focusSessionFinished
      ? taskFocusTimer
      : null;
  const focusDurationSeconds =
    focusMode === "task" && activeFocusTask
      ? taskFocusTimer?.taskId === activeFocusTask.id
        ? taskFocusTimer.totalSeconds
        : activeFocusTask.estimatedMinutes * 60
      : 25 * 60;
  const secondsLeft =
    focusMode === "task"
      ? taskFocusTimer?.taskId === activeFocusTaskId
        ? taskFocusTimer.secondsLeft
        : focusDurationSeconds
      : dailyFocusSecondsLeft;
  const ringProgress = Math.min(
    100,
    Math.max(0, Math.round(((focusDurationSeconds - secondsLeft) / focusDurationSeconds) * 100)),
  );
  const tasksRef = useRef(tasks);
  const dragDirtyRef = useRef(false);
  const draggingTaskIdRef = useRef<string | null>(null);
  const taskItemRefs = useRef(new Map<string, HTMLElement>());
  const taskPositionsRef = useRef(new Map<string, number>());
  const allDoneTimerRef = useRef<number | null>(null);
  const focusRoundCountedRef = useRef(false);
  const focusPendingSecondsRef = useRef(0);
  const focusAutoFlushSecondsRef = useRef(0);
  const focusTickAtRef = useRef<number | null>(null);
  const secondsLeftRef = useRef(secondsLeft);
  const focusModeRef = useRef(focusMode);
  const timerRunningRef = useRef(timerRunning);
  const activeViewRef = useRef(activeView);
  const focusDurationSecondsRef = useRef(focusDurationSeconds);
  const activeFocusTaskRef = useRef<HomeworkTask | null>(activeFocusTask);
  const focusSessionFinishedRef = useRef(focusSessionFinished);
  const activeFocusTaskIdRef = useRef(activeFocusTaskId);
  const loadedTaskDateRef = useRef<string | null>(null);

  const flushFocusProgress = useCallback((completed = false, options?: { keepalive?: boolean }) => {
    const durationSeconds = focusPendingSecondsRef.current;
    if (durationSeconds < 1 || !taskOwnerUserId) return;

    focusPendingSecondsRef.current = 0;
    focusAutoFlushSecondsRef.current = 0;
    const request = saveFocusRecord({
      userId: taskOwnerUserId,
      mode: focusModeRef.current,
      taskId: focusModeRef.current === "task" ? activeFocusTaskIdRef.current ?? undefined : undefined,
      durationSeconds,
      completed,
    }, { keepalive: options?.keepalive });

    if (options?.keepalive) {
      void request.catch(() => undefined);
      return;
    }

    void request
      .then((savedStats) => {
        setFocusStats((current) => ({
          ...savedStats,
          completedSessionsToday: Math.max(current.completedSessionsToday, savedStats.completedSessionsToday),
          totalSecondsToday: Math.max(
            current.totalSecondsToday,
            savedStats.totalSecondsToday + focusPendingSecondsRef.current,
          ),
          streakDays: Math.max(current.streakDays, savedStats.streakDays),
        }));
      })
      .catch(() => {
        focusPendingSecondsRef.current += durationSeconds;
        focusAutoFlushSecondsRef.current += durationSeconds;
      });
  }, [taskOwnerUserId]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    const refreshLocalDate = () => setTaskDate((current) => {
      const nextDate = localDateString();
      return current === nextDate ? current : nextDate;
    });
    refreshLocalDate();
    const timer = window.setInterval(refreshLocalDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);

  useEffect(() => {
    focusModeRef.current = focusMode;
  }, [focusMode]);

  useEffect(() => {
    timerRunningRef.current = timerRunning;
  }, [timerRunning]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    focusDurationSecondsRef.current = focusDurationSeconds;
  }, [focusDurationSeconds]);

  useEffect(() => {
    activeFocusTaskRef.current = activeFocusTask;
  }, [activeFocusTask]);

  useEffect(() => {
    focusSessionFinishedRef.current = focusSessionFinished;
  }, [focusSessionFinished]);

  useEffect(() => {
    activeFocusTaskIdRef.current = activeFocusTaskId;
  }, [activeFocusTaskId]);

  useEffect(() => {
    try {
      if (
        !taskFocusTimer ||
        activeFocusTaskId !== taskFocusTimer.taskId ||
        focusSessionFinished ||
        activeFocusTask?.completedAt
      ) {
        window.localStorage.removeItem(TASK_FOCUS_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(
        TASK_FOCUS_STORAGE_KEY,
        JSON.stringify({ taskId: taskFocusTimer.taskId, timer: taskFocusTimer }),
      );
    } catch {
      // Storage is an optional continuity enhancement; focus remains usable without it.
    }
  }, [activeFocusTask?.completedAt, activeFocusTaskId, focusSessionFinished, taskFocusTimer]);

  useLayoutEffect(() => {
    const previousPositions = taskPositionsRef.current;
    if (previousPositions.size === 0) return;

    taskItemRefs.current.forEach((element, taskId) => {
      const previousTop = previousPositions.get(taskId);
      if (previousTop === undefined) return;

      const currentTop = element.getBoundingClientRect().top;
      const delta = previousTop - currentTop;
      if (Math.abs(delta) < 1) return;

      element.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
        {
          duration: 280,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        },
      );
    });

    taskPositionsRef.current = new Map();
  }, [tasks]);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      if (!taskOwnerUserId) {
        setTaskSyncStatus("loading");
        return;
      }

      try {
        const remoteTasks = await fetchTodayTasks(taskOwnerUserId, taskDate);
        if (cancelled) return;

        const dateChanged = loadedTaskDateRef.current !== null && loadedTaskDateRef.current !== taskDate;
        loadedTaskDateRef.current = taskDate;
        tasksRef.current = remoteTasks;
        setTasks(remoteTasks);
        if (dateChanged) {
          setSelectedTaskId(null);
          setActiveFocusTaskId(null);
          setTaskFocusTimer(null);
          setFocusSessionFinished(false);
          setTimerRunning(false);
        }
        setTaskSyncStatus("live");
      } catch {
        if (!cancelled) {
          setTaskSyncStatus("offline");
        }
      }
    }

    void loadTasks();

    return () => {
      cancelled = true;
    };
  }, [taskOwnerUserId, taskDate]);

  useEffect(() => {
    let cancelled = false;

    setProfileSyncStatus("loading");
    if (authUser?.role !== "child") {
      setChildProfile(null);
      return () => {
        cancelled = true;
      };
    }

    void fetchChildProfile(userId)
      .then((profile) => {
        if (cancelled) return;
        setChildProfile(profile);
        setProfileSyncStatus("live");
      })
      .catch(() => {
        if (!cancelled) setProfileSyncStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, [authUser?.role, userId]);

  useEffect(() => {
    let cancelled = false;

    if (authUser?.role === "child") {
      setParentProfile(null);
      setParentChildDetail(null);
      return () => {
        cancelled = true;
      };
    }

    setProfileSyncStatus("loading");
    void fetchParentProfile(userId)
      .then((profile) => {
        if (cancelled) return;
        setParentProfile(profile);
        setProfileSyncStatus("live");
      })
      .catch(() => {
        if (!cancelled) setProfileSyncStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, [authUser?.role, userId]);

  useEffect(() => {
    let cancelled = false;

    if (authUser?.role === "child") {
      setParentChildDetail(null);
      return () => {
        cancelled = true;
      };
    }

    const loadParentChildDetail = () => {
      void fetchParentChildDetail(userId)
        .then((detail) => {
          if (!cancelled) setParentChildDetail(detail);
        })
        .catch(() => undefined);
    };

    loadParentChildDetail();
    const timer = activeView === "tasks" ? window.setInterval(loadParentChildDetail, 15_000) : undefined;

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [activeView, authUser?.role, userId]);

  useEffect(() => {
    let cancelled = false;

    setMemorySyncStatus("loading");
    void fetchMoodShares(userId)
      .then((summary) => {
        if (cancelled) return;
        setMemorySummary(summary);
        setMemorySyncStatus("live");
      })
      .catch(() => {
        if (!cancelled) setMemorySyncStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshVisibleProfile = useCallback(() => {
    if (authUser?.role === "child") {
      void fetchChildProfile(userId)
        .then((profile) => {
          setChildProfile(profile);
          setProfileSyncStatus("live");
        })
        .catch(() => setProfileSyncStatus("offline"));
      return;
    }

    void fetchParentProfile(userId)
      .then((profile) => {
        setParentProfile(profile);
        setProfileSyncStatus("live");
      })
      .catch(() => setProfileSyncStatus("offline"));
    void fetchParentChildDetail(userId)
      .then((detail) => setParentChildDetail(detail))
      .catch(() => undefined);
  }, [authUser?.role, userId]);

  const saveMoodShare = useCallback(() => {
    const content = memoryText.trim();
    if (!content || memorySyncStatus === "saving") return;

    setMemorySyncStatus("saving");
    void createMoodShare({ userId, mood: memoryMood, content })
      .then((summary) => {
        setMemorySummary(summary);
        setMemoryText("");
        setMemorySyncStatus("live");
      })
      .catch(() => {
        setMemorySyncStatus("offline");
      });
  }, [memoryMood, memorySyncStatus, memoryText, userId]);

  useEffect(() => {
    let cancelled = false;

    if (!taskOwnerUserId) return () => {
      cancelled = true;
    };

    void fetchFocusStats(taskOwnerUserId)
      .then((stats) => {
        if (!cancelled) setFocusStats(stats);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [taskOwnerUserId]);

  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;
    const syncCompanionFocus = () => {
      const role = authUser?.role;
      const isChild = role === "child" || !role;

      const request = isChild && activeViewRef.current === "focus"
        ? saveCompanionFocusHeartbeat({
          userId,
          mode: focusModeRef.current,
          taskId: focusModeRef.current === "task" ? activeFocusTaskRef.current?.id ?? null : null,
          taskTitle: focusModeRef.current === "task" ? activeFocusTaskRef.current?.title ?? null : null,
          secondsLeft: secondsLeftRef.current,
          totalSeconds: focusDurationSecondsRef.current,
          running: timerRunningRef.current,
          active:
            !focusSessionFinishedRef.current &&
            (focusModeRef.current === "daily" || Boolean(activeFocusTaskRef.current && !activeFocusTaskRef.current.completedAt)),
        })
        : role && role !== "child" && activeViewRef.current === "focus"
          ? saveCompanionFocusHeartbeat({ userId })
          : fetchCompanionFocus(userId);

      void request
        .then((state) => {
          if (!cancelled) setCompanionFocus(state);
        })
        .catch(() => undefined);
    };

    syncCompanionFocus();
    const timer = window.setInterval(syncCompanionFocus, activeView === "focus" ? 2_000 : 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeFocusTaskId, activeView, authUser?.role, focusMode, focusSessionFinished, timerRunning, userId]);

  useEffect(() => {
    if (!taskOwnerUserId) return undefined;

    const unsubscribe = subscribeTaskUpdates(
      taskOwnerUserId,
      taskDate,
      (remoteTasks) => {
        setTasks(remoteTasks);
        setTaskSyncStatus("live");
      },
      () => {
        setTaskSyncStatus((current) => (current === "live" ? "offline" : current));
      },
    );

    return unsubscribe;
  }, [taskOwnerUserId, taskDate]);

  const applyFocusElapsed = useCallback((rawElapsedSeconds: number) => {
    const remainingBefore = Math.max(0, secondsLeftRef.current);
    const elapsedSeconds = Math.min(Math.max(0, rawElapsedSeconds), remainingBefore);
    if (elapsedSeconds < 1) return;

    secondsLeftRef.current = Math.max(0, remainingBefore - elapsedSeconds);
    focusPendingSecondsRef.current += elapsedSeconds;
    focusAutoFlushSecondsRef.current += elapsedSeconds;

    setFocusStats((current) => ({
      ...current,
      totalSecondsToday: current.totalSecondsToday + elapsedSeconds,
    }));

    if (focusModeRef.current === "task") {
      setTaskFocusTimer((current) =>
        current && current.taskId === activeFocusTaskIdRef.current
          ? { ...current, secondsLeft: Math.max(0, current.secondsLeft - elapsedSeconds) }
          : current,
      );
    } else {
      setDailyFocusSecondsLeft((current) => Math.max(0, current - elapsedSeconds));
    }

    if (
      focusAutoFlushSecondsRef.current >= FOCUS_AUTO_FLUSH_SECONDS &&
      secondsLeftRef.current > 0
    ) {
      flushFocusProgress(false);
    }
  }, [flushFocusProgress]);

  const collectFocusElapsedUntilNow = useCallback(() => {
    if (!timerRunning) return;

    const now = Date.now();
    const lastTickAt = focusTickAtRef.current ?? now;
    const elapsedSeconds = Math.floor((now - lastTickAt) / 1000);
    if (elapsedSeconds < 1) return;

    focusTickAtRef.current = lastTickAt + elapsedSeconds * 1000;
    applyFocusElapsed(elapsedSeconds);
  }, [applyFocusElapsed, timerRunning]);

  useEffect(() => {
    if (!timerRunning || secondsLeftRef.current <= 0) {
      focusTickAtRef.current = null;
      return;
    }

    focusTickAtRef.current = Date.now();
    const timerId = window.setInterval(() => {
      collectFocusElapsedUntilNow();
    }, 250);

    return () => window.clearInterval(timerId);
  }, [collectFocusElapsedUntilNow, timerRunning]);

  useEffect(() => {
    const flushBeforePageLeaves = () => {
      collectFocusElapsedUntilNow();
      flushFocusProgress(false, { keepalive: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        collectFocusElapsedUntilNow();
        flushFocusProgress(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushBeforePageLeaves);
    window.addEventListener("beforeunload", flushBeforePageLeaves);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushBeforePageLeaves);
      window.removeEventListener("beforeunload", flushBeforePageLeaves);
    };
  }, [collectFocusElapsedUntilNow, flushFocusProgress]);

  useEffect(() => {
    if (secondsLeft > 0 || focusSessionFinished) return;

    setTimerRunning(false);
    setFocusSessionFinished(true);
    if (!focusRoundCountedRef.current) {
      focusRoundCountedRef.current = true;
      flushFocusProgress(true);
    }
    setTaskFeedback(
      focusMode === "task"
        ? "这一轮任务专注结束了，确认一下这项任务是否完成"
        : "这一轮番茄钟完成了，休息一下再继续吧",
    );
  }, [flushFocusProgress, focusMode, focusSessionFinished, secondsLeft]);

  useEffect(() => {
    if (taskSyncStatus === "loading" || !activeFocusTaskId || activeFocusTask) return;

    setActiveFocusTaskId(null);
    setTaskFocusTimer(null);
    setTimerRunning(false);
    setFocusSessionFinished(false);
  }, [activeFocusTask, activeFocusTaskId, taskSyncStatus]);

  useEffect(() => {
    if (!activeFocusTask || activeFocusTask.completedAt || selectedTaskId) return;
    setSelectedTaskId(activeFocusTask.id);
  }, [activeFocusTask, selectedTaskId]);

  useEffect(
    () => () => {
      if (allDoneTimerRef.current !== null) {
        window.clearTimeout(allDoneTimerRef.current);
      }
    },
    [],
  );

  const submitTaskText = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setTaskFeedback("先输入今天要完成的任务");
      return;
    }

    if (isParsingTasks) return;
    if (!taskOwnerUserId) {
      setTaskFeedback("正在加载家庭数据，稍等一下再整理清单");
      return;
    }

    const localTasks = parseHomeworkLocally(trimmed);
    setIsParsingTasks(true);
    setTaskSyncStatus("saving");
    setTaskFeedback("正在用本地算法整理学科、预计时长和优先级...");
    setTasks(localTasks);
    tasksRef.current = localTasks;
    setSelectedTaskId(null);

    saveTodayTasks(taskOwnerUserId, localTasks, taskDate)
      .then((savedTasks) => {
        setTasks(savedTasks);
        tasksRef.current = savedTasks;
        setTaskSyncStatus("live");
        setTaskFeedback(`已用本地算法生成 ${savedTasks.length} 项任务，按住左侧图标可以调整顺序`);
      })
      .catch(() => {
        setTaskSyncStatus("offline");
        setTaskFeedback(`已在本地生成 ${localTasks.length} 项任务，数据库暂时未同步`);
      })
      .finally(() => {
        setIsParsingTasks(false);
      });
  };

  const captureTaskPositions = () => {
    const positions = new Map<string, number>();
    taskItemRefs.current.forEach((element, taskId) => {
      positions.set(taskId, element.getBoundingClientRect().top);
    });
    taskPositionsRef.current = positions;
  };

  const reorderTaskAround = (
    sourceTaskId: string,
    targetTaskId: string,
    placement: TaskDropPlacement,
  ) => {
    if (sourceTaskId === targetTaskId) return;

    setTasks((current) => {
      const sourceIndex = current.findIndex((task) => task.id === sourceTaskId);
      const targetIndex = current.findIndex((task) => task.id === targetTaskId);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return current;
      }

      const nextTasks = [...current];
      const [draggedTask] = nextTasks.splice(sourceIndex, 1);
      const nextTargetIndex = nextTasks.findIndex((task) => task.id === targetTaskId);
      const insertIndex = placement === "after" ? nextTargetIndex + 1 : nextTargetIndex;
      nextTasks.splice(insertIndex, 0, draggedTask);

      if (nextTasks.every((task, index) => task.id === current[index]?.id)) {
        return current;
      }

      captureTaskPositions();
      tasksRef.current = nextTasks;
      dragDirtyRef.current = true;
      return nextTasks;
    });
  };

  const startTaskDrag = (taskId: string) => {
    captureTaskPositions();
    draggingTaskIdRef.current = taskId;
    setDraggingTaskId(taskId);
    dragDirtyRef.current = false;
  };

  const dragTaskAtPoint = (clientX: number, clientY: number) => {
    const activeTaskId = draggingTaskIdRef.current;
    if (!activeTaskId) return;

    const taskElement = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-task-id]");
    const targetTaskId = taskElement?.dataset.taskId;

    if (targetTaskId) {
      const rect = taskElement.getBoundingClientRect();
      const placement = clientY > rect.top + rect.height / 2 ? "after" : "before";
      reorderTaskAround(activeTaskId, targetTaskId, placement);
    }
  };

  const setTaskItemElement = (taskId: string, element: HTMLElement | null) => {
    if (element) {
      taskItemRefs.current.set(taskId, element);
      return;
    }

    taskItemRefs.current.delete(taskId);
  };

  const finishTaskDrag = () => {
    draggingTaskIdRef.current = null;
    setDraggingTaskId(null);

    if (!dragDirtyRef.current) return;
    dragDirtyRef.current = false;
    if (!taskOwnerUserId) {
      setTaskFeedback("正在加载家庭数据，暂时不能保存排序");
      return;
    }

    setTaskSyncStatus("saving");
    saveTodayTasks(taskOwnerUserId, tasksRef.current, taskDate)
      .then((savedTasks) => {
        setTasks(savedTasks);
        setTaskSyncStatus("live");
        setTaskFeedback("顺序已保存，父亲端会同步看到");
      })
      .catch(() => {
        setTaskSyncStatus("offline");
        setTaskFeedback("顺序已在本地调整，数据库暂时未同步");
      });
  };

  const celebrateAllTasks = () => {
    if (allDoneTimerRef.current !== null) {
      window.clearTimeout(allDoneTimerRef.current);
    }

    setAllDoneCelebration(true);
    allDoneTimerRef.current = window.setTimeout(() => {
      setAllDoneCelebration(false);
      allDoneTimerRef.current = null;
    }, 3200);
  };

  const persistTaskList = (nextTasks: HomeworkTask[], successMessage: string) => {
    tasksRef.current = nextTasks;
    if (!taskOwnerUserId) {
      setTaskSyncStatus("offline");
      setTaskFeedback(`${successMessage}，家庭数据还在加载中，数据库暂时未同步`);
      return;
    }

    setTaskSyncStatus("saving");
    saveTodayTasks(taskOwnerUserId, nextTasks, taskDate)
      .then((savedTasks) => {
        const remapTaskId = (currentId: string | null) => {
          if (!currentId || savedTasks.some((task) => task.id === currentId)) return currentId;

          const sourceTask = nextTasks.find((task) => task.id === currentId);
          const matchedTask = sourceTask
            ? savedTasks.find(
                (task) =>
                  task.title === sourceTask.title &&
                  task.subject === sourceTask.subject &&
                  task.estimatedMinutes === sourceTask.estimatedMinutes,
              )
            : undefined;
          return matchedTask?.id ?? currentId;
        };

        setTasks(savedTasks);
        setSelectedTaskId((current) => remapTaskId(current));
        setActiveFocusTaskId((current) => remapTaskId(current));
        setTaskSyncStatus("live");
        setTaskFeedback(successMessage);
      })
      .catch(() => {
        setTaskSyncStatus("offline");
        setTaskFeedback(`${successMessage}，数据库暂时未同步`);
      });
  };

  const openTaskEditor = (task?: HomeworkTask) => {
    setTaskEditor(
      task
        ? {
            id: task.id,
            subject: task.subject,
            title: task.title,
            estimatedMinutes: task.estimatedMinutes,
            priority: task.priority,
          }
        : {
            id: null,
            subject: "other",
            title: "",
            estimatedMinutes: 20,
            priority: 2,
          },
    );
  };

  const saveTaskEditor = () => {
    if (!taskEditor) return;

    const title = taskEditor.title.trim();
    if (!title) {
      setTaskFeedback("先写下这项任务的名称");
      return;
    }

    const nextTasks = taskEditor.id
      ? tasks.map((task) =>
          task.id === taskEditor.id
            ? {
                ...task,
                title,
                subject: taskEditor.subject,
                estimatedMinutes: Math.min(90, Math.max(1, taskEditor.estimatedMinutes)),
                priority: taskEditor.priority,
              }
            : task,
        )
      : [
          ...tasks,
          {
            id: `manual-${Date.now()}`,
            title,
            subject: taskEditor.subject,
            estimatedMinutes: Math.min(90, Math.max(1, taskEditor.estimatedMinutes)),
            priority: taskEditor.priority,
            completedAt: null,
          },
        ];

    setTasks(nextTasks);
    if (!taskEditor.id) {
      setSelectedTaskId(nextTasks[nextTasks.length - 1]?.id ?? null);
    }
    setTaskEditor(null);
    persistTaskList(nextTasks, taskEditor.id ? "任务已更新" : "新任务已加入清单");
  };

  const deleteTask = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const nextTasks = tasks.filter((item) => item.id !== taskId);
    setTasks(nextTasks);
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    if (activeFocusTaskId === taskId) {
      setActiveFocusTaskId(null);
      setTaskFocusTimer(null);
      setTimerRunning(false);
      setFocusSessionFinished(false);
    }
    persistTaskList(nextTasks, `已删除「${task.title}」`);
  };

  const startTaskFocus = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId && !item.completedAt);
    if (!task) return;

    const canResume =
      activeFocusTaskId === task.id &&
      taskFocusTimer?.taskId === task.id &&
      taskFocusTimer.secondsLeft > 0 &&
      !focusSessionFinished;

    if (canResume) {
      setFocusMode("task");
      setTimerRunning(true);
      setActiveView("focus");
      setTaskFeedback(`继续专注「${task.title}」，把刚才的节奏接回来`);
      return;
    }

    setSelectedTaskId(task.id);
    setActiveFocusTaskId(task.id);
    setFocusMode("task");
    setFocusSessionFinished(false);
    focusRoundCountedRef.current = false;
    setTaskFocusTimer({
      taskId: task.id,
      secondsLeft: task.estimatedMinutes * 60,
      totalSeconds: task.estimatedMinutes * 60,
    });
    setTimerRunning(true);
    setActiveView("focus");
    setTaskFeedback(`开始专注「${task.title}」，先把这一件事做好`);
  };

  const setDailyFocus = () => {
    if (focusMode === "daily") return;

    if (timerRunning) flushFocusProgress();
    setFocusMode("daily");
    setTimerRunning(false);
  };

  const setTaskFocusMode = () => {
    if (focusMode === "task") return;

    if (timerRunning) flushFocusProgress();
    setFocusMode("task");
    setTimerRunning(false);
    if (
      activeFocusTask &&
      !activeFocusTask.completedAt &&
      taskFocusTimer?.taskId !== activeFocusTask.id
    ) {
      setTaskFocusTimer({
        taskId: activeFocusTask.id,
        secondsLeft: activeFocusTask.estimatedMinutes * 60,
        totalSeconds: activeFocusTask.estimatedMinutes * 60,
      });
    }
  };

  const toggleFocusTimer = () => {
    if (focusSessionFinished) return;
    if (focusMode === "task" && (!activeFocusTask || activeFocusTask.completedAt)) return;
    if (timerRunning) {
      flushFocusProgress();
      setTimerRunning(false);
      return;
    }

    setTimerRunning(true);
  };

  const restartFocusTimer = () => {
    if (timerRunning) flushFocusProgress();
    if (focusMode === "task" && activeFocusTask && !activeFocusTask.completedAt) {
      setTaskFocusTimer({
        taskId: activeFocusTask.id,
        secondsLeft: activeFocusTask.estimatedMinutes * 60,
        totalSeconds: activeFocusTask.estimatedMinutes * 60,
      });
    } else {
      setDailyFocusSecondsLeft(25 * 60);
    }
    setFocusSessionFinished(false);
    focusRoundCountedRef.current = false;
    setTimerRunning(true);
  };

  const extendFocusTimer = () => {
    if (focusMode === "task" && activeFocusTask && !activeFocusTask.completedAt) {
      setTaskFocusTimer({ taskId: activeFocusTask.id, secondsLeft: 25 * 60, totalSeconds: 25 * 60 });
    } else {
      setDailyFocusSecondsLeft(25 * 60);
    }
    setFocusSessionFinished(false);
    focusRoundCountedRef.current = false;
    setTimerRunning(true);
  };

  const navigateToView = (view: ViewId) => {
    if (activeView === "focus" && view !== "focus" && timerRunning) {
      flushFocusProgress();
      setTimerRunning(false);
    }
    setActiveView(view);
  };

  const leaveParentCompanion = () => {
    if (authUser?.role && authUser.role !== "child") {
      void saveCompanionFocusHeartbeat({ userId, active: false })
        .then((state) => setCompanionFocus(state))
        .catch(() => undefined);
    }
    navigateToView("home");
  };

  const saveChildProfile = (input: Omit<UpdateChildProfileInput, "userId">) => {
    setProfileSyncStatus("saving");
    void updateChildProfile({ userId, ...input })
      .then((profile) => {
        setChildProfile(profile);
        setProfileSyncStatus("live");
      })
      .catch(() => {
        setProfileSyncStatus("offline");
      });
  };

  const saveChildUnlockPattern = (pattern: string) => {
    setProfileSyncStatus("saving");
    void setChildPattern({ userId, pattern })
      .then(() => updateChildProfile({ userId, pinMode: "pattern" }))
      .then((profile) => {
        setChildProfile(profile);
        setProfileSyncStatus("live");
      })
      .catch(() => {
        setProfileSyncStatus("offline");
      });
  };

  const saveParentProfile = (input: Omit<UpdateParentProfileInput, "userId">) => {
    setProfileSyncStatus("saving");
    void updateParentProfile({ userId, ...input })
      .then((profile) => {
        setParentProfile(profile);
        setProfileSyncStatus("live");
      })
      .catch(() => {
        setProfileSyncStatus("offline");
      });
  };

  const toggleTask = (taskId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;

    const previousTasks = tasks;
    const nextCompleted = !target.completedAt;
    const nextTasks = tasks.map((task) =>
      task.id === taskId
        ? { ...task, completedAt: nextCompleted ? new Date().toISOString() : null }
        : task,
    );

    setTasks(nextTasks);
    tasksRef.current = nextTasks;

    if (nextCompleted) {
      if (activeFocusTaskId === taskId) {
        setTimerRunning(false);
        setFocusSessionFinished(true);
      }
    }

    setTaskSyncStatus("saving");
    const hasPersistedId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      taskId,
    );
    const persistCompletion = hasPersistedId
      ? setTaskComplete(taskId, nextCompleted).then((savedTask) =>
          nextTasks.map((task) => (task.id === taskId ? savedTask : task)),
        )
      : taskOwnerUserId
        ? saveTodayTasks(taskOwnerUserId, nextTasks, taskDate)
        : Promise.reject(new Error("task owner is not ready"));

    persistCompletion
      .then((savedTasks) => {
        const remapTaskId = (currentId: string | null) => {
          if (!currentId || savedTasks.some((task) => task.id === currentId)) return currentId;

          const sourceTask = nextTasks.find((task) => task.id === currentId);
          const matchedTask = sourceTask
            ? savedTasks.find(
                (task) =>
                  task.title === sourceTask.title &&
                  task.subject === sourceTask.subject &&
                  task.estimatedMinutes === sourceTask.estimatedMinutes,
              )
            : undefined;
          return matchedTask?.id ?? currentId;
        };

        tasksRef.current = savedTasks;
        setTasks(savedTasks);
        setSelectedTaskId((current) => remapTaskId(current));
        setActiveFocusTaskId((current) => remapTaskId(current));
        setTaskSyncStatus("live");

        if (nextCompleted) {
          const allDone = savedTasks.length > 0 && savedTasks.every((task) => task.completedAt);
          setCelebratedTaskId(remapTaskId(taskId));
          setTaskFeedback(
            allDone ? "全部完成！今天的星光已经收集满了" : `完成「${target.title}」，已同步给家长端`,
          );
          playPositiveSound();
          window.setTimeout(() => setCelebratedTaskId(null), 900);
          if (allDone) celebrateAllTasks();
        } else {
          setAllDoneCelebration(false);
          setTaskFeedback(`已恢复「${target.title}」，已同步到后台`);
        }
      })
      .catch(() => {
        tasksRef.current = previousTasks;
        setTasks(previousTasks);
        setTaskSyncStatus("offline");
        setTaskFeedback("任务状态未能同步到后台，已恢复原状态，请检查服务后重试");
      });
  };

  const completeFocusedTask = () => {
    if (!activeFocusTask || activeFocusTask.completedAt) return;
    toggleTask(activeFocusTask.id);
  };

  return (
    <main className="app-root">
      <section className="phone-shell" aria-label="ParentBond 手机端体验">
        <Starfield />
        <div className="ambient-gradient" aria-hidden="true" />

        <div className={activeView === "focus" ? "scroll-area focus-scroll-area" : "scroll-area"}>
          {activeView !== "focus" && activeView !== "profile" && activeView !== "wallet" && !(isParentSession && (activeView === "home" || activeView === "tasks")) && (
            <>
              <header className="app-header">
                <div>
                  <p className="eyebrow">
                    {isParentSession
                      ? `${parentProfile?.familyName ?? authUser?.familyName ?? "ParentBond"} · 家长观察`
                      : `${authUser?.familyName ?? childProfile?.familyName ?? "ParentBond"} · 今天继续发光`}
                  </p>
                  <h1>
                    {isParentSession ? (
                      <>
                        {parentProfile?.child.name ?? childName} 今日<span> · 陪伴不打扰</span>
                      </>
                    ) : (
                      <>
                        {childName}同学<span> · {childGrade}</span>
                      </>
                    )}
                  </h1>
                </div>
                <button className="avatar-button" type="button" aria-label="打开个人资料" onClick={() => navigateToView("profile")}>
                  <span aria-hidden="true">{isParentSession ? "👨" : childAvatar}</span>
                </button>
              </header>

              <div className="page-tabs" aria-label="页面切换">
                {visibleNavigation.map(({ id, label }) => (
                  <button
                    key={id}
                    className={id === activeView ? "page-tab active" : "page-tab"}
                    type="button"
                    onClick={() => navigateToView(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          {activeView === "home" && (
            isParentSession ? (
              <ParentHomeView
                profile={parentProfile}
                profileSyncStatus={profileSyncStatus}
                taskSyncStatus={taskSyncStatus}
                focusStats={focusStats}
                tasks={tasks}
                completed={completed}
                progress={progress}
                nextTask={nextTask}
                companionFocus={companionFocus}
                fallback={{
                  displayName: authUser?.displayName ?? "小明爸爸",
                  familyName: authUser?.familyName ?? "ParentBond 家庭",
                  childName,
                  childGrade,
                  childAvatar,
                }}
                setActiveView={navigateToView}
              />
            ) : (
              <HomeView
                completed={completed}
                progress={progress}
                remaining={remaining}
                total={tasks.length}
                nextTask={nextTask}
                walletStats={childProfile?.stats ?? null}
                totalFocusSeconds={focusStats.totalSecondsToday}
                companionFocus={companionFocus}
                setActiveView={navigateToView}
              />
            )
          )}
          {activeView === "tasks" && (
            isParentSession ? (
              <ParentChildDetailView
                detail={parentChildDetail}
                profile={parentProfile}
                focusStats={focusStats}
                tasks={tasks}
                completed={completed}
                companionFocus={companionFocus}
                fallback={{ childName, childGrade, childAvatar }}
                onBack={() => navigateToView("home")}
                onEdit={() => navigateToView("profile")}
                onReward={() => navigateToView("wallet")}
                onFocus={() => navigateToView("focus")}
                onHistory={() => navigateToView("memory")}
              />
            ) : (
              <TasksView
                tasks={tasks}
                progress={progress}
                completed={completed}
                taskDraftText={taskDraftText}
                taskFeedback={taskFeedback}
                celebratedTaskId={celebratedTaskId}
                draggingTaskId={draggingTaskId}
                isParsingTasks={isParsingTasks}
                selectedTaskId={selectedTask?.id ?? null}
                resumableTaskId={resumableTaskFocus?.taskId ?? null}
                resumableSeconds={resumableTaskFocus?.secondsLeft ?? null}
                taskEditor={taskEditor}
                onDraftChange={setTaskDraftText}
                onSubmitDraft={() => submitTaskText(taskDraftText)}
                onSelectTask={setSelectedTaskId}
                onStartFocus={startTaskFocus}
                onOpenTaskEditor={openTaskEditor}
                onTaskEditorChange={setTaskEditor}
                onSaveTaskEditor={saveTaskEditor}
                onCancelTaskEditor={() => setTaskEditor(null)}
                onDeleteTask={deleteTask}
                onDragStartTask={startTaskDrag}
                onDragAtPoint={dragTaskAtPoint}
                onDragEndTask={finishTaskDrag}
                onTaskItemRef={setTaskItemElement}
                onToggleTask={toggleTask}
              />
            )
          )}
          {activeView === "focus" && (
            isParentSession ? (
              <ParentCompanionFocusView
                childName={childName}
                childAvatar={childAvatar}
                companionFocus={companionFocus}
                totalFocusSeconds={focusStats.totalSecondsToday}
                tasks={tasks}
                onLeave={leaveParentCompanion}
                onGoTasks={() => navigateToView("tasks")}
              />
            ) : (
              <FocusView
                secondsLeft={secondsLeft}
                timerRunning={timerRunning}
                ringProgress={ringProgress}
                focusTask={activeFocusTask}
                focusMode={focusMode}
                focusRoundSeconds={focusDurationSeconds}
                focusRounds={focusRounds}
                totalFocusSeconds={focusStats.totalSecondsToday}
                streakDays={focusStats.streakDays}
                sessionFinished={focusSessionFinished}
                companionFocus={companionFocus}
                onSelectDailyFocus={setDailyFocus}
                onSelectTaskFocus={setTaskFocusMode}
                onToggleTimer={toggleFocusTimer}
                onRestartTimer={restartFocusTimer}
                onGoToTasks={() => navigateToView("tasks")}
              />
            )
          )}
          {activeView === "games" && (
            <GamesView
              userId={taskOwnerUserId ?? userId}
            />
          )}
          {activeView === "wallet" && (
            <WalletView
              userId={userId}
              isParentSession={isParentSession}
              fallbackChild={{ name: childName, grade: childGrade, avatar: childAvatar }}
              parentProfile={parentProfile}
              childProfile={childProfile}
              onWalletChanged={refreshVisibleProfile}
            />
          )}
          {activeView === "memory" && (
            <MemoryView
              memoryText={memoryText}
              memoryMood={memoryMood}
              memorySummary={memorySummary}
              memorySyncStatus={memorySyncStatus}
              onMemoryText={setMemoryText}
              onMemoryMood={setMemoryMood}
              onSaveMemory={saveMoodShare}
            />
          )}
          {activeView === "profile" && (
            authUser?.role === "child" ? (
              <ChildProfileView
                profile={childProfile}
                profileSyncStatus={profileSyncStatus}
                fallback={{
                  childName,
                  childGrade,
                  childAvatar,
                  familyName: authUser?.familyName ?? "ParentBond 家庭",
                }}
                onLogout={onLogout ?? (() => navigateToView("home"))}
                onSaveProfile={saveChildProfile}
                onSavePattern={saveChildUnlockPattern}
              />
            ) : (
              <ParentProfileView
                profile={parentProfile}
                profileSyncStatus={profileSyncStatus}
                focusStats={focusStats}
                fallback={{
                  displayName: authUser?.displayName ?? "小明爸爸",
                  familyName: authUser?.familyName ?? "ParentBond 家庭",
                  inviteCode: authUser?.inviteCode ?? "------",
                  childName,
                  childGrade,
                  childAvatar,
                }}
                onLogout={onLogout ?? (() => navigateToView("home"))}
                onSaveProfile={saveParentProfile}
              />
            )
          )}
        </div>

        {activeView === "focus" && (focusSessionFinished || Boolean(activeFocusTask?.completedAt)) && (
          <FocusCompletionOverlay
            focusTask={activeFocusTask}
            focusMode={focusMode}
            focusRoundSeconds={focusDurationSeconds}
            onExtendTimer={extendFocusTimer}
            onCompleteTask={completeFocusedTask}
            onGoToTasks={() => navigateToView("tasks")}
          />
        )}

        {allDoneCelebration && (
          <div className="all-done-celebration" role="status" aria-live="polite">
            <div className="all-done-card">
              <div className="all-done-icons" aria-hidden="true">
                <Star size={17} />
                <Trophy size={38} />
                <Sparkles size={18} />
              </div>
              <span>今日任务全部完成</span>
              <strong>你今天真的很棒</strong>
              <p>星光已经为你点亮</p>
            </div>
          </div>
        )}

        <nav className="bottom-nav" aria-label="底部导航">
          {visibleBottomNavigation.slice(0, 2).map(({ id, label, icon }) => (
            <button
              key={id}
              className={id === activeView ? "bottom-nav-item active" : "bottom-nav-item"}
              type="button"
              onClick={() => navigateToView(id)}
              aria-label={label}
            >
              {id === activeView && <span className="nav-dot" />}
              <span className="nav-icon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
          <button
            className="bottom-nav-center"
            type="button"
            aria-label={isParentSession ? "快速发起奖励" : "开始专注"}
            onClick={() => navigateToView(isParentSession ? "wallet" : "focus")}
          >
            <span aria-hidden="true">{isParentSession ? "💰" : "⏱️"}</span>
          </button>
          {visibleBottomNavigation.slice(2).map(({ id, label, icon }) => (
            <button
              key={id}
              className={id === activeView ? "bottom-nav-item active" : "bottom-nav-item"}
              type="button"
              onClick={() => navigateToView(id)}
              aria-label={label}
            >
              {id === activeView && <span className="nav-dot" />}
              <span className="nav-icon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </section>

      <ParentObserverPanel
        completed={completed}
        total={tasks.length}
        nextTask={nextTask}
        progress={progress}
        timerRunning={timerRunning}
        secondsLeft={secondsLeft}
        syncStatus={taskSyncStatus}
      />
    </main>
  );
}

function HomeView({
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

function ParentHomeView({
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
          <span className="parent-qa-icon green">💌</span>
          <span>未来信</span>
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

function ParentChildDetailView({
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

function ParentCompanionFocusView({
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

function TasksView({
  tasks,
  progress,
  completed,
  taskDraftText,
  taskFeedback,
  celebratedTaskId,
  draggingTaskId,
  isParsingTasks,
  selectedTaskId,
  resumableTaskId,
  resumableSeconds,
  taskEditor,
  onDraftChange,
  onSubmitDraft,
  onSelectTask,
  onStartFocus,
  onOpenTaskEditor,
  onTaskEditorChange,
  onSaveTaskEditor,
  onCancelTaskEditor,
  onDeleteTask,
  onDragStartTask,
  onDragAtPoint,
  onDragEndTask,
  onTaskItemRef,
  onToggleTask,
}: {
  tasks: HomeworkTask[];
  progress: number;
  completed: number;
  taskDraftText: string;
  taskFeedback: string;
  celebratedTaskId: string | null;
  draggingTaskId: string | null;
  isParsingTasks: boolean;
  selectedTaskId: string | null;
  resumableTaskId: string | null;
  resumableSeconds: number | null;
  taskEditor: TaskEditorDraft | null;
  onDraftChange: (value: string) => void;
  onSubmitDraft: () => void;
  onSelectTask: (taskId: string | null) => void;
  onStartFocus: (taskId: string) => void;
  onOpenTaskEditor: (task?: HomeworkTask) => void;
  onTaskEditorChange: (draft: TaskEditorDraft) => void;
  onSaveTaskEditor: () => void;
  onCancelTaskEditor: () => void;
  onDeleteTask: (taskId: string) => void;
  onDragStartTask: (taskId: string) => void;
  onDragAtPoint: (clientX: number, clientY: number) => void;
  onDragEndTask: () => void;
  onTaskItemRef: (taskId: string, element: HTMLElement | null) => void;
  onToggleTask: (taskId: string) => void;
}) {
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId && !task.completedAt) ??
    tasks.find((task) => !task.completedAt) ??
    null;
  const isResumingSelectedTask = Boolean(selectedTask && selectedTask.id === resumableTaskId);

  return (
    <section className="view-stack task-view">
      <div className={isParsingTasks ? "task-input-card is-parsing" : "task-input-card"}>
        <label className="manual-input">
          <span>今天的作业</span>
          <textarea
            value={taskDraftText}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="请输入今日的任务"
          />
        </label>

        <button
          className={isParsingTasks ? "primary-button gold full is-loading" : "primary-button gold full"}
          type="button"
          onClick={onSubmitDraft}
          disabled={isParsingTasks}
        >
          {isParsingTasks ? <LoaderCircle className="spin-icon" size={18} /> : <Sparkles size={18} />}
          {isParsingTasks ? "正在整理..." : "本地整理成清单"}
        </button>
      </div>

      {taskEditor && (
        <section className="task-editor" aria-label={taskEditor.id ? "编辑任务" : "新增任务"}>
          <div className="task-editor-header">
            <strong>{taskEditor.id ? "编辑任务" : "新增一项任务"}</strong>
            <button
              className="icon-button"
              type="button"
              title="关闭编辑"
              aria-label="关闭编辑"
              onClick={onCancelTaskEditor}
            >
              <X size={18} />
            </button>
          </div>
          <label className="task-editor-title">
            <span>任务名称</span>
            <input
              value={taskEditor.title}
              onChange={(event) => onTaskEditorChange({ ...taskEditor, title: event.target.value })}
              placeholder="例如：完成数学练习册第 5 页"
            />
          </label>
          <div className="task-editor-grid">
            <label>
              <span>科目</span>
              <select
                value={taskEditor.subject}
                onChange={(event) =>
                  onTaskEditorChange({ ...taskEditor, subject: event.target.value as Subject })
                }
              >
                <option value="math">数学</option>
                <option value="chinese">语文</option>
                <option value="english">英语</option>
                <option value="reading">阅读</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label>
              <span>预计分钟</span>
              <input
                type="number"
                min="1"
                max="90"
                value={taskEditor.estimatedMinutes}
                onChange={(event) =>
                  onTaskEditorChange({
                    ...taskEditor,
                    estimatedMinutes: Number(event.target.value) || 5,
                  })
                }
              />
            </label>
          </div>
          <div className="priority-picker" aria-label="任务优先级">
            {([1, 2, 3] as const).map((priority) => (
              <button
                key={priority}
                className={taskEditor.priority === priority ? "active" : ""}
                type="button"
                onClick={() => onTaskEditorChange({ ...taskEditor, priority })}
              >
                {priority === 1 ? "优先做" : priority === 2 ? "普通" : "后做"}
              </button>
            ))}
          </div>
          <button className="primary-button gold full" type="button" onClick={onSaveTaskEditor}>
            <Save size={17} />
            保存任务
          </button>
        </section>
      )}

      <div className="panel-card">
        <div className="progress-row">
          <span>今日进度</span>
          <strong>
            {completed} / {tasks.length}
          </strong>
        </div>
        <ProgressBar value={progress} />
        <div className="positive-toast">
          <Volume2 size={15} />
          {taskFeedback}
        </div>
      </div>

      <div className="task-list-heading">
        <SectionHeader title="今日待办清单" />
        <button
          className="icon-button add-task-button"
          type="button"
          title="新增任务"
          aria-label="新增任务"
          onClick={() => onOpenTaskEditor()}
        >
          <Plus size={19} />
        </button>
      </div>
      {selectedTask && (
        <div className="task-selection-toolbar">
          <span>已选择 1 项</span>
          <div>
            <button
              className="icon-button"
              type="button"
              title="编辑任务"
              aria-label={`编辑任务：${selectedTask.title}`}
              onClick={() => onOpenTaskEditor(selectedTask)}
            >
              <Pencil size={16} />
            </button>
            <button
              className="icon-button danger"
              type="button"
              title="删除任务"
              aria-label={`删除任务：${selectedTask.title}`}
              onClick={() => onDeleteTask(selectedTask.id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
      <div className={draggingTaskId ? "task-list task-list-large sorting" : "task-list task-list-large"}>
        {tasks.length === 0 ? (
          <div className="task-list-empty">请输入今日的任务，或点击右上角新增一项任务。</div>
        ) : null}
        {tasks.map((task) => {
          const meta = subjectMeta[task.subject];
          const isDone = Boolean(task.completedAt);
          const isSelected = selectedTask?.id === task.id;

          return (
            <article
              key={task.id}
              ref={(element) => {
                onTaskItemRef(task.id, element);
              }}
              data-task-id={task.id}
              className={[
                isDone ? "task-item done" : "task-item",
                celebratedTaskId === task.id ? "celebrate" : "",
                draggingTaskId === task.id ? "dragging" : "",
                isSelected ? "selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                className="drag-grip"
                type="button"
                aria-label="按住拖动排序"
                onClick={(event) => event.preventDefault()}
                onContextMenu={(event) => event.preventDefault()}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onDragStartTask(task.id);
                }}
                onPointerMove={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDragAtPoint(event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  onDragEndTask();
                }}
                onPointerCancel={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  onDragEndTask();
                }}
              >
                <GripVertical size={16} />
              </button>
              <span className={`subject-tag ${meta.className}`}>{meta.label}</span>
              <button
                className="task-info task-select"
                type="button"
                onClick={() => onSelectTask(task.id)}
                disabled={isDone}
                aria-label={`选择任务：${task.title}`}
              >
                <strong>{task.title}</strong>
                <span>预计 {task.estimatedMinutes} 分钟</span>
              </button>
              <button
                className={isDone ? "slide-toggle on" : "slide-toggle"}
                type="button"
                onClick={() => onToggleTask(task.id)}
                aria-label={isDone ? "标记未完成" : "滑动确认完成"}
              >
                <span />
              </button>
            </article>
          );
        })}
      </div>
      <button
        className="task-start-button"
        type="button"
        disabled={!selectedTask}
        onClick={() => selectedTask && onStartFocus(selectedTask.id)}
      >
        <span className="task-start-symbol" aria-hidden="true">▶</span>
        <span className="task-start-copy">
          <strong>
            {selectedTask ? (isResumingSelectedTask ? "继续专注" : "开始专注作业") : tasks.length === 0 ? "请先添加任务" : "今日任务已全部完成"}
          </strong>
          <em>
            {selectedTask
              ? isResumingSelectedTask && resumableSeconds !== null
                ? `剩余：${formatTimer(resumableSeconds)}`
                : `当前：${selectedTask.title}`
              : tasks.length === 0
                ? "输入任务后再开始专注"
                : "给自己一点放松时间"}
          </em>
        </span>
      </button>
    </section>
  );
}

function FocusView({
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
  onRestartTimer,
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
  onRestartTimer: () => void;
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
                <button className="focus-secondary-action" type="button" onClick={onRestartTimer}>
                  <span aria-hidden="true">✕</span>
                  重置
                </button>
                <button
                  className="primary-button purple full"
                  type="button"
                  onClick={onToggleTimer}
                  disabled={!canRun}
                >
                  <span className="focus-action-glyph" aria-hidden="true">{timerRunning ? "⏸" : "▶"}</span>
                  {timerRunning ? "暂停" : "开始专注"}
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

function FocusCompletionOverlay({
  focusTask,
  focusMode,
  focusRoundSeconds,
  onExtendTimer,
  onCompleteTask,
  onGoToTasks,
}: {
  focusTask: HomeworkTask | null;
  focusMode: FocusMode;
  focusRoundSeconds: number;
  onExtendTimer: () => void;
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
          <strong className="focus-completion-title">番茄完成！</strong>
          <span className="focus-completion-sub">本轮专注结束<br />你刚才在做这项任务：</span>
          <div className="focus-completion-task-box">
            <strong>{focusTask?.title}</strong>
            <span>{focusSubject?.label ?? "任务"} · 本轮专注 {Math.ceil(focusRoundSeconds / 60)} 分钟</span>
          </div>
          <div className="focus-completion-actions">
            <button className="primary-button green" type="button" onClick={onCompleteTask}>
              <span aria-hidden="true">✅</span>
              这项任务完成了！
            </button>
            <button className="focus-overlay-purple" type="button" onClick={onExtendTimer}>
              <span aria-hidden="true">⏱</span>
              还没完，再来一个番茄
            </button>
            <button className="focus-overlay-ghost" type="button" onClick={onGoToTasks}>
              跳过确认，回到任务清单
            </button>
          </div>
        </>
      ) : (
        <>
          <strong className="focus-completion-title">番茄完成！</strong>
          <span className="focus-completion-sub">这一轮专注结束<br />先喝口水，准备好再开下一轮。</span>
          <div className="focus-completion-actions">
            <button className="focus-overlay-purple" type="button" onClick={onExtendTimer}>
              ⏱ 再来一个番茄
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

function GamesView({ userId }: { userId: string }) {
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

function WalletView({
  userId,
  isParentSession,
  fallbackChild,
  parentProfile,
  childProfile,
  onWalletChanged,
}: {
  userId: string;
  isParentSession: boolean;
  fallbackChild: { name: string; grade: string; avatar: string };
  parentProfile: ParentProfileSummary | null;
  childProfile: ChildProfileSummary | null;
  onWalletChanged: () => void;
}) {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [syncStatus, setSyncStatus] = useState<"loading" | "live" | "offline" | "saving">("loading");
  const [filter, setFilter] = useState<"all" | "reward" | "deduct" | "pending">("all");
  const [sendType, setSendType] = useState<WalletEntryType>("reward");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<WalletEvidence | null>(null);
  const [entryEvidenceUploading, setEntryEvidenceUploading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [successEntry, setSuccessEntry] = useState<WalletEntry | null>(null);
  const [appealDraftEntry, setAppealDraftEntry] = useState<WalletEntry | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [appealEvidence, setAppealEvidence] = useState<WalletEvidence | null>(null);
  const [appealEvidenceUploading, setAppealEvidenceUploading] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState<"entry" | "appeal" | null>(null);
  const [appealProgressEntry, setAppealProgressEntry] = useState<WalletEntry | null>(null);
  const [reviewEntry, setReviewEntry] = useState<WalletEntry | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [previewEvidence, setPreviewEvidence] = useState<WalletEvidence | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);

  const loadWallet = useCallback(() => {
    setSyncStatus((current) => (current === "saving" ? "saving" : "loading"));
    void fetchWalletSummary(userId)
      .then((nextSummary) => {
        setSummary(nextSummary);
        setSyncStatus("live");
      })
      .catch(() => {
        setSyncStatus("offline");
      });
  }, [userId]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const child = summary?.child ?? parentProfile?.child ?? {
    userId,
    name: childProfile?.childName ?? fallbackChild.name,
    grade: childProfile?.childGrade ?? fallbackChild.grade,
    avatar: childProfile?.childAvatar ?? fallbackChild.avatar,
    joined: true,
  };
  const entries = summary?.entries ?? [];
  const pendingEntries = entries.filter((entry) => entry.status === "pending");
  const firstPending = pendingEntries[0] ?? null;
  const appealingEntries = entries.filter((entry) => entry.status === "appealing");
  const latestAppealEntry =
    entries.find((entry) => entry.type === "deduct" && Boolean(entry.appealReason) && entry.status === "appealing") ??
    entries.find((entry) => entry.type === "deduct" && Boolean(entry.appealReason)) ??
    null;
  const visibleAppealProgressEntry = appealProgressEntry
    ? entries.find((entry) => entry.id === appealProgressEntry.id) ?? appealProgressEntry
    : null;
  const filteredEntries = entries.filter((entry) => {
    if (filter === "all") return true;
    if (filter === "pending") return entry.status === "pending";
    return entry.type === filter;
  });
  const stats = summary?.stats ?? {
    monthlyRewardAmount: parentProfile?.stats.monthlyRewardAmount ?? childProfile?.stats.walletBalance ?? 0,
    monthlyDeductAmount: parentProfile?.stats.monthlyDeductAmount ?? 0,
    monthlyRewardCount: parentProfile?.stats.monthlyRewards ?? 0,
    monthlyDeductCount: parentProfile?.stats.monthlyDeductions ?? 0,
    pendingAmount: parentProfile?.stats.pendingRewardAmount ?? 0,
    pendingCount: parentProfile?.stats.pendingRewardCount ?? 0,
  };
  const balance = summary?.balance ?? parentProfile?.stats.walletBalance ?? childProfile?.stats.walletBalance ?? 0;
  const balanceParts = splitMoney(balance);
  const weekBuckets = summary?.weekBuckets ?? fallbackWalletBuckets();
  const maxWeekAmount = Math.max(
    1,
    ...weekBuckets.map((bucket) => Math.max(bucket.rewardAmount, bucket.deductAmount)),
  );
  const amount = Number(amountText);
  const reasonPresets =
    sendType === "reward"
      ? ["考试成绩好", "完成作业", "帮忙做家务", "表现优秀", "达成目标"]
      : ["超时玩游戏", "没完成作业", "说谎", "顶嘴不礼貌", "违反约定"];

  const uploadEvidenceFile = useCallback(
    (kind: WalletEvidenceKind, file: File, target: "entry" | "appeal") => {
      const setUploading = target === "entry" ? setEntryEvidenceUploading : setAppealEvidenceUploading;
      const setEvidence = target === "entry" ? setSelectedEvidence : setAppealEvidence;
      setUploading(true);
      setFeedback(kind === "audio" ? "正在上传录音..." : kind === "video" ? "正在上传视频..." : "正在上传照片...");
      void fileToBase64(file)
        .then((dataBase64) =>
          uploadWalletEvidence({
            userId,
            kind,
            fileName: file.name || `${kind}-${Date.now()}`,
            mimeType: file.type || fallbackEvidenceMimeType(kind),
            dataBase64,
          }),
        )
        .then((evidence) => {
          setEvidence(evidence);
          setFeedback(`${evidence.label}已上传，可以随这笔记录一起保存`);
        })
        .catch((error) => {
          setFeedback(error instanceof Error ? error.message : "附件上传失败，请稍后再试");
        })
        .finally(() => {
          setUploading(false);
        });
    },
    [userId],
  );

  const startEvidenceRecording = useCallback(
    (target: "entry" | "appeal") => {
      if (recordingTarget) return;
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setFeedback("当前浏览器不能直接录音，可以先用手机录音后选择音频文件上传");
        return;
      }

      void navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const recorder = new MediaRecorder(stream);
          recorderChunksRef.current = [];
          recorderRef.current = recorder;
          setRecordingTarget(target);
          setFeedback("正在录音，讲完后点停止");

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              recorderChunksRef.current.push(event.data);
            }
          };
          recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            const mimeType = recorder.mimeType || "audio/webm";
            const blob = new Blob(recorderChunksRef.current, { type: mimeType });
            const audioFile = new File([blob], `wallet-audio-${Date.now()}.webm`, { type: mimeType });
            recorderRef.current = null;
            recorderChunksRef.current = [];
            setRecordingTarget(null);
            uploadEvidenceFile("audio", audioFile, target);
          };
          recorder.start();
        })
        .catch(() => {
          setRecordingTarget(null);
          setFeedback("没有获得麦克风权限，先检查浏览器权限设置");
        });
    },
    [recordingTarget, uploadEvidenceFile],
  );

  const stopEvidenceRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const sendWalletEntry = () => {
    const trimmedReason = reason.trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      setFeedback("请输入金额");
      return;
    }
    if (!trimmedReason) {
      setFeedback("请填写具体原因");
      return;
    }

    setSyncStatus("saving");
    setFeedback(sendType === "reward" ? "正在发送奖励..." : "正在发起扣款...");
    createWalletEntry({
      userId,
      childUserId: child.userId,
      type: sendType,
      amount,
      reason: trimmedReason,
      evidence: selectedEvidence,
    })
      .then((entry) => {
        setSuccessEntry(entry);
        setAmountText("");
        setReason("");
        setSelectedEvidence(null);
        setFeedback(sendType === "reward" ? "奖励已发送，等待孩子确认领取" : "扣款申请已发送，等待孩子确认");
        loadWallet();
        onWalletChanged();
      })
      .catch(() => {
        setSyncStatus("offline");
        setFeedback("零花钱记录暂时没有同步成功，请检查后端服务");
      });
  };

  const resolvePending = (entry: WalletEntry, status: "approved" | "appealing", appeal?: { reason: string; evidence?: WalletEvidence | null }) => {
    setSyncStatus("saving");
    resolveWalletEntry(entry.id, {
      userId,
      status,
      appealReason: appeal?.reason,
      appealEvidence: appeal?.evidence,
    })
      .then(() => {
        setFeedback(status === "approved" ? "已确认，余额已更新" : "已提交异议，等待家长处理");
        setAppealDraftEntry(null);
        setAppealReason("");
        setAppealEvidence(null);
        loadWallet();
        onWalletChanged();
      })
      .catch(() => {
        setSyncStatus("offline");
        setFeedback("这笔记录暂时无法处理，请稍后再试");
      });
  };

  const submitAppeal = () => {
    if (!appealDraftEntry) return;
    const trimmedReason = appealReason.trim();
    if (trimmedReason.length < 2) {
      setFeedback("请先写下你的异议原因");
      return;
    }
    resolvePending(appealDraftEntry, "appealing", {
      reason: trimmedReason,
      evidence: appealEvidence,
    });
  };

  const reviewAppeal = (entry: WalletEntry, status: "approved" | "cancelled") => {
    setSyncStatus("saving");
    reviewWalletEntry(entry.id, {
      userId,
      status,
      resolutionNote: reviewNote.trim(),
    })
      .then(() => {
        setFeedback(status === "approved" ? "已维持扣款，孩子端会看到处理结果" : "已取消扣款，这笔不会影响孩子余额");
        setReviewEntry(null);
        setReviewNote("");
        loadWallet();
        onWalletChanged();
      })
      .catch(() => {
        setSyncStatus("offline");
        setFeedback("异议处理暂时没有同步成功，请稍后再试");
      });
  };

  if (isParentSession) {
    return (
      <section className="wallet-template-view parent-wallet-view">
        <div className="wallet-template-header">
          <div>
            <div className="wallet-header-kicker">{walletMonthLabel(summary?.updatedAt)}</div>
            <div className="wallet-header-title">发<span>零花钱</span></div>
          </div>
          <div className="wallet-header-side">
            <div className="wallet-parent-avatar">👨</div>
          </div>
        </div>

        <div className="recipient-card">
          <span className="rc-glow" />
          <div className="rc-av">{child.avatar}</div>
          <div className="rc-info">
            <div className="rc-name">{child.name}</div>
            <div className="rc-grade">{child.grade} · {child.joined ? "孩子账号" : "待加入账号"}</div>
            <div className="rc-balance">当前余额 <span className="rc-balance-val">¥{formatWalletAmount(balance)}</span></div>
          </div>
          <div className="rc-side">
            <span>本月获奖</span>
            <strong>{stats.monthlyRewardCount}次</strong>
          </div>
        </div>

        {appealingEntries.length > 0 ? (
          <div className="parent-appeal-inbox">
            <div className="pai-head">
              <span>⚠️</span>
              <div>
                <strong>{appealingEntries.length} 笔异议待处理</strong>
                <p>孩子提交了说明，处理前不会影响余额。</p>
              </div>
            </div>
            <div className="pai-list">
              {appealingEntries.slice(0, 3).map((entry) => (
                <button
                  className="pai-item"
                  type="button"
                  key={entry.id}
                  onClick={() => {
                    setReviewEntry(entry);
                    setReviewNote(entry.resolutionNote ?? "");
                  }}
                >
                  <span>{walletEntryAmount(entry)}</span>
                  <strong>{entry.reason}</strong>
                  <em>查看详情</em>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="type-sw">
          <button className={sendType === "reward" ? "ts-btn ts-reward on" : "ts-btn ts-reward"} type="button" onClick={() => setSendType("reward")}>
            <div className="ts-btn-icon">🎁</div>
            <div className="ts-btn-label">发奖励</div>
            <div className="ts-btn-sub">表扬好行为</div>
          </button>
          <button className={sendType === "deduct" ? "ts-btn ts-deduct on" : "ts-btn ts-deduct"} type="button" onClick={() => setSendType("deduct")}>
            <div className="ts-btn-icon">⚠️</div>
            <div className="ts-btn-label">扣零花钱</div>
            <div className="ts-btn-sub">需孩子同意</div>
          </button>
        </div>

        <label className={`amount-input-wrap ${sendType}-mode`}>
          <div className="ai-amount-line">
            <span className="ai-currency">¥</span>
            <input
              className={`ai-value ai-input ${sendType}-mode`}
              value={amountText}
              onChange={(event) => setAmountText(sanitizeWalletAmountInput(event.target.value))}
              inputMode="decimal"
              placeholder="0"
              aria-label="金额"
            />
          </div>
          <div className="ai-hint">{sendType === "reward" ? "表扬好行为 · 填写奖励金额" : "扣款需孩子同意 · 填写扣款金额"}</div>
        </label>

        <div className="quick-amounts">
          {["5", "10", "20", "50", "100"].map((value) => (
            <button
              key={value}
              type="button"
              className={amountText === value ? `qa-chip sel-${sendType}` : "qa-chip"}
              onClick={() => setAmountText(value)}
            >
              ¥{value}
            </button>
          ))}
        </div>

        <div className="reason-section">
          <div className="rs-label">说明原因</div>
          <div className="reason-presets">
            {reasonPresets.map((preset) => (
              <button className={reason === preset ? "rp sel" : "rp"} type="button" key={preset} onClick={() => setReason(preset)}>
                {preset}
              </button>
            ))}
          </div>
          <textarea
            className="reason-inp"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="写下具体原因，孩子会看到..."
          />
        </div>

        <div className="evidence-section">
          <div className="ev-label">上传证据（可选）</div>
          <WalletEvidenceUploader
            value={selectedEvidence}
            uploading={entryEvidenceUploading}
            recording={recordingTarget === "entry"}
            disabled={syncStatus === "saving"}
            onFile={(kind, file) => uploadEvidenceFile(kind, file, "entry")}
            onStartRecording={() => startEvidenceRecording("entry")}
            onStopRecording={stopEvidenceRecording}
          />
        </div>

        <div className="consent-notice">
          <span className="cn-icon">💡</span>
          <div className="cn-txt">发送后孩子会收到通知，<strong>需要孩子点击同意</strong>才会生效。孩子有权查看原因并申诉。</div>
        </div>

        <button className={`send-btn ${sendType}`} type="button" onClick={sendWalletEntry} disabled={syncStatus === "saving" || entryEvidenceUploading || recordingTarget === "entry"}>
          <span>{sendType === "reward" ? "🎁" : "⚠️"}</span>
          {entryEvidenceUploading ? "正在上传证据..." : syncStatus === "saving" ? "正在同步..." : sendType === "reward" ? "发送奖励" : "发起扣款"}
        </button>
        {feedback ? <div className="wallet-feedback">{feedback}</div> : null}

        <div className="parent-sec-row wallet-history-row">
          <div className="parent-sec-title">最近发送记录</div>
          <button className="sec-m wallet-sec-action" type="button" onClick={() => setFilter("all")}>全部账单</button>
        </div>
        <WalletLedgerList entries={entries.slice(0, 4)} emptyText={syncStatus === "loading" ? "正在加载账单..." : "暂无发送记录"} onPreviewEvidence={setPreviewEvidence} />

        {successEntry ? (
          <WalletSuccessOverlay
            entry={successEntry}
            childName={child.name}
            onClose={() => setSuccessEntry(null)}
            onAgain={() => {
              setSuccessEntry(null);
              setAmountText("");
            }}
          />
        ) : null}
        {reviewEntry ? (
          <WalletParentReviewDialog
            entry={reviewEntry}
            note={reviewNote}
            saving={syncStatus === "saving"}
            onNoteChange={setReviewNote}
            onClose={() => setReviewEntry(null)}
            onApprove={() => reviewAppeal(reviewEntry, "approved")}
            onCancelDeduct={() => reviewAppeal(reviewEntry, "cancelled")}
            onPreviewEvidence={setPreviewEvidence}
          />
        ) : null}
        {previewEvidence ? <WalletEvidenceViewer evidence={previewEvidence} onClose={() => setPreviewEvidence(null)} /> : null}
      </section>
    );
  }

  return (
    <section className="wallet-template-view child-wallet-view">
      <div className="wallet-template-header">
        <div>
          <div className="wallet-header-kicker">{walletMonthLabel(summary?.updatedAt)}</div>
          <div className="wallet-header-title">我的<span>零花钱</span></div>
        </div>
        <div className="wallet-header-side">
          <div className="wallet-child-avatar">{child.avatar}</div>
        </div>
      </div>

      <div className="balance-hero">
        <span className="bh-glow1" />
        <span className="bh-glow2" />
        <span className="bh-shimmer" />
        <div className="bh-label">当前余额</div>
        <div className="bh-amount-row">
          <span className="bh-currency">¥</span>
          <span className="bh-amount">{balanceParts.major}</span>
          <span className="bh-cents">.{balanceParts.cents}</span>
        </div>
        <div className="bh-sub">{syncStatus === "offline" ? "离线数据，稍后自动同步" : `上次更新 ${walletUpdatedLabel(summary?.updatedAt)} · 零花钱会一直保留`}</div>
        <div className="bh-stats">
          <button className="bhs" type="button" onClick={() => setFilter("reward")}>
            <strong className="green">+¥{formatWalletAmount(stats.monthlyRewardAmount)}</strong>
            <span>本月获得</span>
          </button>
          <button className="bhs" type="button" onClick={() => setFilter("deduct")}>
            <strong className="coral">-¥{formatWalletAmount(stats.monthlyDeductAmount)}</strong>
            <span>本月扣款</span>
          </button>
          <button className="bhs" type="button" onClick={() => setFilter("pending")}>
            <strong className="gold">{stats.monthlyRewardCount}次</strong>
            <span>本月获奖</span>
          </button>
        </div>
      </div>

      {firstPending ? (
        <div className="pending-award">
          <span className="pa-shimmer" />
          <div className="pa-header">
            <span className="pa-blink" />
            <div className="pa-label">{firstPending.type === "reward" ? "🎁 有一笔奖励在等你确认" : "⚠️ 有一笔扣款在等你确认"}</div>
          </div>
          <div className="pa-body">
            <div className="pa-reason">{firstPending.type === "reward" ? "🏆 " : "⚠️ "}{firstPending.reason}</div>
            <div className="pa-from">
              {firstPending.initiatorName} · {formatWalletDate(firstPending.createdAt)}
              {firstPending.evidence ? <button className="pa-evid-chip" type="button" onClick={() => setPreviewEvidence(firstPending.evidence ?? null)}>{walletEvidenceIcon(firstPending.evidence)} {walletEvidenceName(firstPending.evidence)}</button> : null}
            </div>
          </div>
          <div className="pa-amount-row">
            <span className="pa-amt-label">{firstPending.type === "reward" ? "奖励金额" : "扣款金额"}</span>
            <strong className={firstPending.type === "reward" ? "pa-amt green" : "pa-amt coral"}>{walletEntryAmount(firstPending)}</strong>
          </div>
          <div className="pa-btns">
            <button className="pa-agree" type="button" onClick={() => resolvePending(firstPending, "approved")}>
              {firstPending.type === "reward" ? "✅ 同意，我领了！" : "✅ 同意扣款"}
            </button>
            {firstPending.type === "deduct" ? (
              <button
                className="pa-view-evid"
                type="button"
                onClick={() => {
                  setAppealDraftEntry(firstPending);
                  setAppealReason("");
                  setAppealEvidence(null);
                }}
              >
                🙋 有异议
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="parent-sec-row">
        <div className="parent-sec-title">本月收支</div>
        <button className="sec-m wallet-sec-action" type="button">年度报告</button>
      </div>
      <div className="month-chart">
        <div className="mc-head">
          <div className="mc-title">收支趋势</div>
          <div className="mc-sub">{walletMonthLabel(summary?.updatedAt)} · 按周</div>
        </div>
        <div className="mc-chart-area">
          {weekBuckets.map((bucket) => (
            <div className="mc-col" key={bucket.label}>
              <div className="mc-bar-wrap">
                {bucket.rewardAmount > 0 ? (
                  <div className="mc-bar earn" style={{ height: `${Math.max(5, Math.round((bucket.rewardAmount / maxWeekAmount) * 100))}%` }}>
                    <span>¥{formatWalletAmount(bucket.rewardAmount)}</span>
                  </div>
                ) : null}
                {bucket.deductAmount > 0 ? (
                  <div className="mc-bar spend" style={{ height: `${Math.max(5, Math.round((bucket.deductAmount / maxWeekAmount) * 100))}%` }}>
                    <span>¥{formatWalletAmount(bucket.deductAmount)}</span>
                  </div>
                ) : null}
              </div>
              <div className={bucket.current ? "mc-lbl current" : "mc-lbl"}>{bucket.label}</div>
            </div>
          ))}
        </div>
        <div className="mc-legend">
          <div className="mc-leg-item"><span className="mc-leg-dot earn" />获得</div>
          <div className="mc-leg-item"><span className="mc-leg-dot spend" />扣款</div>
        </div>
      </div>

      {latestAppealEntry ? (
        <div className={`appeal-card ${latestAppealEntry.status === "appealing" ? "active" : "resolved"}`}>
          <div className="ac-head">
            <span className="ac-icon">{latestAppealEntry.status === "appealing" ? "⚠️" : latestAppealEntry.status === "cancelled" ? "🛡️" : "⚖️"}</span>
            <div className="ac-title">{walletAppealStatusTitle(latestAppealEntry)}</div>
          </div>
          <div className="ac-body">{walletAppealStatusBody(latestAppealEntry)}</div>
          <button className="ac-btn" type="button" onClick={() => setAppealProgressEntry(latestAppealEntry)}>
            {latestAppealEntry.status === "appealing" ? "查看申诉进度" : "查看处理结果"} →
          </button>
        </div>
      ) : null}

      <button className="spend-btn" type="button" onClick={() => setFeedback("消费记录会由家长和孩子一起确认")}>
        <span>📝</span> 记录一次消费
      </button>
      {feedback ? <div className="wallet-feedback">{feedback}</div> : null}

      <div className="parent-sec-row">
        <div className="parent-sec-title">账单记录</div>
        <button className="sec-m wallet-sec-action" type="button" onClick={loadWallet}>{syncStatus === "loading" ? "同步中" : "筛选"}</button>
      </div>
      <div className="ledger-tabs">
        {[
          ["all", "全部"],
          ["reward", "获得"],
          ["deduct", "扣款"],
          ["pending", "待确认"],
        ].map(([id, label]) => (
          <button className={filter === id ? "lt on" : "lt"} type="button" key={id} onClick={() => setFilter(id as typeof filter)}>
            {label}
          </button>
        ))}
      </div>
      <WalletLedgerList entries={filteredEntries} emptyText={syncStatus === "loading" ? "正在加载账单..." : "暂无记录"} onPreviewEvidence={setPreviewEvidence} />
      {appealDraftEntry ? (
        <WalletAppealDialog
          entry={appealDraftEntry}
          reason={appealReason}
          evidence={appealEvidence}
          uploading={appealEvidenceUploading}
          recording={recordingTarget === "appeal"}
          saving={syncStatus === "saving"}
          onReasonChange={setAppealReason}
          onFile={(kind, file) => uploadEvidenceFile(kind, file, "appeal")}
          onStartRecording={() => startEvidenceRecording("appeal")}
          onStopRecording={stopEvidenceRecording}
          onClose={() => setAppealDraftEntry(null)}
          onSubmit={submitAppeal}
        />
      ) : null}
      {visibleAppealProgressEntry ? (
        <WalletAppealProgressDialog
          entry={visibleAppealProgressEntry}
          onClose={() => setAppealProgressEntry(null)}
        />
      ) : null}
      {previewEvidence ? <WalletEvidenceViewer evidence={previewEvidence} onClose={() => setPreviewEvidence(null)} /> : null}
    </section>
  );
}

function WalletEvidenceUploader({
  value,
  uploading,
  recording,
  disabled,
  compact = false,
  onFile,
  onStartRecording,
  onStopRecording,
}: {
  value: WalletEvidence | null;
  uploading: boolean;
  recording: boolean;
  disabled?: boolean;
  compact?: boolean;
  onFile: (kind: WalletEvidenceKind, file: File) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const canRecordAudio =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined";

  const handleFile = (kind: WalletEvidenceKind, file?: File) => {
    if (!file) return;
    onFile(kind, file);
  };

  return (
    <div className={compact ? "evidence-uploader compact" : "evidence-uploader"}>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          handleFile("photo", event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(event) => {
          handleFile("audio", event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        hidden
        onChange={(event) => {
          handleFile("video", event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <div className="ev-grid">
        <button className={value?.kind === "photo" ? "ev-item filled" : "ev-item"} type="button" disabled={disabled || uploading || recording} onClick={() => photoInputRef.current?.click()}>
          <span className="ev-icon">📷</span>
          <span className="ev-lbl">照片</span>
        </button>
        <button
          className={value?.kind === "audio" || recording ? "ev-item filled recording" : "ev-item"}
          type="button"
          disabled={disabled || uploading}
          onClick={() => {
            if (recording) {
              onStopRecording();
              return;
            }
            if (canRecordAudio) {
              onStartRecording();
              return;
            }
            audioInputRef.current?.click();
          }}
        >
          <span className="ev-icon">{recording ? "■" : "🎙️"}</span>
          <span className="ev-lbl">{recording ? "停止" : "录音"}</span>
        </button>
        <button className={value?.kind === "video" ? "ev-item filled" : "ev-item"} type="button" disabled={disabled || uploading || recording} onClick={() => videoInputRef.current?.click()}>
          <span className="ev-icon">🎬</span>
          <span className="ev-lbl">视频</span>
        </button>
      </div>
      {uploading ? <div className="ev-uploading">正在上传附件...</div> : null}
      {value ? <WalletEvidencePreview evidence={value} /> : <div className="ev-empty-hint">可补充照片、录音或视频，让这笔记录更清楚。</div>}
    </div>
  );
}

function WalletEvidencePreview({ evidence }: { evidence: WalletEvidence }) {
  return (
    <div className={`ev-preview ${evidence.kind}`}>
      <div className="ev-preview-media">
        {evidence.url && evidence.kind === "photo" ? <img src={evidence.url} alt={walletEvidenceName(evidence)} /> : null}
        {evidence.url && evidence.kind === "audio" ? <audio src={evidence.url} controls /> : null}
        {evidence.url && evidence.kind === "video" ? <video src={evidence.url} controls playsInline /> : null}
        {!evidence.url ? <span>{walletEvidenceIcon(evidence)}</span> : null}
      </div>
      <div className="ev-preview-copy">
        <strong>{walletEvidenceIcon(evidence)} {walletEvidenceName(evidence)}</strong>
        <span>{formatFileSize(evidence.size)} · 已上传</span>
      </div>
    </div>
  );
}

function WalletEvidenceViewer({
  evidence,
  onClose,
}: {
  evidence: WalletEvidence;
  onClose: () => void;
}) {
  const title = `${walletEvidenceIcon(evidence)} ${walletEvidenceName(evidence)}`;

  return (
    <div className="wallet-dialog-backdrop evidence-viewer-backdrop" onClick={onClose}>
      <section className="wallet-dialog evidence-viewer" onClick={(event) => event.stopPropagation()}>
        <div className="wd-head">
          <span>{walletEvidenceIcon(evidence)}</span>
          <div>
            <strong>{walletEvidenceName(evidence)}</strong>
            <p>{formatFileSize(evidence.size)} · {evidence.mimeType || evidence.label}</p>
          </div>
          <button className="wd-close" type="button" onClick={onClose}>×</button>
        </div>
        <div className={`evidence-viewer-media ${evidence.kind}`}>
          {evidence.kind === "photo" ? <img src={evidence.url} alt={title} /> : null}
          {evidence.kind === "video" ? <video src={evidence.url} controls playsInline /> : null}
          {evidence.kind === "audio" ? <audio src={evidence.url} controls /> : null}
          {!evidence.url ? <div className="evidence-viewer-empty">{title}</div> : null}
        </div>
        <div className="wd-actions">
          <button className="wd-secondary" type="button" onClick={onClose}>关闭</button>
          {evidence.url ? (
            <a className="wd-primary evidence-open-link" href={evidence.url} target="_blank" rel="noreferrer">
              新窗口打开
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function WalletAppealProgressDialog({
  entry,
  onClose,
}: {
  entry: WalletEntry;
  onClose: () => void;
}) {
  const isPending = entry.status === "appealing";
  const isCancelled = entry.status === "cancelled";
  const isMaintained = !isPending && !isCancelled;

  return (
    <div className="wallet-dialog-backdrop">
      <section className="wallet-dialog appeal-progress-dialog">
        <div className="wd-head">
          <span>{isPending ? "⏳" : isCancelled ? "🛡️" : "⚖️"}</span>
          <div>
            <strong>{walletAppealStatusTitle(entry)}</strong>
            <p>{isPending ? "家长还没有处理前，这笔扣款不会影响你的余额。" : "这是家长给你的处理结果。你可以和家长继续沟通。"}</p>
          </div>
          <button className="wd-close" type="button" onClick={onClose}>×</button>
        </div>

        <div className={`ap-status-card ${isCancelled ? "safe" : isMaintained ? "maintained" : "waiting"}`}>
          <span>{isPending ? "等待处理中" : isCancelled ? "扣款已取消" : "扣款已维持"}</span>
          <strong>{walletEntryAmount(entry)}</strong>
          <p>{entry.reason}</p>
        </div>

        <div className="ap-timeline">
          <div className="ap-step done">
            <span>1</span>
            <div>
              <strong>你已提交申诉</strong>
              <p>{entry.appealReason || "已说明自己的想法"}</p>
            </div>
          </div>
          <div className={`ap-step ${isPending ? "active" : "done"}`}>
            <span>2</span>
            <div>
              <strong>{isPending ? "等待家长查看" : "家长已查看"}</strong>
              <p>{isPending ? "家长处理前，这笔记录会停在申诉中。" : "家长已经给出处理决定。"}</p>
            </div>
          </div>
          <div className={`ap-step ${isPending ? "pending" : "done"}`}>
            <span>3</span>
            <div>
              <strong>{isPending ? "等待处理结果" : isCancelled ? "扣款取消" : "维持扣款"}</strong>
              <p>{isPending ? "处理完成后这里会显示家长的说明。" : entry.resolutionNote || walletAppealStatusBody(entry)}</p>
            </div>
          </div>
        </div>

        {entry.appealEvidence ? (
          <div className="ap-evidence">
            <span>你补充的证据</span>
            <WalletEvidencePreview evidence={entry.appealEvidence} />
          </div>
        ) : null}

        {entry.resolutionNote && !isPending ? (
          <div className="ap-note">
            <span>家长说明</span>
            <p>{entry.resolutionNote}</p>
          </div>
        ) : null}

        <button className="wd-primary full" type="button" onClick={onClose}>知道了</button>
      </section>
    </div>
  );
}

function WalletAppealDialog({
  entry,
  reason,
  evidence,
  uploading,
  recording,
  saving,
  onReasonChange,
  onFile,
  onStartRecording,
  onStopRecording,
  onClose,
  onSubmit,
}: {
  entry: WalletEntry;
  reason: string;
  evidence: WalletEvidence | null;
  uploading: boolean;
  recording: boolean;
  saving: boolean;
  onReasonChange: (value: string) => void;
  onFile: (kind: WalletEvidenceKind, file: File) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="wallet-dialog-backdrop">
      <section className="wallet-dialog">
        <div className="wd-head">
          <span>🙋</span>
          <div>
            <strong>提交扣款异议</strong>
            <p>先写下你的想法，家长处理前不会扣钱。</p>
          </div>
          <button className="wd-close" type="button" onClick={onClose}>×</button>
        </div>
        <div className="wd-entry-card">
          <span>扣款申请</span>
          <strong>{walletEntryAmount(entry)}</strong>
          <p>{entry.reason}</p>
        </div>
        <label className="wd-field">
          <span>你的异议原因</span>
          <textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={4}
            maxLength={360}
            placeholder="例如：今天是先完成作业后玩的，时间没有超时。"
          />
        </label>
        <div className="wd-field">
          <span>补充证据（可选）</span>
          <WalletEvidenceUploader
            value={evidence}
            uploading={uploading}
            recording={recording}
            disabled={saving}
            compact
            onFile={onFile}
            onStartRecording={onStartRecording}
            onStopRecording={onStopRecording}
          />
        </div>
        <div className="wd-actions">
          <button className="wd-secondary" type="button" onClick={onClose}>先不提交</button>
          <button className="wd-primary" type="button" onClick={onSubmit} disabled={saving || uploading || recording}>
            {uploading ? "证据上传中..." : saving ? "提交中..." : "提交给家长"}
          </button>
        </div>
      </section>
    </div>
  );
}

function WalletParentReviewDialog({
  entry,
  note,
  saving,
  onNoteChange,
  onClose,
  onApprove,
  onCancelDeduct,
  onPreviewEvidence,
}: {
  entry: WalletEntry;
  note: string;
  saving: boolean;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onCancelDeduct: () => void;
  onPreviewEvidence: (evidence: WalletEvidence) => void;
}) {
  return (
    <div className="wallet-dialog-backdrop">
      <section className="wallet-dialog parent-review-dialog">
        <div className="wd-head">
          <span>⚖️</span>
          <div>
            <strong>处理孩子的异议</strong>
            <p>处理结果会同步到孩子端，并决定这笔扣款是否生效。</p>
          </div>
          <button className="wd-close" type="button" onClick={onClose}>×</button>
        </div>
        <div className="wd-entry-card danger">
          <span>原扣款申请</span>
          <strong>{walletEntryAmount(entry)}</strong>
          <p>{entry.reason}</p>
          {entry.evidence ? (
            <button className="wd-evidence-link" type="button" onClick={() => onPreviewEvidence(entry.evidence as WalletEvidence)}>
              {walletEvidenceIcon(entry.evidence)} 家长证据：{walletEvidenceName(entry.evidence)}
            </button>
          ) : null}
        </div>
        <div className="wd-appeal-box">
          <span>孩子的说明</span>
          <p>{entry.appealReason || "孩子没有填写额外说明"}</p>
          {entry.appealEvidence ? (
            <button className="wd-evidence-link" type="button" onClick={() => onPreviewEvidence(entry.appealEvidence as WalletEvidence)}>
              补充证据：{walletEvidenceIcon(entry.appealEvidence)} {walletEvidenceName(entry.appealEvidence)}
            </button>
          ) : null}
        </div>
        <label className="wd-field">
          <span>给孩子的处理说明</span>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
            maxLength={360}
            placeholder="例如：我看到了你的说明，这次取消扣款；或者说明为什么仍然维持扣款。"
          />
        </label>
        <div className="wd-actions split">
          <button className="wd-secondary" type="button" onClick={onCancelDeduct} disabled={saving}>
            取消扣款
          </button>
          <button className="wd-primary coral" type="button" onClick={onApprove} disabled={saving}>
            {saving ? "处理中..." : "维持扣款"}
          </button>
        </div>
      </section>
    </div>
  );
}

function WalletLedgerList({
  entries,
  emptyText,
  onPreviewEvidence,
}: {
  entries: WalletEntry[];
  emptyText: string;
  onPreviewEvidence?: (evidence: WalletEvidence) => void;
}) {
  if (!entries.length) {
    return <div className="wallet-empty">{emptyText}</div>;
  }

  return (
    <div className="ledger-list">
      {entries.map((entry) => (
        <article className={`ledger-item ${entry.type === "reward" ? "earn" : "spend"} ${entry.status === "pending" ? "pending-item" : ""} ${entry.status === "appealing" ? "appeal-item" : ""}`} key={entry.id}>
          <div className="li-icon">{entry.type === "reward" ? "⭐" : "⚠️"}</div>
          <div className="li-info">
            <div className="li-reason">{entry.reason}</div>
            <div className="li-meta">
              <span className={`li-badge ${entry.status}`}>{walletStatusLabel(entry.status)}</span>
              {entry.evidence ? (
                <button className="li-badge evidence clickable" type="button" onClick={() => onPreviewEvidence?.(entry.evidence as WalletEvidence)}>
                  {walletEvidenceIcon(entry.evidence)} {walletEvidenceName(entry.evidence)}
                </button>
              ) : (
                <span className="li-badge evidence">{walletEvidenceLabel(entry)}</span>
              )}
              {entry.appealEvidence ? (
                <button className="li-badge evidence appeal-evidence clickable" type="button" onClick={() => onPreviewEvidence?.(entry.appealEvidence as WalletEvidence)}>
                  申诉 {walletEvidenceIcon(entry.appealEvidence)}
                </button>
              ) : null}
              <span className="li-date">{entry.initiatorName} · {formatWalletDate(entry.createdAt)}</span>
            </div>
          </div>
          <div className="li-right">
            <div className={entry.type === "reward" ? "li-amt green" : "li-amt coral"}>{walletEntryAmount(entry)}</div>
          </div>
        </article>
      ))}
    </div>
  );
}

function WalletSuccessOverlay({
  entry,
  childName,
  onClose,
  onAgain,
}: {
  entry: WalletEntry;
  childName: string;
  onClose: () => void;
  onAgain: () => void;
}) {
  const isReward = entry.type === "reward";
  return (
    <div className="success-overlay">
      <div className="so-coin">💰</div>
      <div className="so-title">{isReward ? "奖励已发送！" : "扣款申请已发送！"}</div>
      <div className="so-sub">{isReward ? `通知已发给${childName}，等他查看并确认领取` : `申请已发给${childName}，需要同意后生效`}</div>
      <div className="so-card">
        <div className="so-card-label">{isReward ? "奖励金额" : "扣款金额"}</div>
        <div className={isReward ? "so-card-amt green" : "so-card-amt coral"}>{walletEntryAmount(entry)}</div>
        <div className="so-card-to">{isReward ? `→ ${childName}零花钱账户` : `← ${childName}零花钱账户`}</div>
      </div>
      <button className="so-btn" type="button" onClick={onClose}>好的，回到页面</button>
      <button className="so-ghost" type="button" onClick={onAgain}>再发一笔</button>
    </div>
  );
}

function formatWalletAmount(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function sanitizeWalletAmountInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  if (!normalized) return "";
  const [rawInteger, ...decimalParts] = normalized.split(".");
  const integer = (rawInteger.replace(/^0+(?=\d)/, "") || "0").slice(0, 6);
  if (decimalParts.length === 0) return integer;
  return `${integer}.${decimalParts.join("").slice(0, 2)}`;
}

function splitMoney(value: number) {
  const [major, cents = "00"] = value.toFixed(2).split(".");
  return { major, cents };
}

function walletEntryAmount(entry: WalletEntry) {
  const sign = entry.type === "reward" ? "+" : "-";
  return `${sign}¥${formatWalletAmount(entry.amount)}`;
}

function walletStatusLabel(status: WalletEntry["status"]) {
  if (status === "approved") return "✓ 已同意";
  if (status === "appealing") return "申诉中";
  if (status === "cancelled") return "已取消";
  if (status === "resolved") return "已裁定";
  return "待确认";
}

function walletAppealStatusTitle(entry: WalletEntry) {
  if (entry.status === "appealing") return "你的申诉正在处理中";
  if (entry.status === "cancelled") return "申诉成功，扣款已取消";
  return "申诉已处理，家长维持扣款";
}

function walletAppealStatusBody(entry: WalletEntry) {
  if (entry.status === "appealing") return `关于「${entry.reason}」的申诉已提交，家长处理前不会影响余额。`;
  if (entry.status === "cancelled") return `关于「${entry.reason}」的扣款已取消，不会影响你的余额。`;
  return `关于「${entry.reason}」的申诉已处理，家长维持这笔扣款。`;
}

function formatWalletDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function walletMonthLabel(value?: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${safeDate.getMonth() + 1}月 · ${safeDate.getFullYear()}`;
}

function walletUpdatedLabel(value?: string) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (diffDays === 0) return "刚刚";
  return `${diffDays} 天前`;
}

function walletEvidenceLabel(entry: WalletEntry) {
  if (entry.status === "appealing") return "🙋 异议";
  if (entry.status === "cancelled") return "🛡️ 未扣款";
  if (entry.status === "pending") return "📎 待看";
  if (entry.evidence) return `${walletEvidenceIcon(entry.evidence)} ${walletEvidenceName(entry.evidence)}`;
  return entry.type === "reward" ? "📷 照片" : "🎙️ 录音";
}

function walletEvidenceIcon(evidence: WalletEvidence | string) {
  const kind = typeof evidence === "string" ? (evidence.includes("录音") ? "audio" : evidence.includes("视频") ? "video" : "photo") : evidence.kind;
  if (kind === "audio") return "🎙️";
  if (kind === "video") return "🎬";
  return "📷";
}

function walletEvidenceName(evidence: WalletEvidence | string) {
  if (typeof evidence === "string") return evidence;
  return evidence.label || evidence.fileName || "证据";
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function fallbackEvidenceMimeType(kind: WalletEvidenceKind) {
  if (kind === "audio") return "audio/webm";
  if (kind === "video") return "video/mp4";
  return "image/jpeg";
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("读取附件失败"));
    reader.readAsDataURL(file);
  });
}

function fallbackWalletBuckets(): WalletSummary["weekBuckets"] {
  return [
    { label: "第1周", rewardAmount: 0, deductAmount: 0, current: false },
    { label: "第2周", rewardAmount: 0, deductAmount: 0, current: false },
    { label: "第3周", rewardAmount: 0, deductAmount: 0, current: false },
    { label: "本周", rewardAmount: 0, deductAmount: 0, current: true },
  ];
}

function MemoryView({
  memoryText,
  memoryMood,
  memorySummary,
  memorySyncStatus,
  onMemoryText,
  onMemoryMood,
  onSaveMemory,
}: {
  memoryText: string;
  memoryMood: string;
  memorySummary: MoodShareSummary | null;
  memorySyncStatus: MemorySyncStatus;
  onMemoryText: (value: string) => void;
  onMemoryMood: (value: string) => void;
  onSaveMemory: () => void;
}) {
  const syncText =
    memorySyncStatus === "saving"
      ? "保存中"
      : memorySyncStatus === "loading"
        ? "同步中"
        : memorySyncStatus === "offline"
          ? "离线"
          : "已同步";
  const records = memorySummary?.items ?? [];
  const canSave = memoryText.trim().length > 0 && memorySyncStatus !== "saving";

  return (
    <section className="view-stack">
      <div className="memory-input-card">
        <div className="memory-input-head">
          <span className="label-dot">心情分享</span>
          <em className={memorySyncStatus === "offline" ? "memory-sync offline" : "memory-sync"}>{syncText}</em>
        </div>
        <div className="mood-picker" aria-label="选择心情">
          {moodOptions.map((item) => (
            <button
              key={item.mood}
              className={memoryMood === item.mood ? "mood-chip active" : "mood-chip"}
              type="button"
              onClick={() => onMemoryMood(item.mood)}
              aria-label={item.label}
            >
              <span aria-hidden="true">{item.mood}</span>
              <em>{item.label}</em>
            </button>
          ))}
        </div>
        <textarea
          value={memoryText}
          onChange={(event) => onMemoryText(event.target.value)}
          placeholder="今天心情怎么样？可以写给爸爸妈妈，也可以写给自己。"
          maxLength={240}
        />
        <div className="memory-actions">
          <span>{memoryText.length}/240</span>
          <button className="primary-button compact" type="button" disabled={!canSave} onClick={onSaveMemory}>
            <Send size={16} />
            {memorySyncStatus === "saving" ? "保存中" : "分享"}
          </button>
        </div>
      </div>

      <SectionHeader title="家庭心情流" action={records.length ? `${records.length} 条` : "今天开始"} />
      <div className="memory-list">
        {records.length ? (
          records.map((memory) => (
            <article key={memory.id} className="memory-card">
              <div className="memory-card-head">
                <span className="memory-avatar" aria-hidden="true">{memory.authorAvatar}</span>
                <div>
                  <strong>{memory.authorName}</strong>
                  <span className="memory-meta">
                    {formatMemoryDate(memory.createdAt)}
                    <em>{memory.mood}</em>
                  </span>
                </div>
              </div>
              <p>{memory.content}</p>
              <footer>
                <strong>{memory.authorRole === "child" ? "孩子分享" : "家人回应"}</strong>
                <em>
                  <MoonStar size={12} />
                  已同步
                </em>
              </footer>
            </article>
          ))
        ) : (
          <div className="memory-empty-state">
            <span aria-hidden="true">🌙</span>
            <strong>还没有心情分享</strong>
            <p>从一句“今天我有点开心”开始，这里会慢慢长成家庭的小小心情日记。</p>
          </div>
        )}
      </div>
    </section>
  );
}

function formatMemoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const today = localDateString();
  const target = localDateString(date);
  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  if (target === today) return `今天 ${time}`;
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ParentProfileView({
  profile,
  profileSyncStatus,
  focusStats,
  fallback,
  onLogout,
  onSaveProfile,
}: {
  profile: ParentProfileSummary | null;
  profileSyncStatus: ProfileSyncStatus;
  focusStats: FocusStats;
  fallback: {
    displayName: string;
    familyName: string;
    inviteCode: string;
    childName: string;
    childGrade: string;
    childAvatar: string;
  };
  onLogout: () => void;
  onSaveProfile: (input: Omit<UpdateParentProfileInput, "userId">) => void;
}) {
  const displayName = profile?.displayName ?? fallback.displayName;
  const familyName = profile?.familyName ?? fallback.familyName;
  const inviteCode = profile?.inviteCode ?? fallback.inviteCode;
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
    companionStreakDays: 0,
    childFocusSecondsToday: 0,
    completedTasksToday: 0,
    totalTasksToday: 0,
  };
  const childFocusSecondsToday = Math.max(profile?.stats.childFocusSecondsToday ?? 0, focusStats.totalSecondsToday);
  const focusWeek = focusWeekWithToday(profile?.focusWeek ?? fallbackFocusWeek(), childFocusSecondsToday);
  const members = profile?.members ?? [
    { id: "parent", name: displayName, role: "parent" as const, roleLabel: "家长 · 管理员", avatar: "👨", badge: "家长" },
    { id: "child", name: child.name, role: "child" as const, roleLabel: `孩子 · ${child.grade}`, avatar: child.avatar, badge: child.joined ? "已加入" : "待加入" },
  ];
  const maxFocusSeconds = Math.max(1, ...focusWeek.map((day) => day.totalSeconds));
  const [nameDraft, setNameDraft] = useState(displayName);
  const [familyDraft, setFamilyDraft] = useState(familyName);
  const [profileFeedback, setProfileFeedback] = useState("");
  const parentSavePendingRef = useRef(false);
  const syncText =
    profileSyncStatus === "saving"
      ? "正在保存"
      : profileSyncStatus === "live"
        ? "已同步"
        : profileSyncStatus === "loading"
          ? "加载中"
          : "离线";

  useEffect(() => {
    setNameDraft(displayName);
    setFamilyDraft(familyName);
  }, [displayName, familyName]);

  useEffect(() => {
    if (!parentSavePendingRef.current) return;

    if (profileSyncStatus === "saving") {
      setProfileFeedback("正在保存...");
      return;
    }
    if (profileSyncStatus === "live") {
      parentSavePendingRef.current = false;
      setProfileFeedback("已保存");
      return;
    }
    if (profileSyncStatus === "offline") {
      parentSavePendingRef.current = false;
      setProfileFeedback("保存失败，请稍后重试");
    }
  }, [profileSyncStatus]);

  const saveName = () => {
    const nextName = nameDraft.trim();
    if (!nextName) {
      setProfileFeedback("昵称不能为空");
      return;
    }
    if (nextName === displayName) {
      setProfileFeedback("没有修改内容");
      return;
    }
    parentSavePendingRef.current = true;
    setProfileFeedback("正在保存...");
    onSaveProfile({ displayName: nextName });
  };
  const saveFamily = () => {
    const nextFamily = familyDraft.trim();
    if (!nextFamily) {
      setProfileFeedback("家庭名称不能为空");
      return;
    }
    if (nextFamily === familyName) {
      setProfileFeedback("没有修改内容");
      return;
    }
    parentSavePendingRef.current = true;
    setProfileFeedback("正在保存...");
    onSaveProfile({ familyName: nextFamily });
  };
  const copyInvite = async () => {
    try {
      await navigator.clipboard?.writeText(inviteCode);
      setProfileFeedback("邀请码已复制");
    } catch {
      setProfileFeedback("邀请码已显示，可手动复制");
    }
  };

  return (
    <section className="view-stack parent-profile-view">
      <div className="uc-hero uc-hero-parent">
        <span className={profileSyncStatus === "offline" ? "profile-sync-badge uc-hero-sync offline" : "profile-sync-badge uc-hero-sync"}>
          {syncText}
        </span>
        <div className="uc-av-wrap">
          <div className="uc-av uc-av-parent" aria-hidden="true">👨</div>
          <div>
            <div className="uc-name">{displayName}</div>
            <div className="uc-role-tag urt-parent">👑 家长 · 管理员</div>
          </div>
        </div>
        <div className="stats-strip">
          <div className="ss-cell"><div className="ss-v green">{stats.childRecordDays}</div><div className="ss-l">孩子记录天数</div></div>
          <div className="ss-cell"><div className="ss-v gold">{stats.monthlyRewards}次</div><div className="ss-l">本月奖励</div></div>
          <div className="ss-cell"><div className="ss-v purple">{stats.companionStreakDays}🔥</div><div className="ss-l">连续陪伴天</div></div>
        </div>
      </div>

      <div className="sec-row"><div className="sec-t">{child.name} 今日</div><div className="sec-m">{child.joined ? "已加入" : "待加入"}</div></div>
        <div className="parent-overview-grid">
        <div className="parent-mini-card lavender">
          <span>⏱ 专注时长</span>
          <strong>{formatFocusMinutes(childFocusSecondsToday)}</strong>
          <small>{stats.companionStreakDays} 天连续陪伴</small>
        </div>
        <div className="parent-mini-card green">
          <span>📋 任务完成</span>
          <strong>{stats.completedTasksToday}<em>/{stats.totalTasksToday}</em></strong>
          <small>{stats.totalTasksToday ? "今日清单实时同步" : "今天还没有任务"}</small>
        </div>
      </div>

      <div className="growth-chart">
        <div className="gc-head">
          <div className="gc-title">近 7 天专注时长</div>
          <div className="gc-val">{formatFocusDuration(focusWeek.reduce((sum, day) => sum + day.totalSeconds, 0))}</div>
        </div>
        <div className="gc-bars">
          {focusWeek.map((day) => {
            const minutes = Math.round(day.totalSeconds / 60);
            const percent = Math.max(6, Math.round((day.totalSeconds / maxFocusSeconds) * 100));
            return (
              <div className="gc-col" key={day.date}>
                <div className="gc-bar-w">
                  <div className={day.label === "今天" ? "gc-bar today" : "gc-bar"} style={{ height: `${day.totalSeconds > 0 ? percent : 6}%` }}>
                    <span>{minutes}m</span>
                  </div>
                </div>
                <div className="gc-lbl">{day.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sec-row"><div className="sec-t">家庭成员</div><button className="sec-m buttonlike" type="button" onClick={() => void copyInvite()}>邀请码 {inviteCode}</button></div>
      <div className="parent-member-list">
        {members.map((member) => (
          <div className="parent-member-card" key={member.id}>
            <div className={`pm-av ${member.role}`}>{member.avatar}</div>
            <div className="pm-info"><div className="pm-name">{member.name}</div><div className="pm-role">{member.roleLabel}</div></div>
            <div className={member.badge === "待加入" ? "pm-badge pending" : "pm-badge"}>{member.badge}</div>
          </div>
        ))}
      </div>

      <div className="sec-row"><div className="sec-t">账号</div></div>
      {profileFeedback ? (
        <div className={profileSyncStatus === "offline" ? "profile-feedback error" : "profile-feedback"}>{profileFeedback}</div>
      ) : null}
      <div className="sg">
        <div className="si editable">
          <div className="si-icon green">✍️</div>
          <div className="si-body"><div className="si-title">家长昵称</div><input value={nameDraft} onChange={(event) => { setNameDraft(event.target.value); setProfileFeedback("修改后点击保存"); }} /></div>
          <button className="profile-mini-save" type="button" onClick={saveName} disabled={profileSyncStatus === "saving"}>{profileSyncStatus === "saving" ? "保存中" : "保存"}</button>
        </div>
        <div className="si editable">
          <div className="si-icon lavender">🏠</div>
          <div className="si-body"><div className="si-title">家庭名称</div><input value={familyDraft} onChange={(event) => { setFamilyDraft(event.target.value); setProfileFeedback("修改后点击保存"); }} /></div>
          <button className="profile-mini-save" type="button" onClick={saveFamily} disabled={profileSyncStatus === "saving"}>{profileSyncStatus === "saving" ? "保存中" : "保存"}</button>
        </div>
        <button className="si" type="button" onClick={() => void copyInvite()}>
          <div className="si-icon gold">🔗</div>
          <div className="si-body"><div className="si-title">家庭邀请码</div><div className="si-sub">{inviteCode} · 点击复制给孩子</div></div>
          <div className="si-right"><div className="si-arr">›</div></div>
        </button>
      </div>

      <button className="btn btn-red profile-exit-button" type="button" onClick={onLogout}>退出登录</button>
    </section>
  );
}

function ChildProfileView({
  profile,
  profileSyncStatus,
  fallback,
  onLogout,
  onSaveProfile,
  onSavePattern,
}: {
  profile: ChildProfileSummary | null;
  profileSyncStatus: ProfileSyncStatus;
  fallback: {
    childName: string;
    childGrade: string;
    childAvatar: string;
    familyName: string;
  };
  onLogout: () => void;
  onSaveProfile: (input: Omit<UpdateChildProfileInput, "userId">) => void;
  onSavePattern: (pattern: string) => void;
}) {
  const [nameDraft, setNameDraft] = useState(profile?.childName ?? fallback.childName);
  const [gradeDraft, setGradeDraft] = useState(profile?.childGrade ?? fallback.childGrade);
  const [patternSetupOpen, setPatternSetupOpen] = useState(false);
  const [patternDraft, setPatternDraft] = useState("");
  const [patternStep, setPatternStep] = useState<"first" | "confirm">("first");
  const [patternMessage, setPatternMessage] = useState("画一个至少 4 个点的图案");
  const childName = profile?.childName ?? fallback.childName;
  const childGrade = profile?.childGrade ?? fallback.childGrade;
  const childAvatar = profile?.childAvatar ?? fallback.childAvatar;
  const avatarLabel = profile?.avatarLabel ?? childAvatarOptions.find((item) => item.avatar === childAvatar)?.label ?? "自定义头像";
  const stats = profile?.stats ?? {
    tomatoCount: 0,
    streakDays: 0,
    walletBalance: 0,
    monthlyRewardAmount: 0,
    pendingRewardAmount: 0,
    pendingRewardCount: 0,
    growthStories: 0,
    pendingLetters: 0,
    completedTasksToday: 0,
    totalTasksToday: 0,
    totalFocusSecondsToday: 0,
  };
  const settings = profile?.settings ?? { pinMode: "pin", unlockAge: 18, weeklyReminder: true };
  const focusWeek = focusWeekWithToday(profile?.focusWeek ?? fallbackFocusWeek(), stats.totalFocusSecondsToday);
  const badges = profile?.badges ?? fallbackBadges();
  const maxFocusSeconds = Math.max(1, ...focusWeek.map((day) => day.totalSeconds));
  const [profileFeedback, setProfileFeedback] = useState("");
  const childSavePendingRef = useRef(false);
  const syncText =
    profileSyncStatus === "saving"
      ? "正在保存"
      : profileSyncStatus === "live"
        ? "已同步"
        : profileSyncStatus === "loading"
          ? "加载中"
          : "离线";

  useEffect(() => {
    setNameDraft(childName);
    setGradeDraft(childGrade);
  }, [childGrade, childName]);

  useEffect(() => {
    if (!childSavePendingRef.current) return;

    if (profileSyncStatus === "saving") {
      setProfileFeedback("正在保存...");
      return;
    }
    if (profileSyncStatus === "live") {
      childSavePendingRef.current = false;
      setProfileFeedback("已保存");
      return;
    }
    if (profileSyncStatus === "offline") {
      childSavePendingRef.current = false;
      setProfileFeedback("保存失败，请稍后重试");
    }
  }, [profileSyncStatus]);

  const saveName = () => {
    const nextName = nameDraft.trim();
    if (!nextName) {
      setProfileFeedback("昵称不能为空");
      return;
    }
    if (nextName === childName) {
      setProfileFeedback("没有修改内容");
      return;
    }
    childSavePendingRef.current = true;
    setProfileFeedback("正在保存...");
    onSaveProfile({ childName: nextName });
  };
  const saveGrade = () => {
    const nextGrade = gradeDraft.trim();
    if (!nextGrade) {
      setProfileFeedback("年级不能为空");
      return;
    }
    if (nextGrade === childGrade) {
      setProfileFeedback("没有修改内容");
      return;
    }
    childSavePendingRef.current = true;
    setProfileFeedback("正在保存...");
    onSaveProfile({ childGrade: nextGrade });
  };
  const cycleAvatar = () => {
    const currentIndex = childAvatarOptions.findIndex((item) => item.avatar === childAvatar);
    const next = childAvatarOptions[(currentIndex + 1 + childAvatarOptions.length) % childAvatarOptions.length];
    childSavePendingRef.current = true;
    setProfileFeedback("正在保存头像...");
    onSaveProfile({ childAvatar: next.avatar, avatarLabel: next.label });
  };
  const savePinMode = (pinMode: UpdateChildProfileInput["pinMode"]) => {
    if (settings.pinMode === pinMode) {
      setProfileFeedback("已经是当前解锁方式");
      return;
    }
    childSavePendingRef.current = true;
    setProfileFeedback("正在保存解锁方式...");
    onSaveProfile({ pinMode });
  };
  const openPatternSetup = () => {
    setPatternDraft("");
    setPatternStep("first");
    setPatternMessage("画一个至少 4 个点的图案");
    setPatternSetupOpen(true);
  };
  const handlePatternCandidate = (pattern: string) => {
    if (pattern.length < 4) {
      setPatternMessage("至少连接 4 个点");
      return;
    }
    if (patternStep === "first") {
      setPatternDraft(pattern);
      setPatternStep("confirm");
      setPatternMessage("再画一次确认图案");
      return;
    }
    if (pattern !== patternDraft) {
      setPatternDraft("");
      setPatternStep("first");
      setPatternMessage("两次图案不一致，请重新设置");
      return;
    }
    childSavePendingRef.current = true;
    setProfileFeedback("正在保存图案...");
    setPatternSetupOpen(false);
    onSavePattern(pattern);
  };

  return (
    <section className="view-stack child-profile-view">
      <div className="uc-hero uc-hero-child">
        <span className={profileSyncStatus === "offline" ? "profile-sync-badge uc-hero-sync offline" : "profile-sync-badge uc-hero-sync"}>
          {syncText}
        </span>
        <div className="uc-av-wrap">
          <button className="uc-av uc-av-child" type="button" onClick={cycleAvatar} aria-label="更换头像">
            {childAvatar}
            <span className="uc-av-edit" aria-hidden="true">✏️</span>
          </button>
          <div>
            <div className="uc-name">{childName}</div>
            <div className="uc-role-tag urt-child">🧒 {childGrade}</div>
          </div>
        </div>
        <div className="stats-strip">
          <div className="ss-cell"><div className="ss-v purple">{stats.tomatoCount}</div><div className="ss-l">番茄总数</div></div>
          <div className="ss-cell"><div className="ss-v gold">{stats.streakDays}🔥</div><div className="ss-l">连续天数</div></div>
          <div className="ss-cell"><div className="ss-v green">{formatMoney(stats.walletBalance)}</div><div className="ss-l">零花钱余额</div></div>
        </div>
      </div>

      <div className="sec-row"><div className="sec-t">我的成就</div><div className="sec-m">全部</div></div>
      <div className="badge-row">
        {badges.map((badge) => (
          <div className="badge-item" key={badge.id}>
            <div className={`badge-icon ${badge.earned ? `earned ${badge.tone}` : "locked"}`}>{badge.icon}</div>
            <div className="badge-lbl">{badge.label}</div>
          </div>
        ))}
      </div>

      <div className="growth-chart">
        <div className="gc-head">
          <div className="gc-title">我的专注 · 近 7 天</div>
          <div className="gc-val">{formatFocusMinutes(stats.totalFocusSecondsToday)}</div>
        </div>
        <div className="gc-bars">
          {focusWeek.map((day) => {
            const minutes = Math.round(day.totalSeconds / 60);
            const percent = Math.max(6, Math.round((day.totalSeconds / maxFocusSeconds) * 100));
            return (
              <div className="gc-col" key={day.date}>
                <div className="gc-bar-w">
                  <div
                    className={day.label === "今天" ? "gc-bar today" : "gc-bar"}
                    style={{ height: `${day.totalSeconds > 0 ? percent : 6}%` }}
                  >
                    <span>{minutes}m</span>
                  </div>
                </div>
                <div className="gc-lbl">{day.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sec-row"><div className="sec-t">我的设置</div></div>
      {profileFeedback ? (
        <div className={profileSyncStatus === "offline" ? "profile-feedback error" : "profile-feedback"}>{profileFeedback}</div>
      ) : null}
      <div className="sg">
        <div className="sg-header">解锁方式</div>
        <button className="si" type="button" onClick={() => savePinMode("pin")} disabled={profileSyncStatus === "saving"}>
          <div className="si-icon lavender">🔢</div>
          <div className="si-body"><div className="si-title">数字密码</div><div className="si-sub">当前：4 位数字密码</div></div>
          <div className="si-right"><div className={settings.pinMode === "pin" ? "si-badge on" : "si-badge"}>启用</div></div>
        </button>
        <button className="si" type="button" onClick={openPatternSetup} disabled={profileSyncStatus === "saving"}>
          <div className="si-icon lavender">🔷</div>
          <div className="si-body"><div className="si-title">图案解锁</div><div className="si-sub">{settings.pinMode === "pattern" ? "重新设置你的专属图案" : "划出你的专属图案"}</div></div>
          <div className="si-right"><div className={settings.pinMode === "pattern" ? "si-badge on" : "si-badge"}>{settings.pinMode === "pattern" ? "已启用" : "设置"}</div></div>
        </button>
      </div>

      <div className="sg">
        <div className="sg-header">头像与昵称</div>
        <button className="si" type="button" onClick={cycleAvatar} disabled={profileSyncStatus === "saving"}>
          <div className="si-icon gold">{childAvatar}</div>
          <div className="si-body"><div className="si-title">更换头像</div><div className="si-sub">当前：{avatarLabel}</div></div>
          <div className="si-right"><div className="si-arr">›</div></div>
        </button>
        <div className="si editable">
          <div className="si-icon green">✏️</div>
          <div className="si-body"><div className="si-title">昵称</div><input value={nameDraft} onChange={(event) => { setNameDraft(event.target.value); setProfileFeedback("修改后点击保存"); }} /></div>
          <button className="profile-mini-save" type="button" onClick={saveName} disabled={profileSyncStatus === "saving"}>{profileSyncStatus === "saving" ? "保存中" : "保存"}</button>
        </div>
        <div className="si editable">
          <div className="si-icon lavender">🧒</div>
          <div className="si-body"><div className="si-title">年级</div><input value={gradeDraft} onChange={(event) => { setGradeDraft(event.target.value); setProfileFeedback("修改后点击保存"); }} /></div>
          <button className="profile-mini-save" type="button" onClick={saveGrade} disabled={profileSyncStatus === "saving"}>{profileSyncStatus === "saving" ? "保存中" : "保存"}</button>
        </div>
      </div>

      <button className="btn btn-red profile-exit-button" type="button" onClick={onLogout}>退出登录</button>
      <PatternSetupSheet
        open={patternSetupOpen}
        message={patternMessage}
        step={patternStep}
        onCancel={() => setPatternSetupOpen(false)}
        onComplete={handlePatternCandidate}
      />
    </section>
  );
}

function PatternSetupSheet({
  open,
  message,
  step,
  onCancel,
  onComplete,
}: {
  open: boolean;
  message: string;
  step: "first" | "confirm";
  onCancel: () => void;
  onComplete: (pattern: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="pattern-sheet-backdrop" role="dialog" aria-modal="true" aria-label="设置图案解锁">
      <div className="pattern-sheet">
        <button className="pattern-sheet-close" type="button" onClick={onCancel} aria-label="关闭">
          <X size={18} />
        </button>
        <div className="pattern-sheet-icon">🔷</div>
        <strong>{step === "first" ? "设置图案解锁" : "确认图案"}</strong>
        <p>{message}</p>
        <PatternPad onComplete={onComplete} />
        <button className="btn btn-ghost pattern-sheet-cancel" type="button" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function PatternPad({ onComplete }: { onComplete: (pattern: string) => void }) {
  const [path, setPath] = useState<number[]>([]);
  const [status, setStatus] = useState("按住星点滑动");
  const nodeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pathRef = useRef<number[]>([]);
  const activeRef = useRef(false);

  const setPathValue = (next: number[]) => {
    pathRef.current = next;
    setPath(next);
  };

  const addNode = (node: number) => {
    const current = pathRef.current;
    if (current.includes(node)) return;
    setPathValue([...current, node]);
    setStatus(current.length >= 2 ? "松手完成" : "继续连接");
  };

  const nodeFromPoint = (clientX: number, clientY: number) => {
    for (const [index, node] of nodeRefs.current.entries()) {
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      const padding = 14;
      if (clientX >= rect.left - padding && clientX <= rect.right + padding && clientY >= rect.top - padding && clientY <= rect.bottom + padding) {
        return index + 1;
      }
    }
    return null;
  };

  const begin = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    activeRef.current = true;
    setPathValue([]);
    setStatus("继续连接");
    const node = nodeFromPoint(event.clientX, event.clientY);
    if (node) addNode(node);
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeRef.current) return;
    const node = nodeFromPoint(event.clientX, event.clientY);
    if (node) addNode(node);
  };

  const finish = () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    const pattern = pathRef.current.join("");
    if (pattern.length < 4) {
      setStatus("至少连接 4 个点");
      window.setTimeout(() => {
        setPathValue([]);
        setStatus("按住星点滑动");
      }, 650);
      return;
    }
    onComplete(pattern);
    setPathValue([]);
    setStatus("按住星点滑动");
  };

  return (
    <>
      <div className="profile-pattern-grid" onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onPointerLeave={finish}>
        {path.length > 1 ? (
          <svg className="profile-pattern-canvas" viewBox="0 0 240 240" aria-hidden="true">
            <polyline points={path.map((node) => `${patternNodePoints[node - 1]?.x ?? 0},${patternNodePoints[node - 1]?.y ?? 0}`).join(" ")} />
          </svg>
        ) : null}
        {Array.from({ length: 9 }, (_, index) => (
          <button
            key={index}
            ref={(element) => {
              nodeRefs.current[index] = element;
            }}
            className={path.includes(index + 1) ? "profile-pattern-node lit" : "profile-pattern-node"}
            type="button"
            aria-label={`图案点 ${index + 1}`}
          />
        ))}
      </div>
      <div className="profile-pattern-status">{status}</div>
    </>
  );
}

function ParentObserverPanel({
  completed,
  total,
  nextTask,
  progress,
  timerRunning,
  secondsLeft,
  syncStatus,
}: {
  completed: number;
  total: number;
  nextTask: HomeworkTask | null;
  progress: number;
  timerRunning: boolean;
  secondsLeft: number;
  syncStatus: TaskSyncStatus;
}) {
  return (
    <aside className="observer-panel" aria-label="父母观察面板">
      <div className="observer-header">
        <span className="label-dot gold">父母观察台</span>
        <h2>看见进展，不制造压力</h2>
        <p>父母端通过实时事件流看到任务进度，只展示关键节奏和可回应的闪光点。</p>
      </div>

      <div className="observer-grid">
        <article>
          <ListIcon icon={<BookOpen size={20} />} label="今日任务" />
          <strong>
            {completed}/{total}
          </strong>
          <span>下一项：{nextTask?.title ?? "暂无任务"}</span>
          <ProgressBar value={progress} />
        </article>
        <article>
          <ListIcon icon={<Timer size={20} />} label="共同专注" />
          <strong>{timerRunning ? "进行中" : "暂停中"}</strong>
          <span>剩余 {formatTimer(secondsLeft)}</span>
        </article>
        <article>
          <ListIcon icon={<Coins size={20} />} label="正向反馈" />
          <strong>{syncStatus === "live" ? "实时同步中" : "等待连接"}</strong>
          <span>孩子每完成一项，父亲端会立即刷新进度</span>
        </article>
        <article>
          <ListIcon icon={<MoonStar size={20} />} label="成长记录" />
          <strong>本周未完成</strong>
          <span>今晚可以只写一句，不写长作文</span>
        </article>
      </div>

      <div className="observer-note">
        <Bell size={18} />
        <p>建议父母只回应具体进步，例如“我看到你先完成了数学”，不把页面变成监督工具。</p>
      </div>
    </aside>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {action && <span>{action}</span>}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track" aria-label={`完成进度 ${value}%`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <article className="stat-tile">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function ListIcon({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="list-icon">
      {icon}
      <span>{label}</span>
    </div>
  );
}
