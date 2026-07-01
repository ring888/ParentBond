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

export type UnlockType = "pin" | "pattern";

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

export type ChildLoginInput = {
  inviteCode: string;
  password: string;
  unlockType?: UnlockType;
};

export type SetChildPatternInput = {
  userId: string;
  pattern: string;
};

interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
}

function bodyMessage(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const value = (body as { message?: unknown; error?: unknown }).message;
  if (Array.isArray(value)) return value.filter(Boolean).join("；");
  if (typeof value === "string") return value;
  const error = (body as { error?: unknown }).error;
  return typeof error === "string" ? error : "";
}

function friendlyAuthMessage(message: string, status: number, path: string) {
  if (message.includes("Cannot POST /api/v1/auth/join-child")) {
    return "孩子加入家庭接口还没有生效，请重启后端服务";
  }
  if (message.includes("Cannot POST /api/v1/auth/login-child")) {
    return "孩子登录接口还没有生效，请重启后端服务";
  }
  if (message.includes("Cannot POST /api/v1/auth/child-pattern")) {
    return "图案解锁接口还没有生效，请重启后端服务";
  }
  if (message.includes("password must be longer than or equal to 4 characters")) {
    return "请输入 4 位数字密码";
  }
  if (message.includes("password must be longer than or equal to 6 characters")) {
    return "密码至少 6 位；孩子登录请使用加入家庭时设置的 4 位 PIN";
  }
  if (path === "/auth/login" && message.includes("username must be longer than or equal to 2 characters")) {
    return "没有找到孩子登录信息，请先用邀请码加入家庭";
  }
  if (message) return message;
  if (status === 404) return "登录接口没有找到，请确认后端服务已部署并重启";
  if (status >= 500) return "登录服务暂时异常，请稍后重试";
  return "请求失败，请重试";
}

function authApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured;

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3000/api/v1`;
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const targetUrl = `${authApiBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(targetUrl, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("无法连接登录服务，请确认后端 3000 端口已启动，或前端 VITE_API_BASE_URL 已配置为 /api/v1");
  }

  const text = await response.text();
  let body: (ApiEnvelope<T> | { message?: unknown; error?: unknown }) | null = null;
  if (text.trim()) {
    try {
      body = JSON.parse(text) as ApiEnvelope<T> | { message?: unknown; error?: unknown };
    } catch {
      throw new Error(
        response.ok
          ? "登录服务返回了无法识别的数据，请确认前后端版本一致"
          : friendlyAuthMessage("", response.status, path),
      );
    }
  }

  if (!response.ok) {
    throw new Error(friendlyAuthMessage(bodyMessage(body), response.status, path));
  }

  if (!body) {
    throw new Error("登录服务没有返回数据，请确认后端服务已部署并重启");
  }

  const envelope = body as ApiEnvelope<T>;
  if (envelope.code !== 0) {
    throw new Error(friendlyAuthMessage(envelope.message || "", response.status, path));
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

export function loginAuth(input: { username: string; password: string; unlockType?: UnlockType }) {
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

export function loginChildByInvite(input: ChildLoginInput) {
  return authRequest<AuthSession>("/auth/login-child", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function setChildPattern(input: SetChildPatternInput) {
  return authRequest<{ ok: boolean }>("/auth/child-pattern", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
