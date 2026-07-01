import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthUserEntity } from "../../database/entities/auth-user.entity";
import { ChildProfileEntity } from "../../database/entities/child-profile.entity";
import { LedgerEntryEntity } from "../../database/entities/ledger-entry.entity";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [TypeOrmModule.forFeature([AuthUserEntity, ChildProfileEntity, LedgerEntryEntity])],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
