import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { ChildProfileSummary, ParentProfileSummary, WalletEntry, WalletEntryType, WalletEvidence, WalletEvidenceKind, WalletSummary } from "@parentbond/shared";
import { createWalletEntry, fetchWalletSummary, reviewWalletEntry, resolveWalletEntry, uploadWalletEvidence } from "../../services/api";
import { formatWalletDate, walletStatusLabel } from "./wallet-formatters";

export function WalletView({
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
        <button className="sec-m wallet-sec-action" type="button" onClick={() => setFeedback("年度报告会根据真实账单自动生成，当前先展示本月收支趋势")}>年度报告</button>
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
