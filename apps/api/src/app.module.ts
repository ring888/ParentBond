import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthSessionEntity } from "./database/entities/auth-session.entity";
import { AuthUserEntity } from "./database/entities/auth-user.entity";
import { ChildProfileEntity } from "./database/entities/child-profile.entity";
import { FocusCompanionSessionEntity } from "./database/entities/focus-companion-session.entity";
import { FocusRecordEntity } from "./database/entities/focus-record.entity";
import { GameRecordEntity } from "./database/entities/game-record.entity";
import { GrowthRecordEntity } from "./database/entities/growth-record.entity";
import { LedgerEntryEntity } from "./database/entities/ledger-entry.entity";
import { TaskEntity } from "./database/entities/task.entity";
import { UserEntity } from "./database/entities/user.entity";
import { AiModule } from "./modules/ai/ai.module";
import { AuthModule } from "./modules/auth/auth.module";
import { FocusModule } from "./modules/focus/focus.module";
import { GamesModule } from "./modules/games/games.module";
import { HealthModule } from "./modules/health/health.module";
import { MemoriesModule } from "./modules/memories/memories.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { WalletModule } from "./modules/wallet/wallet.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["apps/api/.env", ".env"],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "mysql",
        host: config.get<string>("MYSQL_HOST", "127.0.0.1"),
        port: config.get<number>("MYSQL_PORT", 3306),
        username: config.get<string>("MYSQL_USER", "parentbond"),
        password: config.get<string>("MYSQL_PASSWORD", ""),
        database: config.get<string>("MYSQL_DATABASE", "parentbond"),
        entities: [
          UserEntity,
          TaskEntity,
          LedgerEntryEntity,
          GrowthRecordEntity,
          FocusRecordEntity,
          FocusCompanionSessionEntity,
          AuthUserEntity,
          AuthSessionEntity,
          ChildProfileEntity,
          GameRecordEntity,
        ],
        synchronize: false,
        charset: "utf8mb4",
      }),
    }),
    HealthModule,
    AiModule,
    AuthModule,
    FocusModule,
    GamesModule,
    MemoriesModule,
    ProfileModule,
    TasksModule,
    WalletModule,
  ],
})
export class AppModule {}
