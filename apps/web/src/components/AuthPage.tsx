import { type RefObject, useEffect, useRef, useState } from "react";
import { joinChildFamily, joinFamily, loginAuth, registerAuth, type AuthSession } from "../services/auth";
import "../styles/auth-page.css";

type Screen =
  | "loading"
  | "welcome"
  | "role"
  | "parent"
  | "child"
  | "invite"
  | "members"
  | "elder"
  | "elderDone"
  | "loginWho"
  | "login"
  | "childLogin"
  | "childJoin"
  | "childPin"
  | "done";

type Role = "parent" | "elder";

const grades = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三"];
const avatars = [
  ["🦊", "小狐狸"],
  ["🐼", "熊猫"],
  ["🦁", "小狮子"],
  ["🐯", "小老虎"],
  ["🦋", "蝴蝶"],
  ["🐉", "小龙"],
  ["🦄", "独角兽"],
  ["🚀", "火箭"],
] as const;

type SavedChildLogin = {
  username: string;
  childName: string;
  childGrade: string;
  childAvatar: string;
  familyName: string;
};

const savedChildLoginKey = "parentbond.child-login.v1";

function readSavedChildLogin(): SavedChildLogin | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(savedChildLoginKey) ?? "null") as SavedChildLogin | null;
    return value?.username ? value : null;
  } catch {
    return null;
  }
}

function StepBar({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="step-bar">
      {[1, 2, 3, 4].map((current, index) => (
        <div key={current} style={{ display: "contents" }}>
          <div className={`step-dot ${current < step ? "done" : current === step ? "active" : ""}`} />
          {index < 3 ? <div className={`step-line ${current < step ? "filled" : ""}`} /> : null}
        </div>
      ))}
      <div style={{ fontSize: 11, color: "var(--text2)", whiteSpace: "nowrap" }}>第 {step} 步 / 4</div>
    </div>
  );
}

function BackButton({ onClick, label = "返回" }: { onClick: () => void; label?: string }) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div className="back-btn" role="button" tabIndex={0} onClick={onClick} onKeyDown={handleKeyDown}>
      ‹ {label}
    </div>
  );
}

function LogoMark({ centered = false }: { centered?: boolean }) {
  return (
    <div className="logo-mark" style={centered ? { justifyContent: "center" } : undefined}>
      <div className="logo-icon">🌙</div>
      <div className="logo-name">Parent<span>Bond</span></div>
    </div>
  );
}

