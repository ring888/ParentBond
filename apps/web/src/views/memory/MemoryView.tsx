import { MoonStar, Send } from "lucide-react";
import type { MoodShareSummary } from "@parentbond/shared";
import { moodOptions } from "../../app/constants";
import type { MemorySyncStatus } from "../../app/types";
import { localDateString } from "../../app/formatters";
import { SectionHeader } from "../../components/ui";

export function MemoryView({
  memoryText,
  memoryMood,
  memorySummary,
  memorySyncStatus,
  onMemoryText,
  onMemoryMood,
  onSaveMemory,
}: {
  memoryText: string;
  memoryMood: string;
  memorySummary: MoodShareSummary | null;
  memorySyncStatus: MemorySyncStatus;
  onMemoryText: (value: string) => void;
  onMemoryMood: (value: string) => void;
  onSaveMemory: () => void;
}) {
  const syncText =
    memorySyncStatus === "saving"
      ? "保存中"
      : memorySyncStatus === "loading"
        ? "同步中"
        : memorySyncStatus === "offline"
          ? "离线"
          : "已同步";
  const records = memorySummary?.items ?? [];
  const canSave = memoryText.trim().length > 0 && memorySyncStatus !== "saving";

  return (
    <section className="view-stack">
      <div className="memory-input-card">
        <div className="memory-input-head">
          <span className="label-dot">心情分享</span>
          <em className={memorySyncStatus === "offline" ? "memory-sync offline" : "memory-sync"}>{syncText}</em>
        </div>
        <div className="mood-picker" aria-label="选择心情">
          {moodOptions.map((item) => (
            <button
              key={item.mood}
              className={memoryMood === item.mood ? "mood-chip active" : "mood-chip"}
              type="button"
              onClick={() => onMemoryMood(item.mood)}
              aria-label={item.label}
            >
              <span aria-hidden="true">{item.mood}</span>
              <em>{item.label}</em>
            </button>
          ))}
        </div>
        <textarea
          value={memoryText}
          onChange={(event) => onMemoryText(event.target.value)}
          placeholder="今天心情怎么样？可以写给爸爸妈妈，也可以写给自己。"
          maxLength={240}
        />
        <div className="memory-actions">
          <span>{memoryText.length}/240</span>
          <button className="primary-button compact" type="button" disabled={!canSave} onClick={onSaveMemory}>
            <Send size={16} />
            {memorySyncStatus === "saving" ? "保存中" : "分享"}
          </button>
        </div>
      </div>

      <SectionHeader title="家庭心情流" action={records.length ? `${records.length} 条` : "今天开始"} />
      <div className="memory-list">
        {records.length ? (
          records.map((memory) => (
            <article key={memory.id} className="memory-card">
              <div className="memory-card-head">
                <span className="memory-avatar" aria-hidden="true">{memory.authorAvatar}</span>
                <div>
                  <strong>{memory.authorName}</strong>
                  <span className="memory-meta">
                    {formatMemoryDate(memory.createdAt)}
                    <em>{memory.mood}</em>
                  </span>
                </div>
              </div>
              <p>{memory.content}</p>
              <footer>
                <strong>{memory.authorRole === "child" ? "孩子分享" : "家人回应"}</strong>
                <em>
                  <MoonStar size={12} />
                  已同步
                </em>
              </footer>
            </article>
          ))
        ) : (
          <div className="memory-empty-state">
            <span aria-hidden="true">🌙</span>
            <strong>还没有心情分享</strong>
            <p>从一句“今天我有点开心”开始，这里会慢慢长成家庭的小小心情日记。</p>
          </div>
        )}
      </div>
    </section>
  );
}

function formatMemoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const today = localDateString();
  const target = localDateString(date);
  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  if (target === today) return `今天 ${time}`;
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
