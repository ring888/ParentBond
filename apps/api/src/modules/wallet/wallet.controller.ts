import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  CreateWalletEntryDto,
  ParentReviewWalletEntryDto,
  ResolveWalletEntryDto,
  UploadWalletEvidenceDto,
  WalletSummaryQueryDto,
} from "./dto/wallet.dto";
import { WalletService } from "./wallet.service";

@Controller("wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async summary(@Query() query: WalletSummaryQueryDto) {
    return this.ok(await this.walletService.summary(query));
  }

  @Post("entries")
  async create(@Body() dto: CreateWalletEntryDto) {
    return this.ok(await this.walletService.createEntry(dto));
  }

  @Post("evidence")
  async uploadEvidence(@Body() dto: UploadWalletEvidenceDto) {
    return this.ok(await this.walletService.uploadEvidence(dto));
  }

  @Patch("entries/:id/resolve")
  async resolve(@Param("id") id: string, @Body() dto: ResolveWalletEntryDto) {
    return this.ok(await this.walletService.resolveEntry(id, dto));
  }

  @Patch("entries/:id/review")
  async review(@Param("id") id: string, @Body() dto: ParentReviewWalletEntryDto) {
    return this.ok(await this.walletService.reviewAppeal(id, dto));
  }

  private ok<T>(data: T) {
    return { code: 0, data, message: "ok" };
  }
}
