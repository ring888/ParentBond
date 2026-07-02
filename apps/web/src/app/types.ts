import type { Subject } from "@parentbond/shared";

export type TaskSyncStatus = "loading" | "live" | "offline" | "saving";
export type ProfileSyncStatus = "loading" | "live" | "offline" | "saving";
export type MemorySyncStatus = "loading" | "live" | "offline" | "saving";
export type TaskDropPlacement = "before" | "after";
export type FocusMode = "daily" | "task";
export type TaskFocusTimer = {
  taskId: string;
  secondsLeft: number;
  totalSeconds: number;
};

export type StoredTaskFocusSession = {
  taskId: string;
  timer: TaskFocusTimer;
};

export type TaskEditorDraft = {
  id: string | null;
  subject: Subject;
  title: string;
  estimatedMinutes: number;
  priority: 1 | 2 | 3;
};
