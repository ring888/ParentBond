import { GripVertical, LoaderCircle, Pencil, Plus, Save, Sparkles, Timer, Trash2, Volume2, X } from "lucide-react";
import type { HomeworkTask, Subject } from "@parentbond/shared";
import { subjectMeta } from "../../data/mock";
import type { TaskEditorDraft } from "../../app/types";
import { formatTimer } from "../../app/formatters";
import { ProgressBar, SectionHeader } from "../../components/ui";

export function TasksView({
  tasks,
  progress,
  completed,
  taskDraftText,
  taskFeedback,
  celebratedTaskId,
  draggingTaskId,
  isParsingTasks,
  selectedTaskId,
  resumableTaskId,
  resumableSeconds,
  taskEditor,
  onDraftChange,
  onSubmitDraft,
  onSelectTask,
  onStartFocus,
  onOpenTaskEditor,
  onTaskEditorChange,
  onSaveTaskEditor,
  onCancelTaskEditor,
  onDeleteTask,
  onDragStartTask,
  onDragAtPoint,
  onDragEndTask,
  onTaskItemRef,
  onToggleTask,
}: {
  tasks: HomeworkTask[];
  progress: number;
  completed: number;
  taskDraftText: string;
  taskFeedback: string;
  celebratedTaskId: string | null;
  draggingTaskId: string | null;
  isParsingTasks: boolean;
  selectedTaskId: string | null;
  resumableTaskId: string | null;
  resumableSeconds: number | null;
  taskEditor: TaskEditorDraft | null;
  onDraftChange: (value: string) => void;
  onSubmitDraft: () => void;
  onSelectTask: (taskId: string | null) => void;
  onStartFocus: (taskId: string) => void;
  onOpenTaskEditor: (task?: HomeworkTask) => void;
  onTaskEditorChange: (draft: TaskEditorDraft) => void;
  onSaveTaskEditor: () => void;
  onCancelTaskEditor: () => void;
  onDeleteTask: (taskId: string) => void;
  onDragStartTask: (taskId: string) => void;
  onDragAtPoint: (clientX: number, clientY: number) => void;
  onDragEndTask: () => void;
  onTaskItemRef: (taskId: string, element: HTMLElement | null) => void;
  onToggleTask: (taskId: string) => void;
}) {
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId && !task.completedAt) ??
    tasks.find((task) => !task.completedAt) ??
    null;
  const isResumingSelectedTask = Boolean(selectedTask && selectedTask.id === resumableTaskId);

  return (
    <section className="view-stack task-view">
      <div className={isParsingTasks ? "task-input-card is-parsing" : "task-input-card"}>
        <label className="manual-input">
          <span>今天的作业</span>
          <textarea
            value={taskDraftText}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="请输入今日的任务"
          />
        </label>

        <button
          className={isParsingTasks ? "primary-button gold full is-loading" : "primary-button gold full"}
          type="button"
          onClick={onSubmitDraft}
          disabled={isParsingTasks}
        >
          {isParsingTasks ? <LoaderCircle className="spin-icon" size={18} /> : <Sparkles size={18} />}
          {isParsingTasks ? "正在整理..." : "本地整理成清单"}
        </button>
      </div>

      {taskEditor && (
        <section className="task-editor" aria-label={taskEditor.id ? "编辑任务" : "新增任务"}>
          <div className="task-editor-header">
            <strong>{taskEditor.id ? "编辑任务" : "新增一项任务"}</strong>
            <button
              className="icon-button"
              type="button"
              title="关闭编辑"
              aria-label="关闭编辑"
              onClick={onCancelTaskEditor}
            >
              <X size={18} />
            </button>
          </div>
          <label className="task-editor-title">
            <span>任务名称</span>
            <input
              value={taskEditor.title}
              onChange={(event) => onTaskEditorChange({ ...taskEditor, title: event.target.value })}
              placeholder="例如：完成数学练习册第 5 页"
            />
          </label>
          <div className="task-editor-grid">
            <label>
              <span>科目</span>
              <select
                value={taskEditor.subject}
                onChange={(event) =>
                  onTaskEditorChange({ ...taskEditor, subject: event.target.value as Subject })
                }
              >
                <option value="math">数学</option>
                <option value="chinese">语文</option>
                <option value="english">英语</option>
                <option value="reading">阅读</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label>
              <span>预计分钟</span>
              <input
                type="number"
                min="1"
                max="90"
                value={taskEditor.estimatedMinutes}
                onChange={(event) =>
                  onTaskEditorChange({
                    ...taskEditor,
                    estimatedMinutes: Number(event.target.value) || 5,
                  })
                }
              />
            </label>
          </div>
          <div className="priority-picker" aria-label="任务优先级">
            {([1, 2, 3] as const).map((priority) => (
              <button
                key={priority}
                className={taskEditor.priority === priority ? "active" : ""}
                type="button"
                onClick={() => onTaskEditorChange({ ...taskEditor, priority })}
              >
                {priority === 1 ? "优先做" : priority === 2 ? "普通" : "后做"}
              </button>
            ))}
          </div>
          <button className="primary-button gold full" type="button" onClick={onSaveTaskEditor}>
            <Save size={17} />
            保存任务
          </button>
        </section>
      )}

      <div className="panel-card">
        <div className="progress-row">
          <span>今日进度</span>
          <strong>
            {completed} / {tasks.length}
          </strong>
        </div>
        <ProgressBar value={progress} />
        <div className="positive-toast">
          <Volume2 size={15} />
          {taskFeedback}
        </div>
      </div>

      <div className="task-list-heading">
        <SectionHeader title="今日待办清单" />
        <button
          className="icon-button add-task-button"
          type="button"
          title="新增任务"
          aria-label="新增任务"
          onClick={() => onOpenTaskEditor()}
        >
          <Plus size={19} />
        </button>
      </div>
      {selectedTask && (
        <div className="task-selection-toolbar">
          <span>已选择 1 项</span>
          <div>
            <button
              className="icon-button"
              type="button"
              title="编辑任务"
              aria-label={`编辑任务：${selectedTask.title}`}
              onClick={() => onOpenTaskEditor(selectedTask)}
            >
              <Pencil size={16} />
            </button>
            <button
              className="icon-button danger"
              type="button"
              title="删除任务"
              aria-label={`删除任务：${selectedTask.title}`}
              onClick={() => onDeleteTask(selectedTask.id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
      <div className={draggingTaskId ? "task-list task-list-large sorting" : "task-list task-list-large"}>
        {tasks.length === 0 ? (
          <div className="task-list-empty">请输入今日的任务，或点击右上角新增一项任务。</div>
        ) : null}
        {tasks.map((task) => {
          const meta = subjectMeta[task.subject];
          const isDone = Boolean(task.completedAt);
          const isSelected = selectedTask?.id === task.id;

          return (
            <article
              key={task.id}
              ref={(element) => {
                onTaskItemRef(task.id, element);
              }}
              data-task-id={task.id}
              className={[
                isDone ? "task-item done" : "task-item",
                celebratedTaskId === task.id ? "celebrate" : "",
                draggingTaskId === task.id ? "dragging" : "",
                isSelected ? "selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                className="drag-grip"
                type="button"
                aria-label="按住拖动排序"
                onClick={(event) => event.preventDefault()}
                onContextMenu={(event) => event.preventDefault()}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onDragStartTask(task.id);
                }}
                onPointerMove={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDragAtPoint(event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  onDragEndTask();
                }}
                onPointerCancel={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  onDragEndTask();
                }}
              >
                <GripVertical size={16} />
              </button>
              <span className={`subject-tag ${meta.className}`}>{meta.label}</span>
              <button
                className="task-info task-select"
                type="button"
                onClick={() => onSelectTask(task.id)}
                disabled={isDone}
                aria-label={`选择任务：${task.title}`}
              >
                <strong>{task.title}</strong>
                <span>预计 {task.estimatedMinutes} 分钟</span>
              </button>
              <button
                className={isDone ? "slide-toggle on" : "slide-toggle"}
                type="button"
                onClick={() => onToggleTask(task.id)}
                aria-label={isDone ? "标记未完成" : "滑动确认完成"}
              >
                <span />
              </button>
            </article>
          );
        })}
      </div>
      <button
        className="task-start-button"
        type="button"
        disabled={!selectedTask}
        onClick={() => selectedTask && onStartFocus(selectedTask.id)}
      >
        <span className="task-start-symbol" aria-hidden="true">▶</span>
        <span className="task-start-copy">
          <strong>
            {selectedTask ? (isResumingSelectedTask ? "继续专注" : "开始专注作业") : tasks.length === 0 ? "请先添加任务" : "今日任务已全部完成"}
          </strong>
          <em>
            {selectedTask
              ? isResumingSelectedTask && resumableSeconds !== null
                ? `剩余：${formatTimer(resumableSeconds)}`
                : `当前：${selectedTask.title}`
              : tasks.length === 0
                ? "输入任务后再开始专注"
                : "给自己一点放松时间"}
          </em>
        </span>
      </button>
    </section>
  );
}
