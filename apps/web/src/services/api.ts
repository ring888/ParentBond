import type {
  ChildProfileSummary,
  CompanionFocusHeartbeatInput,
  CompanionFocusState,
  FocusRecordInput,
  FocusStats,
  GameRecordInput,
  GameSummary,
  HomeworkTask,
  LlmTaskParseRequest,
  LlmTaskParseResponse,
  ParentChildDetailSummary,
  ParentProfileSummary,
  CreateWalletEntryInput,
  ParentReviewWalletEntryInput,
  UpdateChildProfileInput,
  UpdateParentProfileInput,
  ResolveWalletEntryInput,
  WalletEntry,
  WalletEvidence,
  WalletSummary,
  UploadWalletEvidenceInput,
} from "@parentbond/shared";

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) {
    return configured;
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3000/api/v1`;
}

const API_BASE_URL = resolveApiBaseUrl();

function resolveMediaUrl(url: string) {
  if (!url || /^https?:\/\//i.test(url)) return url;
  return `${new URL(API_BASE_URL).origin}${url}`;
}

function normalizeWalletEvidence(evidence?: WalletEvidence | null) {
  if (!evidence) return evidence;
  return { ...evidence, url: resolveMediaUrl(evidence.url) };
}

function normalizeWalletEntry(entry: WalletEntry): WalletEntry {
  return {
    ...entry,
    evidence: normalizeWalletEvidence(entry.evidence),
    appealEvidence: normalizeWalletEvidence(entry.appealEvidence),
  };
}

function normalizeWalletSummary(summary: WalletSummary): WalletSummary {
  return {
    ...summary,
    entries: summary.entries.map(normalizeWalletEntry),
  };
}

interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
}

function toTaskSaveInput(task: HomeworkTask) {
  return {
    id: task.id,
    subject: task.subject,
    title: task.title,
    estimatedMinutes: task.estimatedMinutes,
    priority: task.priority,
    completedAt: task.completedAt,
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const body = (await response.json()) as ApiEnvelope<T> | T;

  if (body && typeof body === "object" && "code" in body && "data" in body) {
    const envelope = body as ApiEnvelope<T>;
    if (envelope.code !== 0) {
      throw new Error(envelope.message || "API request failed");
    }
    return envelope.data;
  }

  return body as T;
}

export async function parseHomeworkTasks(
  payload: LlmTaskParseRequest,
): Promise<LlmTaskParseResponse> {
  return requestJson<LlmTaskParseResponse>("/tasks/parse", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchTodayTasks(userId: string, date?: string): Promise<HomeworkTask[]> {
  const params = new URLSearchParams({ userId });
  if (date) {
    params.set("date", date);
  }

  return requestJson<HomeworkTask[]>(`/tasks/today?${params.toString()}`);
}

export async function saveTodayTasks(
  userId: string,
  tasks: HomeworkTask[],
  date?: string,
): Promise<HomeworkTask[]> {
  return requestJson<HomeworkTask[]>("/tasks/lists", {
    method: "POST",
    body: JSON.stringify({
      userId,
      date,
      // The read API includes database metadata that the write DTO intentionally rejects.
      tasks: tasks.map(toTaskSaveInput),
    }),
  });
}

export async function setTaskComplete(id: string, completed: boolean): Promise<HomeworkTask> {
  return requestJson<HomeworkTask>(`/tasks/${id}/complete`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  });
}

export async function fetchFocusStats(userId: string, date?: string): Promise<FocusStats> {
  const params = new URLSearchParams({ userId });
  if (date) {
    params.set("date", date);
  }

  return requestJson<FocusStats>(`/focus/stats?${params.toString()}`);
}

export async function saveFocusRecord(
  payload: FocusRecordInput,
  options?: { keepalive?: boolean },
): Promise<FocusStats> {
  return requestJson<FocusStats>("/focus/records", {
    method: "POST",
    keepalive: options?.keepalive,
    body: JSON.stringify(payload),
  });
}

export async function fetchCompanionFocus(userId: string): Promise<CompanionFocusState> {
  const params = new URLSearchParams({ userId });
  return requestJson<CompanionFocusState>(`/focus/companion?${params.toString()}`);
}

export async function saveCompanionFocusHeartbeat(
  payload: CompanionFocusHeartbeatInput,
  options?: { keepalive?: boolean },
): Promise<CompanionFocusState> {
  return requestJson<CompanionFocusState>("/focus/companion/heartbeat", {
    method: "POST",
    keepalive: options?.keepalive,
    body: JSON.stringify(payload),
  });
}

export async function fetchGameSummary(userId: string, date?: string): Promise<GameSummary> {
  const params = new URLSearchParams({ userId });
  if (date) {
    params.set("date", date);
  }

  return requestJson<GameSummary>(`/games/summary?${params.toString()}`);
}

export async function saveGameRecord(payload: GameRecordInput): Promise<GameSummary> {
  return requestJson<GameSummary>("/games/records", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchChildProfile(userId: string): Promise<ChildProfileSummary> {
  const params = new URLSearchParams({ userId });
  return requestJson<ChildProfileSummary>(`/profile/child?${params.toString()}`);
}

export async function updateChildProfile(
  payload: UpdateChildProfileInput,
): Promise<ChildProfileSummary> {
  return requestJson<ChildProfileSummary>("/profile/child", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchParentProfile(userId: string): Promise<ParentProfileSummary> {
  const params = new URLSearchParams({ userId });
  return requestJson<ParentProfileSummary>(`/profile/parent?${params.toString()}`);
}

export async function fetchParentChildDetail(userId: string): Promise<ParentChildDetailSummary> {
  const params = new URLSearchParams({ userId });
  return requestJson<ParentChildDetailSummary>(`/profile/parent/child-detail?${params.toString()}`);
}

export async function updateParentProfile(
  payload: UpdateParentProfileInput,
): Promise<ParentProfileSummary> {
  return requestJson<ParentProfileSummary>("/profile/parent", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchWalletSummary(userId: string): Promise<WalletSummary> {
  const params = new URLSearchParams({ userId });
  return requestJson<WalletSummary>(`/wallet?${params.toString()}`).then(normalizeWalletSummary);
}

export async function createWalletEntry(payload: CreateWalletEntryInput): Promise<WalletEntry> {
  return requestJson<WalletEntry>("/wallet/entries", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then(normalizeWalletEntry);
}

export async function uploadWalletEvidence(payload: UploadWalletEvidenceInput): Promise<WalletEvidence> {
  return requestJson<WalletEvidence>("/wallet/evidence", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((evidence) => ({ ...evidence, url: resolveMediaUrl(evidence.url) }));
}

export async function resolveWalletEntry(id: string, payload: ResolveWalletEntryInput): Promise<WalletEntry> {
  return requestJson<WalletEntry>(`/wallet/entries/${id}/resolve`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }).then(normalizeWalletEntry);
}

export async function reviewWalletEntry(id: string, payload: ParentReviewWalletEntryInput): Promise<WalletEntry> {
  return requestJson<WalletEntry>(`/wallet/entries/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }).then(normalizeWalletEntry);
}

export function subscribeTaskUpdates(
  userId: string,
  date: string | undefined,
  onTasks: (tasks: HomeworkTask[]) => void,
  onError?: () => void,
) {
  const params = new URLSearchParams({ userId });
  if (date) {
    params.set("date", date);
  }
  const source = new EventSource(`${API_BASE_URL}/tasks/stream?${params.toString()}`);

  source.onmessage = (event) => {
    const payload = JSON.parse(event.data) as {
      type: "snapshot" | "update";
      tasks: HomeworkTask[];
    };
    onTasks(payload.tasks);
  };

  source.onerror = () => {
    onError?.();
  };

  return () => source.close();
}
