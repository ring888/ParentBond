import { type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ChildProfileSummary, FocusStats, ParentProfileSummary, UpdateChildProfileInput, UpdateParentProfileInput } from "@parentbond/shared";
import { PATTERN_HIT_RADIUS, childAvatarOptions } from "../../app/constants";
import type { ProfileSyncStatus } from "../../app/types";
import { fallbackBadges, fallbackFocusWeek, focusWeekWithToday, formatFocusDuration, formatFocusMinutes, formatMoney, localDateString } from "../../app/formatters";

export function ParentProfileView({
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

export function ChildProfileView({
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
  const [linePoints, setLinePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [pointerPoint, setPointerPoint] = useState<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState("按住星点滑动");
  const gridRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const pathRef = useRef<number[]>([]);
  const linePointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const activeRef = useRef(false);
  const lastTouchRef = useRef(0);

  const setPathValue = (next: number[]) => {
    pathRef.current = next;
    setPath(next);
  };

  const setLinePointsValue = (next: Array<{ x: number; y: number }>) => {
    linePointsRef.current = next;
    setLinePoints(next);
  };

  const pointFromClient = (clientX: number, clientY: number) => {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    return {
      x: Math.min(Math.max(clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(clientY - rect.top, 0), rect.height),
    };
  };

  const centerOfNode = (nodeNumber: number) => {
    const grid = gridRef.current;
    const node = nodeRefs.current[nodeNumber - 1];
    if (!grid || !node) return null;
    const gridRect = grid.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - gridRect.left,
      y: rect.top + rect.height / 2 - gridRect.top,
    };
  };

  const addNode = (node: number) => {
    const current = pathRef.current;
    if (current.includes(node)) return;
    setPathValue([...current, node]);
    const center = centerOfNode(node);
    if (center) {
      setLinePointsValue([...linePointsRef.current, center]);
      setPointerPoint(center);
    }
    setStatus(current.length >= 2 ? "松手完成" : "继续连接");
  };

  const nodeFromPoint = (clientX: number, clientY: number) => {
    for (const [index, node] of nodeRefs.current.entries()) {
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      if (Math.hypot(clientX - centerX, clientY - centerY) <= PATTERN_HIT_RADIUS) {
        return index + 1;
      }
    }
    return null;
  };

  const beginAt = (clientX: number, clientY: number) => {
    activeRef.current = true;
    setPathValue([]);
    setLinePointsValue([]);
    setPointerPoint(pointFromClient(clientX, clientY));
    setStatus("继续连接");
    const node = nodeFromPoint(clientX, clientY);
    if (node) addNode(node);
  };

  const moveAt = (clientX: number, clientY: number) => {
    if (!activeRef.current) return;
    setPointerPoint(pointFromClient(clientX, clientY));
    const node = nodeFromPoint(clientX, clientY);
    if (node) addNode(node);
  };

  const pointFromTouchEvent = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
  };

  const beginTouch = (event: ReactTouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    lastTouchRef.current = window.Date.now();
    const point = pointFromTouchEvent(event);
    if (point) beginAt(point.clientX, point.clientY);
  };

  const moveTouch = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!activeRef.current) return;
    event.preventDefault();
    lastTouchRef.current = window.Date.now();
    const point = pointFromTouchEvent(event);
    if (point) moveAt(point.clientX, point.clientY);
  };

  const finishTouch = (event: ReactTouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    lastTouchRef.current = window.Date.now();
    finish();
  };

  const beginMouse = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (window.Date.now() - lastTouchRef.current < 700) return;
    event.preventDefault();
    beginAt(event.clientX, event.clientY);
  };

  const moveMouse = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!activeRef.current) return;
    event.preventDefault();
    moveAt(event.clientX, event.clientY);
  };

  const finishMouse = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!activeRef.current) return;
    event.preventDefault();
    finish();
  };

  const finish = () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    const pattern = pathRef.current.join("");
    if (pattern.length < 4) {
      setStatus("至少连接 4 个点");
      window.setTimeout(() => {
        setPathValue([]);
        setLinePointsValue([]);
        setPointerPoint(null);
        setStatus("按住星点滑动");
      }, 650);
      return;
    }
    onComplete(pattern);
    setPathValue([]);
    setLinePointsValue([]);
    setPointerPoint(null);
    setStatus("按住星点滑动");
  };

  const drawPoints = pointerPoint && linePoints.length ? [...linePoints, pointerPoint] : linePoints;

  return (
    <>
      <div
        ref={gridRef}
        className="profile-pattern-grid"
        role="application"
        aria-label="图案解锁九宫格"
        onTouchStart={beginTouch}
        onTouchMove={moveTouch}
        onTouchEnd={finishTouch}
        onTouchCancel={finishTouch}
        onMouseDown={beginMouse}
        onMouseMove={moveMouse}
        onMouseUp={finishMouse}
        onMouseLeave={finishMouse}
      >
        {drawPoints.length > 1 ? (
          <svg className="profile-pattern-canvas" aria-hidden="true">
            <polyline points={drawPoints.map((point) => `${point.x},${point.y}`).join(" ")} />
          </svg>
        ) : null}
        {Array.from({ length: 9 }, (_, index) => (
          <span
            key={index}
            ref={(element) => {
              nodeRefs.current[index] = element;
            }}
            className={path.includes(index + 1) ? "profile-pattern-node lit" : "profile-pattern-node"}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="profile-pattern-status">{status}</div>
    </>
  );
}
