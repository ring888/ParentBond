export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  familyName: string;
  role: "parent" | "elder" | "child";
  childName: string | null;
  childGrade: string | null;
  childAvatar: string | null;
  inviteCode: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type RegisterAuthInput = {
  username: string;
  displayName: string;
  familyName: string;
  role: "parent";
  password: string;
  childName: string;
  childGrade: string;
  childAvatar: string;
};

export type JoinFamilyInput = {
  inviteCode: string;
  username: string;
  displayName: string;
  password: string;
};

export type JoinChildFamilyInput = {
  inviteCode: string;
  childName: string;
  childAvatar?: string;
  password: string;
};

interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
}

function authApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured;

  return `${window.location.protocol}//${window.location.hostname}:3000/api/v1`;
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${authApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json()) as ApiEnvelope<T> | { message?: string };

  if (!response.ok) {
    const message = "message" in body && body.message ? body.message : "请求失败，请重试";
    if (message.includes("Cannot POST /api/v1/auth/join-child")) {
      throw new Error("孩子加入家庭接口还没有生效，请重启后端服务");
    }
    throw new Error(message);
  }

  const envelope = body as ApiEnvelope<T>;
  if (envelope.code !== 0) {
    throw new Error(envelope.message || "请求失败，请重试");
  }

  return envelope.data;
}

export function getAuthMe(token: string) {
  return authRequest<AuthUser>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function logoutAuth(token: string) {
  return authRequest<{ ok: boolean }>("/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function heartbeatAuth(token: string) {
  return authRequest<{ ok: boolean; lastSeenAt: string }>("/auth/heartbeat", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function registerAuth(input: RegisterAuthInput) {
  return authRequest<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginAuth(input: { username: string; password: string }) {
  return authRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function joinFamily(input: JoinFamilyInput) {
  return authRequest<AuthSession>("/auth/join", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function joinChildFamily(input: JoinChildFamilyInput) {
  return authRequest<AuthSession>("/auth/join-child", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
