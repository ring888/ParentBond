import type { ChildProfileSummary, HomeworkTask } from "@parentbond/shared";
import { TASK_FOCUS_STORAGE_KEY } from "./constants";
import type { StoredTaskFocusSession } from "./types";

export function formatTimer(value: number) {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatTimerParts(value: number) {
  return {
    minutes: Math.floor(value / 60)
      .toString()
      .padStart(2, "0"),
    seconds: Math.floor(value % 60)
      .toString()
      .padStart(2, "0"),
  };
}

export function localDateString(date = new Date()) {
  const localTime = date.getTime() - date.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 10);
}

export function formatMoney(value: number) {
  return `¥${value.toFixed(value % 1 === 0 ? 0 : 1)}`;
}

export function formatFocusMinutes(seconds: number) {
  return `${Math.round(seconds / 60)}分钟`;
}

export function fallbackFocusWeek() {
  const labels = ["周一", "周二", "周三", "周四", "周五", "周六", "今天"];
  return labels.map((label, index) => ({
    date: String(index),
    label,
    totalSeconds: 0,
  }));
}

export function focusWeekWithToday(focusWeek: ChildProfileSummary["focusWeek"], totalSecondsToday: number) {
  if (totalSecondsToday <= 0) return focusWeek;
  const todayIndex = focusWeek.findIndex((day) => day.label === "今天");
  if (todayIndex < 0) return focusWeek;

  return focusWeek.map((day, index) =>
    index === todayIndex
      ? { ...day, totalSeconds: Math.max(day.totalSeconds, totalSecondsToday) }
      : day,
  );
}

export function fallbackBadges(): ChildProfileSummary["badges"] {
  return [
    { id: "streak-7", icon: "🔥", label: "7天连续", earned: false, tone: "gold" },
    { id: "tomato-50", icon: "🍅", label: "50个番茄", earned: false, tone: "purple" },
    { id: "perfect-day", icon: "⭐", label: "满分达人", earned: false, tone: "green" },
    { id: "tomato-100", icon: "🏆", label: "100个番茄", earned: false, tone: "neutral" },
    { id: "streak-30", icon: "📚", label: "30天连续", earned: false, tone: "neutral" },
  ];
}

export function formatFocusDuration(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${totalMinutes}m`;
}

export function readStoredTaskFocusSession(): StoredTaskFocusSession | null {
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

export function doneCount(tasks: HomeworkTask[]) {
  return tasks.filter((task) => task.completedAt).length;
}

export function playPositiveSound() {
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
