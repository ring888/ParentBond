import { Body, Controller, Get, Param, Patch, Post, Query, Sse } from "@nestjs/common";
import { ParseTaskDto } from "./dto/parse-task.dto";
import { CompleteTaskDto, SaveTaskListDto, TaskQueryDto } from "./dto/task-list.dto";
import { TasksService } from "./tasks.service";

@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get("today")
  async today(@Query() query: TaskQueryDto) {
    return this.ok(await this.tasksService.listForDate(query));
  }

  @Sse("stream")
  stream(@Query() query: TaskQueryDto) {
    return this.tasksService.watch(query);
  }

  @Post("lists")
  async saveList(@Body() dto: SaveTaskListDto) {
    return this.ok(await this.tasksService.replaceDayTasks(dto));
  }

  @Post("parse")
  async parse(@Body() dto: ParseTaskDto) {
    return this.ok(await this.tasksService.parseHomework(dto));
  }

  @Patch(":id/complete")
  async complete(@Param("id") id: string, @Body() dto: CompleteTaskDto) {
    return this.ok(await this.tasksService.setComplete(id, dto.completed ?? true));
  }

  private ok<T>(data: T) {
    return {
      code: 0,
      data,
      message: "ok",
    };
  }
}
