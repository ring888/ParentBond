import type { ReactNode } from "react";
import { Bell, BookOpen, Coins, MoonStar, Timer } from "lucide-react";
import type { HomeworkTask } from "@parentbond/shared";
import type { TaskSyncStatus } from "../app/types";
import { formatTimer } from "../app/formatters";
import { ListIcon, ProgressBar } from "./ui";

export function ParentObserverPanel({
  completed,
  total,
  nextTask,
  progress,
  timerRunning,
  secondsLeft,
  syncStatus,
}: {
  completed: number;
  total: number;
  nextTask: HomeworkTask | null;
  progress: number;
  timerRunning: boolean;
  secondsLeft: number;
  syncStatus: TaskSyncStatus;
}) {
  return (
    <aside className="observer-panel" aria-label="父母观察面板">
      <div className="observer-header">
        <span className="label-dot gold">父母观察台</span>
        <h2>看见进展，不制造压力</h2>
        <p>父母端通过实时事件流看到任务进度，只展示关键节奏和可回应的闪光点。</p>
      </div>

      <div className="observer-grid">
        <article>
          <ListIcon icon={<BookOpen size={20} />} label="今日任务" />
          <strong>
            {completed}/{total}
          </strong>
          <span>下一项：{nextTask?.title ?? "暂无任务"}</span>
          <ProgressBar value={progress} />
        </article>
        <article>
          <ListIcon icon={<Timer size={20} />} label="共同专注" />
          <strong>{timerRunning ? "进行中" : "暂停中"}</strong>
          <span>剩余 {formatTimer(secondsLeft)}</span>
        </article>
        <article>
          <ListIcon icon={<Coins size={20} />} label="正向反馈" />
          <strong>{syncStatus === "live" ? "实时同步中" : "等待连接"}</strong>
          <span>孩子每完成一项，父亲端会立即刷新进度</span>
        </article>
        <article>
          <ListIcon icon={<MoonStar size={20} />} label="成长记录" />
          <strong>本周未完成</strong>
          <span>今晚可以只写一句，不写长作文</span>
        </article>
      </div>

      <div className="observer-note">
        <Bell size={18} />
        <p>建议父母只回应具体进步，例如“我看到你先完成了数学”，不把页面变成监督工具。</p>
      </div>
    </aside>
  );
}
