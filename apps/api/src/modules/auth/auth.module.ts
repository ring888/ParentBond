import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthSessionEntity } from "../../database/entities/auth-session.entity";
import { AuthUserEntity } from "../../database/entities/auth-user.entity";
import { FocusRecordEntity } from "../../database/entities/focus-record.entity";
import { LedgerEntryEntity } from "../../database/entities/ledger-entry.entity";
import { TaskEntity } from "../../database/entities/task.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [TypeOrmModule.forFeature([AuthUserEntity, AuthSessionEntity, TaskEntity, FocusRecordEntity, LedgerEntryEntity])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
