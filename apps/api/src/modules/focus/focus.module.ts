import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthSessionEntity } from "../../database/entities/auth-session.entity";
import { AuthUserEntity } from "../../database/entities/auth-user.entity";
import { FocusCompanionSessionEntity } from "../../database/entities/focus-companion-session.entity";
import { FocusRecordEntity } from "../../database/entities/focus-record.entity";
import { FocusController } from "./focus.controller";
import { FocusService } from "./focus.service";

@Module({
  imports: [TypeOrmModule.forFeature([FocusRecordEntity, FocusCompanionSessionEntity, AuthUserEntity, AuthSessionEntity])],
  controllers: [FocusController],
  providers: [FocusService],
})
export class FocusModule {}
