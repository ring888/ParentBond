import { useEffect, useState } from "react";
import { App } from "../App";
import { getAuthMe, heartbeatAuth, logoutAuth, type AuthSession } from "../services/auth";
import { AuthPage } from "./AuthPage";
import "../styles/auth-gate.css";

const authSessionKey = "parentbond.auth.v1";

function readSession(): AuthSession | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(authSessionKey) ?? "null") as AuthSession | null;
    return value?.token && value.user?.id ? value : null;
  } catch {
    return null;
  }
}

export function AuthGate() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const [checking, setChecking] = useState(Boolean(session));

  const clearSession = () => {
    window.localStorage.removeItem(authSessionKey);
    setSession(null);
  };

  const handleLogout = () => {
    const token = session?.token;
    if (!token) {
      clearSession();
      return;
    }

    void logoutAuth(token).finally(clearSession);
  };

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    void getAuthMe(session.token)
      .then((user) => {
        if (cancelled) return;
        const nextSession = { ...session, user };
        window.localStorage.setItem(authSessionKey, JSON.stringify(nextSession));
        setSession(nextSession);
      })
      .catch(() => {
        if (!cancelled) {
          window.localStorage.removeItem(authSessionKey);
          setSession(null);
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session?.token) return;

    const ping = () => {
      void heartbeatAuth(session.token).catch(() => undefined);
    };
    ping();
    const timer = window.setInterval(ping, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [session?.token]);

  if (checking) {
    return <main className="auth-gate-loading">正在连接家庭账号...</main>;
  }

  if (session) {
    return <App userId={session.user.id} authUser={session.user} onLogout={handleLogout} />;
  }

  return <AuthPage onAuthenticated={(nextSession) => {
    window.localStorage.setItem(authSessionKey, JSON.stringify(nextSession));
    setSession(nextSession);
  }} />;
}
