import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthUserEntity } from "../../database/entities/auth-user.entity";
import { ChildProfileEntity } from "../../database/entities/child-profile.entity";
import { FocusRecordEntity } from "../../database/entities/focus-record.entity";
import { GameRecordEntity } from "../../database/entities/game-record.entity";
import { GrowthRecordEntity } from "../../database/entities/growth-record.entity";
import { LedgerEntryEntity } from "../../database/entities/ledger-entry.entity";
import { TaskEntity } from "../../database/entities/task.entity";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuthUserEntity,
      ChildProfileEntity,
      TaskEntity,
      FocusRecordEntity,
      GameRecordEntity,
      LedgerEntryEntity,
      GrowthRecordEntity,
    ]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