function useStarfield(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: 0.1 + Math.random() * 1.1,
      alpha: Math.random(),
      speed: 0.002 + Math.random() * 0.009,
      phase: Math.random() * Math.PI * 2,
    }));
    let frame = 0;

    const draw = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * scale));
      const height = Math.max(1, Math.round(rect.height * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        context.setTransform(scale, 0, 0, scale, 0, 0);
      }

      context.clearRect(0, 0, rect.width, rect.height);
      for (const star of stars) {
        const alpha = star.alpha * (0.18 + 0.82 * Math.sin(time * star.speed + star.phase));
        context.beginPath();
        context.arc(star.x * rect.width, star.y * rect.height, star.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(255,255,255,${Math.max(0, alpha)})`;
        context.fill();
      }
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [canvasRef]);
}

export function AuthPage({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [role, setRole] = useState<Role | null>(null);
  const [parentName, setParentName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [childName, setChildName] = useState("");
  const [childGrade, setChildGrade] = useState("四年级");
  const [childAvatar, setChildAvatar] = useState("🦊");
  const [inviteCode, setInviteCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [childJoinCode, setChildJoinCode] = useState("");
  const [childJoinName, setChildJoinName] = useState("");
  const [childJoinPin, setChildJoinPin] = useState("");
  const [elderName, setElderName] = useState("");
  const [elderPassword, setElderPassword] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState("");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [savedChild, setSavedChild] = useState<SavedChildLogin | null>(() => readSavedChildLogin());
  const [pin, setPin] = useState("");
  const [pinMode, setPinMode] = useState<"pin" | "pattern">("pin");

  useStarfield(canvasRef);

  useEffect(() => {
    const ready = window.setTimeout(() => setScreen("welcome"), 780);
    return () => {
      window.clearTimeout(ready);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const move = (next: Screen) => {
    setScreen(next);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  };

  const parentNext = () => {
    if (!parentName.trim() || !familyName.trim() || parentPassword.length < 6) {
      setToast("请填写姓名、家庭名称和至少 6 位密码");
      return;
    }
    move("child");
  };

  const rememberChildSession = (nextSession: AuthSession) => {
    if (nextSession.user.role === "child") {
      const nextChild = {
        username: nextSession.user.username,
        childName: nextSession.user.childName || nextSession.user.displayName,
        childGrade: nextSession.user.childGrade || "四年级",
        childAvatar: nextSession.user.childAvatar || "🦊",
        familyName: nextSession.user.familyName,
      };
      window.localStorage.setItem(savedChildLoginKey, JSON.stringify(nextChild));
      setSavedChild(nextChild);
    }
  };

  const finishSession = (nextSession: AuthSession, nextScreen: Screen) => {
    setSession(nextSession);
    setInviteCode(nextSession.user.inviteCode);
    rememberChildSession(nextSession);
    move(nextScreen);
  };

  const enterApp = (nextSession: AuthSession) => {
    rememberChildSession(nextSession);
    onAuthenticated(nextSession);
  };

  const registerParent = async () => {
    if (!childName.trim()) {
      setToast("请填写孩子的姓名");
      return;
    }

    setPending(true);
    try {
      const nextSession = await registerAuth({
        username: parentName.trim(),
        displayName: parentName.trim(),
        familyName: familyName.trim(),
        role: "parent",
        password: parentPassword,
        childName: childName.trim(),
        childGrade,
        childAvatar,
      });
      finishSession(nextSession, "invite");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "创建失败，请重试");
    } finally {
      setPending(false);
    }
  };

  const join = async () => {
    if (joinCode.trim().length !== 6 || !elderName.trim() || elderPassword.length < 6) {
      setToast("请填写邀请码、姓名和至少 6 位密码");
      return;
    }

    setPending(true);
    try {
      const nextSession = await joinFamily({
        inviteCode: joinCode.trim(),
        username: elderName.trim(),
        displayName: elderName.trim(),
        password: elderPassword,
      });
      finishSession(nextSession, "elderDone");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "加入失败，请重试");
    } finally {
      setPending(false);
    }
  };

  const joinChild = async () => {
    if (childJoinCode.trim().length !== 6 || !childJoinName.trim() || childJoinPin.length < 4) {
      setToast("请填写邀请码、孩子昵称和 4 位 PIN");
      return;
    }

    setPending(true);
    try {
      finishSession(
        await joinChildFamily({
          inviteCode: childJoinCode.trim(),
          childName: childJoinName.trim(),
          childAvatar,
          password: childJoinPin,
        }),
        "done",
      );
    } catch (error) {
      setToast(error instanceof Error ? error.message : "孩子加入失败，请重试");
    } finally {
      setPending(false);
    }
  };

  const login = async () => {
    if (!loginUsername.trim() || !loginPassword) {
      setToast("请输入账号和密码");
      return;
    }

    setPending(true);
    try {
      enterApp(await loginAuth({ username: loginUsername.trim(), password: loginPassword }));
    } catch (error) {
      setToast(error instanceof Error ? error.message : "登录失败，请重试");
    } finally {
      setPending(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard?.writeText(inviteCode);
      setToast(`邀请码 ${inviteCode} 已复制！`);
    } catch {
      setToast(`邀请码：${inviteCode}`);
    }
  };

  const loginChildWithPin = async (pinValue: string) => {
    if (!savedChild) {
      setPin("");
      setToast("先用邀请码加入家庭");
      move("childJoin");
      return;
    }

    setPending(true);
    try {
      enterApp(await loginAuth({ username: savedChild.username, password: pinValue }));
    } catch (error) {
      setToast(error instanceof Error ? error.message : "PIN 不正确，请重试");
    } finally {
      setPin("");
      setPending(false);
    }
  };

  const enterPin = (key: string) => {
    const next = `${pin}${key}`.slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      void loginChildWithPin(next);
    }
  };

  const displayFamily = session?.user.familyName || familyName || "陈家大家庭";
  const displayParent = session?.user.displayName || parentName || "小明爸爸";
  const displayChild = session?.user.childName || savedChild?.childName || childName || "小明";
  const displayGrade = session?.user.childGrade || savedChild?.childGrade || childGrade;
  const displayAvatar = session?.user.childAvatar || savedChild?.childAvatar || childAvatar;
  return (
    <main className="auth-page" aria-label="ParentBond 注册和登录">
      <section className="shell">
        <canvas ref={canvasRef} className="sf" aria-hidden="true" />
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="scroll">
          {screen === "loading" ? (
            <div style={{ minHeight: 650, display: "grid", placeItems: "center", textAlign: "center" }}>
              <div><div style={{ fontSize: 48, marginBottom: 16, animation: "spin 1.7s linear infinite" }}>🌙</div><div style={{ color: "var(--text1)", fontSize: 14 }}>正在加载星空界面...</div></div>
            </div>
          ) : null}

          {screen === "welcome" ? (
            <div className="pv on">
              <div style={{ paddingTop: 32, textAlign: "center" }}>
                <div style={{ fontSize: 68, marginBottom: 18, animation: "popIn .6s ease" }}>🌟</div>
                <LogoMark centered />
                <div style={{ fontSize: 15, color: "var(--text1)", lineHeight: 1.6, margin: "12px 0 40px", padding: "0 8px" }}>
                  陪伴孩子成长的每一步<br /><span style={{ color: "var(--text2)", fontSize: 13 }}>专注 · 激励 · 记录 · 陪伴</span>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 40 }}>
                  <FamilyAvatar icon="👨" label="爸爸" tone="#1A4E35,#0D2E1E" size={52} />
                  <FamilyAvatar icon="👩" label="妈妈" tone="#2D1878,#1A0F48" size={40} offset={8} />
                  <FamilyAvatar icon="🦊" label="小明" tone="#2C1E04,#4A3410" size={52} />
                  <FamilyAvatar icon="👴" label="爷爷" tone="rgba(255,255,255,.06),rgba(255,255,255,.06)" size={36} offset={14} dashed />
                </div>
              </div>
              <button type="button" className="btn-primary" onClick={() => move("role")}>✨ 创建家庭账号</button>
              <button type="button" className="btn-ghost" onClick={() => move("loginWho")}>已有账号，去登录</button>
              <div className="safe-bottom" />
            </div>
          ) : null}

          {screen === "role" ? (
            <div className="pv on" style={{ paddingTop: 24 }}>
              <BackButton onClick={() => move("welcome")} />
              <div className="page-title">你是？</div>
              <div className="page-sub">选择你在家庭中的角色</div>
              <div className="role-cards">
                <RoleCard role="parent" active={role === "parent"} onClick={() => setRole("parent")} icon="👨‍👩‍👧" title="家长" sub={<>爸爸或妈妈<br />创建家庭账号</>} />
                <RoleCard role="elder" active={role === "elder"} onClick={() => setRole("elder")} icon="👴👵" title="其他家人" sub={<>祖父母等<br />用邀请码加入</>} gold />
              </div>
              <div className="info-row"><div className="info-icon">💡</div><div className="info-txt">孩子的账号由家长创建并发送邀请码，孩子无需在此注册</div></div>
              <button type="button" className="btn-primary" disabled={!role} onClick={() => move(role === "elder" ? "elder" : "parent")}>继续</button>
            </div>
          ) : null}

          {screen === "parent" ? (
            <div className="pv on" style={{ paddingTop: 24 }}>
              <BackButton onClick={() => move("role")} />
              <StepBar step={1} />
              <div className="page-title">你的信息</div>
              <div className="page-sub">设置你的家长账号</div>
              <InputGroup label="你的姓名（昵称）" icon="👤" placeholder="例：小明爸爸" value={parentName} onChange={setParentName} />
              <InputGroup label="家庭名称" icon="🏠" placeholder="例：陈家大家庭" value={familyName} onChange={setFamilyName} />
              <InputGroup label="设置密码" icon="🔒" placeholder="至少 6 位" value={parentPassword} onChange={setParentPassword} password />
              <button type="button" className="btn-primary" onClick={parentNext}>下一步 →</button>
            </div>
          ) : null}

          {screen === "child" ? (
            <div className="pv on" style={{ paddingTop: 24 }}>
              <BackButton onClick={() => move("parent")} />
              <StepBar step={2} />
              <div className="page-title">孩子的信息</div>
              <div className="page-sub">家长帮助创建，孩子之后可以自定义头像</div>
              <InputGroup label="孩子姓名（昵称）" icon="🧒" placeholder="例：小明" value={childName} onChange={setChildName} />
              <div className="inp-group"><label className="inp-label">年级</label><div className="grade-scroll">{grades.map((grade) => <button key={grade} type="button" className={`grade-chip ${childGrade === grade ? "sel" : ""}`} onClick={() => setChildGrade(grade)}>{grade}</button>)}</div></div>
              <div className="inp-group"><label className="inp-label">为孩子选择头像</label><div className="avatar-grid">{avatars.map(([avatar, label]) => <button key={avatar} type="button" className={`av-item ${childAvatar === avatar ? "sel" : ""}`} onClick={() => setChildAvatar(avatar)}><span>{avatar}</span><div className="av-item-lbl">{label}</div></button>)}</div></div>
              <button type="button" className="btn-primary" disabled={pending} onClick={() => void registerParent()}>{pending ? "正在创建家庭..." : "下一步 →"}</button>
            </div>
          ) : null}

          {screen === "invite" ? (
            <div className="pv on" style={{ paddingTop: 24 }}>
              <BackButton onClick={() => move("child")} />
              <StepBar step={3} />
              <div className="page-title">家庭邀请码</div>
              <div className="page-sub">把这个码给孩子或其他家人，让他们加入家庭</div>
              <div className="invite-box"><div className="invite-eyebrow">家庭邀请码</div><div className="invite-code">{inviteCode}</div><div className="invite-sub">有效期 7 天 · 可重新生成</div><button type="button" className="invite-copy" onClick={() => void copyInvite()}>📋 复制邀请码</button></div>
              <HowToInvite />
              <button type="button" className="btn-primary" onClick={() => move("members")}>下一步 →</button>
              <button type="button" className="btn-ghost" style={{ fontSize: 13, padding: 12 }} onClick={() => move("members")}>稍后再说，跳过</button>
            </div>
          ) : null}

          {screen === "members" ? (
            <div className="pv on" style={{ paddingTop: 24 }}>
              <BackButton onClick={() => move("invite")} />
              <StepBar step={4} />
              <div className="page-title">家庭已建好 🎉</div>
              <div className="page-sub">确认一下成员信息，随时可以在设置中修改</div>
              <FamilyCard name={displayFamily} sub={`2 位成员 · 邀请码 ${inviteCode}`} avatars={["👨", displayAvatar, "＋"]} />
              <MemberCard avatar="👨" name={displayParent} role="家长 · 管理员" badge="你" badgeTone="purple" />
              <MemberCard avatar={displayAvatar} name={displayChild} role={`孩子 · ${childGrade} · 待加入`} badge="待加入" badgeTone="gold" />
              <button type="button" className="invite-member-row" onClick={() => void copyInvite()}><div className="invite-member-icon">＋</div><div><div className="invite-member-title">邀请其他家人加入</div><span className="invite-member-sub">分享邀请码给祖父母等</span></div></button>
              <button type="button" className="btn-primary gold" onClick={() => move("done")}>进入家庭主页 →</button>
            </div>
          ) : null}

          {screen === "elder" ? (
            <div className="pv on" style={{ paddingTop: 24 }}>
              <BackButton onClick={() => move("role")} />
              <div className="page-title">加入家庭</div><div className="page-sub">输入家长给你的邀请码</div>
              <div className="inp-group"><label className="inp-label">邀请码（6 位）</label><input className="inp" maxLength={6} value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="例：BK7294" style={{ fontSize: 28, fontWeight: 700, letterSpacing: 8, textAlign: "center", textTransform: "uppercase" }} /></div>
              <InputGroup label="你的姓名" icon="👴" placeholder="例：爷爷、姥姥" value={elderName} onChange={setElderName} />
              <div className="inp-group"><label className="inp-label">你与孩子的关系</label><div className="grade-scroll">{["爷爷", "奶奶", "姥爷", "姥姥", "叔叔", "阿姨", "其他"].map((item, index) => <button type="button" key={item} className={`grade-chip ${index === 0 ? "sel" : ""}`}>{item}</button>)}</div></div>
              <InputGroup label="设置密码" icon="🔒" placeholder="至少 6 位" value={elderPassword} onChange={setElderPassword} password />
              <div className="info-row"><div className="info-icon">💡</div><div className="info-txt">其他家人默认只能发起奖励，不能扣款。家长可在设置中调整权限。</div></div>
              <button type="button" className="btn-primary" disabled={pending} onClick={() => void join()}>{pending ? "正在加入家庭..." : "加入家庭"}</button>
            </div>
          ) : null}

          {screen === "elderDone" ? (
            <div className="pv on" style={{ paddingTop: 48, textAlign: "center" }}>
              <div className="success-icon">🎉</div><Confetti />
              <div className="page-title" style={{ textAlign: "center" }}>成功加入！</div>
              <div style={{ fontSize: 14, color: "var(--text1)", margin: "8px 0 28px", lineHeight: 1.6 }}>你已加入<span style={{ color: "var(--gold)", fontWeight: 700 }}> {displayFamily}</span><br />现在可以为孩子送上奖励啦 🎁</div>
              <FamilyCard name={displayFamily} sub="3 位成员" avatars={["👨", displayAvatar, "👴"]} />
              <button type="button" className="btn-primary gold" style={{ marginTop: 8 }} onClick={() => move("done")}>进入家庭主页 →</button>
            </div>
          ) : null}

          {screen === "loginWho" ? (
            <div className="pv on" style={{ paddingTop: 28 }}>
              <BackButton onClick={() => move("welcome")} />
              <div className="page-title">选择登录方式</div><div className="page-sub">你是谁？</div>
              <div className="role-cards"><RoleCard role="parent" active={false} onClick={() => move("login")} icon="👨‍👩‍👧" title="家长 / 家人" sub={<>账号 + 密码<br />进入管理界面</>} showCheck={false} glowColor="rgba(96,165,250,.6)" /><RoleCard role="elder" active={false} onClick={() => move("childLogin")} icon="🧒" title="孩子" sub={<>选我的头像<br />输密码进入</>} gold showCheck={false} glowColor="rgba(245,200,66,.5)" /></div>
              <div className="divider"><div className="divider-line" /><div className="divider-txt">或者</div><div className="divider-line" /></div>
              <div className="info-row"><div className="info-icon">👴</div><div className="info-txt">其他家人请用账号密码登录，登录方式同家长</div></div>
              <button type="button" className="btn-ghost" onClick={() => move("login")}>其他家人 / 密码登录</button>
            </div>
          ) : null}

          {screen === "login" ? (
            <div className="pv on" style={{ paddingTop: 28 }}>
              <BackButton onClick={() => move("loginWho")} /><LogoMark /><div style={{ height: 20 }} />
              <div className="page-title">家长登录</div><div className="page-sub">欢迎回来</div>
              <InputGroup label="账号（用户名）" icon="👤" placeholder="输入你的账号" value={loginUsername} onChange={setLoginUsername} />
              <InputGroup label="密码" icon="🔒" placeholder="输入密码" value={loginPassword} onChange={setLoginPassword} password />
              <div style={{ textAlign: "right", marginBottom: 20 }}><span style={{ fontSize: 12, color: "var(--purple)", cursor: "pointer" }}>忘记密码？</span></div>
              <button type="button" className="btn-primary" disabled={pending} onClick={() => void login()}>{pending ? "正在登录..." : "登录"}</button>
              <div className="link-txt" style={{ marginTop: 16 }}>还没有账号？<button type="button" onClick={() => move("role")}>立即注册</button></div>
            </div>
          ) : null}

          {screen === "childLogin" ? (
            <div className="pv on" style={{ paddingTop: 28 }}>
              <BackButton onClick={() => move("loginWho")} /><div className="page-title">你好！</div><div className="page-sub">选择你的头像来登录</div>
              <div className="face-row single">
                <button type="button" className="face-card sel wide" onClick={() => move(savedChild ? "childPin" : "childJoin")}>
                  <div className="face-av">{displayAvatar}</div>
                  <div className="face-name">{displayChild}</div>
                  <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 1 }}>{savedChild ? `${displayGrade} · 点击解锁` : "还没有加入家庭"}</div>
                </button>
              </div>
              <button type="button" className="btn-ghost" onClick={() => move("childJoin")}>我有邀请码，加入家庭</button>
              <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--bd)", borderRadius: 14, padding: "12px 14px", textAlign: "center", fontSize: 12, color: "var(--text2)" }}>{savedChild ? "这里只显示孩子自己的头像" : "先用家长给的邀请码完成孩子账号设置"}</div>
            </div>
          ) : null}

          {screen === "childJoin" ? (
            <div className="pv on" style={{ paddingTop: 28 }}>
              <BackButton onClick={() => move("childLogin")} />
              <div className="page-title">加入家庭</div><div className="page-sub">输入家长给你的邀请码，设置自己的 PIN</div>
              <div className="inp-group"><label className="inp-label">邀请码（6 位）</label><input className="inp" maxLength={6} value={childJoinCode} onChange={(event) => setChildJoinCode(event.target.value.toUpperCase())} placeholder="例：BK7294" style={{ fontSize: 28, fontWeight: 700, letterSpacing: 8, textAlign: "center", textTransform: "uppercase" }} /></div>
              <InputGroup label="你的昵称" icon="🧒" placeholder="例：小明" value={childJoinName} onChange={setChildJoinName} />
              <div className="inp-group"><label className="inp-label">选择你的头像</label><div className="avatar-grid">{avatars.map(([avatar, label]) => <button key={avatar} type="button" className={`av-item ${childAvatar === avatar ? "sel" : ""}`} onClick={() => setChildAvatar(avatar)}><span>{avatar}</span><div className="av-item-lbl">{label}</div></button>)}</div></div>
              <InputGroup label="设置 4 位 PIN" icon="🔢" placeholder="孩子下次用它登录" value={childJoinPin} onChange={(value) => setChildJoinPin(value.replace(/\D/g, "").slice(0, 4))} password />
              <button type="button" className="btn-primary gold" disabled={pending} onClick={() => void joinChild()}>{pending ? "正在加入家庭..." : "加入家庭并进入"}</button>
            </div>
          ) : null}

          {screen === "childPin" ? (
            <div className="pv on" style={{ paddingTop: 28, textAlign: "center" }}>
              <BackButton onClick={() => move("childLogin")} label="换一个人" />
              <div style={{ fontSize: 52, marginBottom: 8 }}>{displayAvatar}</div><div style={{ fontSize: 18, fontWeight: 700, color: "var(--text0)", marginBottom: 4 }}>{displayChild}，你好！</div><div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>输入 4 位密码解锁</div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}><div style={{ display: "flex", background: "rgba(255,255,255,.05)", border: "1px solid var(--bd)", borderRadius: 99, padding: 3, gap: 3 }}><button type="button" className="auth-mode-button" style={pinMode === "pin" ? activeModeStyle : undefined} onClick={() => setPinMode("pin")}>🔢 数字密码</button><button type="button" className="auth-mode-button" style={pinMode === "pattern" ? activeModeStyle : undefined} onClick={() => setPinMode("pattern")}>🔣 图案解锁</button></div></div>
              {pinMode === "pin" ? <><div className="pin-row">{Array.from({ length: 4 }, (_, index) => <div key={index} className={`pin-box ${index < pin.length ? "filled" : ""} ${index === pin.length ? "active" : ""}`} />)}</div><div className="numpad">{["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => <button type="button" className="npk" key={key} onClick={() => enterPin(key)}><div className="npk-num">{key}</div></button>)}<div /><button type="button" className="npk zero" onClick={() => enterPin("0")}><div className="npk-num">0</div></button><button type="button" className="npk del" onClick={() => setPin((value) => value.slice(0, -1))}><div className="npk-num">⌫</div></button></div></> : <div className="pattern-wrap"><div className="pattern-grid">{Array.from({ length: 9 }, (_, index) => <button type="button" className="pat-node" key={index} onClick={() => setToast("孩子账号将在家庭设置中启用")} />)}</div><div className="pattern-status">滑动连接点来解锁</div></div>}
            </div>
          ) : null}

          {screen === "done" ? (
            <div className="pv on" style={{ paddingTop: 56, textAlign: "center" }}>
              <div className="success-icon">🎊</div><Confetti />
              <div className="page-title" style={{ textAlign: "center" }}>{session?.user.role === "child" ? "加入成功！" : "一切就绪！"}</div><div style={{ fontSize: 14, color: "var(--text1)", margin: "8px 0 32px", lineHeight: 1.65 }}>{session?.user.role === "child" ? "你已经加入家庭啦" : "家庭账号已建好"}<br /><span style={{ color: "var(--text2)", fontSize: 12 }}>{session?.user.role === "child" ? "现在可以开始整理任务和专注啦" : "随时可以在设置中修改成员和权限"}</span></div>
              <FamilyCard name={displayFamily} sub={session?.user.role === "child" ? "孩子 · 已加入" : session?.user.role === "elder" ? "其他家人 · 已加入" : "家长 · 孩子 · 已建立"} avatars={["👨", displayAvatar]} />
              <button type="button" className="btn-primary gold" onClick={() => session && onAuthenticated(session)}>🏠 进入主页</button>
              <div className="safe-bottom" />
            </div>
          ) : null}
        </div>
        {toast ? <div className="toast">{toast}</div> : null}
      </section>
    </main>
  );
}

const activeModeStyle = { background: "rgba(167,139,250,.22)", color: "var(--purple2)" };

function FamilyAvatar({ icon, label, tone, size, offset = 0, dashed = false }: { icon: string; label: string; tone: string; size: number; offset?: number; dashed?: boolean }) {
  return <div style={{ textAlign: "center", marginTop: offset }}><div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${tone})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size / 2), margin: "0 auto 6px", boxShadow: dashed ? undefined : "0 0 0 2px rgba(167,139,250,.2)", border: dashed ? "1px dashed rgba(255,255,255,.15)" : undefined }}>{icon}</div><div style={{ fontSize: 10, color: "var(--text2)" }}>{label}</div></div>;
}

function RoleCard({ role, active, onClick, icon, title, sub, gold = false, showCheck = true, glowColor }: { role: Role; active: boolean; onClick: () => void; icon: string; title: string; sub: React.ReactNode; gold?: boolean; showCheck?: boolean; glowColor?: string }) {
  return <button type="button" className={`role-card ${active ? "sel" : ""} ${gold ? "gold-sel" : ""}`} onClick={onClick}>{showCheck ? <div className="rc-check">{active ? "✓" : ""}</div> : null}<div style={{ position: "absolute", top: -20, right: -20, width: 60, height: 60, background: glowColor ?? (gold ? "rgba(245,200,66,.25)" : "rgba(167,139,250,.3)"), borderRadius: "50%", filter: "blur(16px)" }} /><div className="rc-icon">{icon}</div><div className="rc-title">{title}</div><div className="rc-sub">{sub}</div></button>;
}

function InputGroup({ label, icon, placeholder, value, onChange, password = false }: { label: string; icon: string; placeholder: string; value: string; onChange: (value: string) => void; password?: boolean }) {
  return <div className="inp-group"><label className="inp-label">{label}</label><div className="inp-icon-wrap"><span className="inp-icon">{icon}</span><input className="inp" type={password ? "password" : "text"} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></div></div>;
}

function HowToInvite() {
  return <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--bd)", borderRadius: 18, padding: 16, marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 12 }}>如何使用邀请码</div>{["孩子打开 App，点击“我有邀请码”", "输入邀请码加入家庭", "孩子自选头像 · 设置解锁方式"].map((text, index) => <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: index ? 10 : 0 }}><div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(167,139,250,.2)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, color: "var(--purple2)", flexShrink: 0 }}>{index + 1}</div><div style={{ fontSize: 13, color: "var(--text1)" }}>{text}</div></div>)}</div>;
}

function FamilyCard({ name, sub, avatars }: { name: string; sub: string; avatars: string[] }) {
  return <div className="family-card"><div className="fc-name">{name}</div><div className="fc-sub">{sub}</div><div className="fc-members">{avatars.map((avatar, index) => <div className="fc-av" key={`${avatar}-${index}`} style={index === avatars.length - 1 && avatar === "＋" ? { background: "rgba(255,255,255,.06)", border: "1px dashed rgba(255,255,255,.15)" } : { background: index === 0 ? "linear-gradient(135deg,#1A4E35,#0D2E1E)" : "linear-gradient(135deg,#2C1E04,#4A3410)" }}>{avatar}</div>)}</div></div>;
}

function MemberCard({ avatar, name, role, badge, badgeTone }: { avatar: string; name: string; role: string; badge: string; badgeTone: "purple" | "gold" }) {
  return <div className="member-card"><div className="mc-av" style={{ background: badgeTone === "purple" ? "linear-gradient(135deg,#1A4E35,#0D2E1E)" : "linear-gradient(135deg,#2C1E04,#4A3410)" }}>{avatar}</div><div className="mc-info"><div className="mc-name">{name}</div><div className="mc-role">{role}</div></div><div className="mc-badge" style={{ background: badgeTone === "purple" ? "rgba(167,139,250,.15)" : "rgba(245,200,66,.12)", color: badgeTone === "purple" ? "var(--purple2)" : "var(--gold)" }}>{badge}</div></div>;
}

function Confetti() {
  return <div className="confetti-row"><span className="conf" style={{ animationDelay: ".05s" }}>🎊</span><span className="conf" style={{ animationDelay: ".15s" }}>✨</span><span className="conf" style={{ animationDelay: ".25s" }}>🎉</span><span className="conf" style={{ animationDelay: ".15s" }}>✨</span><span className="conf" style={{ animationDelay: ".05s" }}>🎊</span></div>;
}
