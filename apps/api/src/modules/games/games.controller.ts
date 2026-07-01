import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { GameSummaryQueryDto, SaveGameRecordDto } from "./dto/games.dto";
import { GamesService } from "./games.service";

@Controller("games")
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get("summary")
  async summary(@Query() query: GameSummaryQueryDto) {
    return this.ok(await this.gamesService.summary(query));
  }

  @Post("records")
  async saveRecord(@Body() dto: SaveGameRecordDto) {
    return this.ok(await this.gamesService.saveRecord(dto));
  }

  private ok<T>(data: T) {
    return { code: 0, data, message: "ok" };
  }
}
