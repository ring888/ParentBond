import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GameRecordEntity } from "../../database/entities/game-record.entity";
import { GamesController } from "./games.controller";
import { GamesService } from "./games.service";

@Module({
  imports: [TypeOrmModule.forFeature([GameRecordEntity])],
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
