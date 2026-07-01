import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CompanionFocusHeartbeatDto, CompanionFocusQueryDto, FocusStatsQueryDto, SaveFocusRecordDto } from "./dto/focus.dto";
import { FocusService } from "./focus.service";

@Controller("focus")
export class FocusController {
  constructor(private readonly focusService: FocusService) {}

  @Get("stats")
  async stats(@Query() query: FocusStatsQueryDto) {
    return this.ok(await this.focusService.stats(query));
  }

  @Post("records")
  async saveRecord(@Body() dto: SaveFocusRecordDto) {
    return this.ok(await this.focusService.saveRecord(dto));
  }

  @Get("companion")
  async companion(@Query() query: CompanionFocusQueryDto) {
    return this.ok(await this.focusService.companion(query));
  }

  @Post("companion/heartbeat")
  async companionHeartbeat(@Body() dto: CompanionFocusHeartbeatDto) {
    return this.ok(await this.focusService.heartbeat(dto));
  }

  private ok<T>(data: T) {
    return { code: 0, data, message: "ok" };
  }
}
