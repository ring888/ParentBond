import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
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
  Square,
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
import {
  FOCUS_AUTO_FLUSH_SECONDS,
  TASK_FOCUS_STORAGE_KEY,
  childBottomNavigation,
  emptyFocusStats,
  parentBottomNavigation,
  parentNavigation,
} from "./app/constants";
import type {
  FocusMode,
  MemorySyncStatus,
  ProfileSyncStatus,
  TaskDropPlacement,
  TaskEditorDraft,
  TaskFocusTimer,
  TaskSyncStatus,
} from "./app/types";
import {
  doneCount,
  localDateString,
  playPositiveSound,
  readStoredTaskFocusSession,
} from "./app/formatters";
import { ParentObserverPanel } from "./components/ParentObserverPanel";
import { FocusView, FocusCompletionOverlay } from "./views/focus/FocusView";
import { GamesView } from "./views/games/GamesView";
import { HomeView, ParentChildDetailView, ParentCompanionFocusView, ParentHomeView } from "./views/home/HomeViews";
import { MemoryView } from "./views/memory/MemoryView";
import { ChildProfileView, ParentProfileView } from "./views/profile/ProfileViews";
import { TasksView } from "./views/tasks/TasksView";
import { WalletView } from "./views/wallet/WalletView";

const DEFAULT_USER_ID = "demo-child-001";

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

  const finishFocusEarly = () => {
    if (focusSessionFinished) return;
    if (focusMode === "task" && (!activeFocusTask || activeFocusTask.completedAt)) return;

    collectFocusElapsedUntilNow();
    flushFocusProgress(false);
    setTimerRunning(false);
    setFocusSessionFinished(true);
    setTaskFeedback(
      focusMode === "task"
        ? "本轮专注已结束，确认一下这项任务是否完成"
        : "本轮番茄已结束，休息一下再继续",
    );
  };

  const continueFocusTimer = () => {
    if (focusMode === "task" && (!activeFocusTask || activeFocusTask.completedAt)) return;
    if (secondsLeft <= 0) return;

    setFocusSessionFinished(false);
    setTimerRunning(true);
    setTaskFeedback(
      focusMode === "task" && activeFocusTask
        ? `继续专注「${activeFocusTask.title}」`
        : "继续专注，加油",
    );
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
                onEndFocus={finishFocusEarly}
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
            finishedEarly={focusSessionFinished && secondsLeft > 0 && !activeFocusTask?.completedAt}
            focusRoundSeconds={focusDurationSeconds}
            onExtendTimer={extendFocusTimer}
            onContinueTimer={continueFocusTimer}
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
    </main>
  );
}
