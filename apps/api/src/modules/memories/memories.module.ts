import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthUserEntity } from "../../database/entities/auth-user.entity";
import { GrowthRecordEntity } from "../../database/entities/growth-record.entity";
import { MemoriesController } from "./memories.controller";
import { MemoriesService } from "./memories.service";

@Module({
  imports: [TypeOrmModule.forFeature([AuthUserEntity, GrowthRecordEntity])],
  controllers: [MemoriesController],
  providers: [MemoriesService],
})
export class MemoriesModule {}
