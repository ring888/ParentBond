import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CreateMemoryDto, MemorySummaryQueryDto } from "./dto/memories.dto";
import { MemoriesService } from "./memories.service";

@Controller("memories")
export class MemoriesController {
  constructor(private readonly memoriesService: MemoriesService) {}

  @Get()
  async summary(@Query() query: MemorySummaryQueryDto) {
    return this.ok(await this.memoriesService.summary(query));
  }

  @Post()
  async create(@Body() dto: CreateMemoryDto) {
    return this.ok(await this.memoriesService.create(dto));
  }

  private ok<T>(data: T) {
    return { code: 0, data, message: "ok" };
  }
}
