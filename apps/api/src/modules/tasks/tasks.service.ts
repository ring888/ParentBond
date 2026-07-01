import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { from, merge, Observable, Subject } from "rxjs";
import { filter, map } from "rxjs/operators";
import { Repository } from "typeorm";
import { TaskEntity } from "../../database/entities/task.entity";
import { AiService } from "../ai/ai.service";
import { ParseTaskDto } from "./dto/parse-task.dto";
import { SaveTaskListDto, TaskInputDto, TaskQueryDto } from "./dto/task-list.dto";

@Injectable()
export class TasksService {
  private readonly updates = new Subject<{ userId: string; date: string; tasks: TaskEntity[] }>();

  constructor(
    private readonly aiService: AiService,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
  ) {}

  listForDate(query: TaskQueryDto) {
    return this.taskRepository.find({
      where: {
        userId: query.userId,
        date: this.normalizeDate(query.date),
      },
      order: {
        orderIndex: "ASC",
        createdAt: "ASC",
      },
    });
  }

  watch(query: TaskQueryDto): Observable<{ data: { type: "snapshot" | "update"; tasks: TaskEntity[] } }> {
    const userId = query.userId;
    const date = this.normalizeDate(query.date);
    const snapshot$ = from(this.listForDate({ ...query, date })).pipe(
      map((tasks) => ({
        data: {
          type: "snapshot" as const,
          tasks,
        },
      })),
    );
    const updates$ = this.updates.pipe(
      filter((event) => event.userId === userId && event.date === date),
      map((event) => ({
        data: {
          type: "update" as const,
          tasks: event.tasks,
        },
      })),
    );

    return merge(snapshot$, updates$);
  }

  async replaceDayTasks(dto: SaveTaskListDto) {
    const date = this.normalizeDate(dto.date);

    await this.taskRepository.delete({
      userId: dto.userId,
      date,
    });

    const entities = dto.tasks.map((task, index) => this.toEntity(dto.userId, date, task, index));

    const saved = await this.taskRepository.save(entities);
    this.updates.next({ userId: dto.userId, date, tasks: saved });

    return saved;
  }

  async parseHomework(dto: ParseTaskDto) {
    const parsed = await this.aiService.parseHomework(dto.rawText, dto.provider);

    if (!dto.persist || !dto.userId) {
      return parsed;
    }

    const saved = await this.replaceDayTasks({
      userId: dto.userId,
      date: dto.date,
      tasks: parsed.tasks,
    });

    return {
      ...parsed,
      tasks: saved,
    };
  }

  async setComplete(id: string, completed: boolean) {
    const task = await this.taskRepository.findOneByOrFail({ id });

    task.completedAt = completed ? new Date() : null;

    const saved = await this.taskRepository.save(task);
    const tasks = await this.listForDate({
      userId: saved.userId,
      date: saved.date,
    });

    this.updates.next({ userId: saved.userId, date: saved.date, tasks });

    return saved;
  }

  private normalizeDate(date?: string) {
    return (date ?? new Date().toISOString()).slice(0, 10);
  }

  private toEntity(userId: string, date: string, task: TaskInputDto, orderIndex: number) {
    const taskId =
      task.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        task.id,
      )
        ? task.id
        : undefined;

    return this.taskRepository.create({
      ...(taskId ? { id: taskId } : {}),
      userId,
      date,
      subject: task.subject,
      title: task.title,
      estimatedMinutes: task.estimatedMinutes,
      priority: task.priority,
      orderIndex,
      completedAt: task.completedAt ? new Date(task.completedAt) : null,
    });
  }
}
