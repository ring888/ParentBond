import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Between, DataSource, Repository } from "typeorm";
import { AuthUserEntity } from "../../database/entities/auth-user.entity";
import { ChildProfileEntity } from "../../database/entities/child-profile.entity";
import { LedgerEntryEntity } from "../../database/entities/ledger-entry.entity";
import {
  CreateWalletEntryDto,
  ParentReviewWalletEntryDto,
  ResolveWalletEntryDto,
  UploadWalletEvidenceDto,
  WalletSummaryQueryDto,
} from "./dto/wallet.dto";

type WalletEvidence = {
  kind: "photo" | "audio" | "video";
  label: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
};

type WalletEntry = {
  id: string;
  childUserId: string;
  initiatorUserId: string;
  initiatorName: string;
  type: "reward" | "deduct";
  amount: number;
  reason: string;
  evidence?: WalletEvidence | null;
  status: "pending" | "approved" | "appealing" | "resolved" | "cancelled";
  appealReason?: string | null;
  appealEvidence?: WalletEvidence | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
};

type WalletSummary = {
  viewerRole: "child" | "parent" | "elder";
  child: {
    userId: string;
    name: string;
    grade: string;
    avatar: string;
    joined: boolean;
  };
  balance: number;
  stats: {
    monthlyRewardAmount: number;
    monthlyDeductAmount: number;
    monthlyRewardCount: number;
    monthlyDeductCount: number;
    pendingAmount: number;
    pendingCount: number;
  };
  weekBuckets: Array<{
    label: string;
    rewardAmount: number;
    deductAmount: number;
    current: boolean;
  }>;
  entries: WalletEntry[];
  updatedAt: string;
};

const MAX_EVIDENCE_FILE_SIZE = 12 * 1024 * 1024;

const walletEvidenceMimeTypes: Record<WalletEvidence["kind"], string[]> = {
  photo: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
  audio: ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/aac", "audio/x-m4a"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
};

const walletEvidenceExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "audio/webm": ".webm",
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/aac": ".aac",
  "audio/x-m4a": ".m4a",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

@Injectable()
export class WalletService implements OnModuleInit {
  constructor(
    @InjectRepository(AuthUserEntity)
    private readonly users: Repository<AuthUserEntity>,
    @InjectRepository(ChildProfileEntity)
    private readonly childProfiles: Repository<ChildProfileEntity>,
    @InjectRepository(LedgerEntryEntity)
    private readonly ledgerEntries: Repository<LedgerEntryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.ensureLedgerAppealColumns();
  }

  async summary(query: WalletSummaryQueryDto): Promise<WalletSummary> {
    const context = await this.resolveFamilyContext(query.userId);
    const entries = await this.ledgerEntries.find({
      where: { childUserId: context.childUserId },
      order: { createdAt: "DESC" },
      take: 80,
    });
    const familyMembers = await this.users.findBy({ familyName: context.viewer.familyName });
    const memberNameById = new Map(familyMembers.map((member) => [member.id, member.displayName]));
    const childProfile = await this.childProfiles.findOneBy({ userId: context.childUserId });

    return {
      viewerRole: context.viewer.role,
      child: context.child,
      balance: await this.walletBalance(context.childUserId, Number(childProfile?.walletBalance ?? 0)),
      stats: await this.walletStats(context.childUserId),
      weekBuckets: await this.weekBuckets(context.childUserId),
      entries: entries.map((entry) => this.toWalletEntry(entry, memberNameById)),
      updatedAt: new Date().toISOString(),
    };
  }

  async createEntry(dto: CreateWalletEntryDto): Promise<WalletEntry> {
    const context = await this.resolveFamilyContext(dto.userId, dto.childUserId);
    if (context.viewer.role === "child") {
      throw new ForbiddenException("孩子不能发起零花钱变动");
    }

    const entry = await this.ledgerEntries.save(
      this.ledgerEntries.create({
        childUserId: context.childUserId,
        initiatorUserId: context.viewer.id,
        type: dto.type,
        amount: dto.amount.toFixed(2),
        reason: dto.reason.trim(),
        evidence: this.stringifyEvidence(dto.evidence ?? null),
        status: "pending",
      }),
    );

    return this.toWalletEntry(entry, new Map([[context.viewer.id, context.viewer.displayName]]));
  }

  async resolveEntry(id: string, dto: ResolveWalletEntryDto): Promise<WalletEntry> {
    const context = await this.resolveFamilyContext(dto.userId);
    const entry = await this.ledgerEntries.findOneBy({ id });
    if (!entry || entry.childUserId !== context.childUserId) {
      throw new NotFoundException("账单不存在");
    }
    if (context.viewer.role !== "child") {
      throw new ForbiddenException("只有孩子可以确认或申诉这笔记录");
    }
    if (entry.status !== "pending") {
      return this.toWalletEntry(entry, new Map([[context.viewer.id, context.viewer.displayName]]));
    }

    if (dto.status === "appealing") {
      if (entry.type !== "deduct") {
        throw new BadRequestException("奖励不能提交异议");
      }
      const appealReason = dto.appealReason?.trim();
      if (!appealReason) {
        throw new BadRequestException("请填写异议原因");
      }
      entry.appealReason = appealReason;
      entry.appealEvidence = this.stringifyEvidence(dto.appealEvidence ?? null);
      entry.resolutionNote = null;
      entry.resolvedAt = null;
    } else {
      entry.appealReason = null;
      entry.appealEvidence = null;
      entry.resolutionNote = null;
      entry.resolvedAt = new Date();
    }
    entry.status = dto.status;
    const saved = await this.ledgerEntries.save(entry);
    const familyMembers = await this.users.findBy({ familyName: context.viewer.familyName });
    return this.toWalletEntry(saved, new Map(familyMembers.map((member) => [member.id, member.displayName])));
  }

  async reviewAppeal(id: string, dto: ParentReviewWalletEntryDto): Promise<WalletEntry> {
    const context = await this.resolveFamilyContext(dto.userId);
    const entry = await this.ledgerEntries.findOneBy({ id });
    if (!entry || entry.childUserId !== context.childUserId) {
      throw new NotFoundException("账单不存在");
    }
    if (context.viewer.role === "child") {
      throw new ForbiddenException("只有家长可以处理异议");
    }
    if (entry.status !== "appealing") {
      return this.toWalletEntry(entry, new Map([[context.viewer.id, context.viewer.displayName]]));
    }

    entry.status = dto.status;
    entry.resolutionNote = dto.resolutionNote?.trim() || (dto.status === "approved" ? "家长已说明原因，维持扣款" : "家长已取消这笔扣款");
    entry.resolvedAt = new Date();
    const saved = await this.ledgerEntries.save(entry);
    const familyMembers = await this.users.findBy({ familyName: context.viewer.familyName });
    return this.toWalletEntry(saved, new Map(familyMembers.map((member) => [member.id, member.displayName])));
  }

  async uploadEvidence(dto: UploadWalletEvidenceDto): Promise<WalletEvidence> {
    await this.resolveFamilyContext(dto.userId);

    const mimeType = dto.mimeType.split(";")[0]?.trim().toLowerCase() || dto.mimeType;
    const allowedMimeTypes = walletEvidenceMimeTypes[dto.kind];
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException("不支持的附件类型");
    }

    const [, rawBase64 = dto.dataBase64] = dto.dataBase64.match(/^data:[^;]+;base64,(.+)$/) ?? [];
    let buffer: Buffer;
    try {
      buffer = Buffer.from(rawBase64, "base64");
    } catch {
      throw new BadRequestException("附件内容解析失败");
    }
    if (buffer.length < 1) {
      throw new BadRequestException("附件内容为空");
    }
    if (buffer.length > MAX_EVIDENCE_FILE_SIZE) {
      throw new BadRequestException("附件不能超过 12MB");
    }

    const now = new Date();
    const monthFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const extension = walletEvidenceExtensions[mimeType] ?? (extname(dto.fileName) || ".bin");
    const safeName = `${dto.kind}-${randomUUID()}${extension.toLowerCase()}`;
    const relativeDir = join("wallet", monthFolder);
    const uploadRoot = join(process.cwd(), "apps", "api", "uploads");
    const targetDir = join(uploadRoot, relativeDir);
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, safeName), buffer);

    return {
      kind: dto.kind,
      label: this.evidenceKindLabel(dto.kind),
      fileName: dto.fileName,
      mimeType,
      size: buffer.length,
      url: `/uploads/${relativeDir.replace(/\\/g, "/")}/${safeName}`,
      createdAt: now.toISOString(),
    };
  }

  private async resolveFamilyContext(viewerUserId: string, requestedChildUserId?: string) {
    const viewer = await this.users.findOneBy({ id: viewerUserId });
    if (!viewer) throw new NotFoundException("用户不存在");

    const familyMembers = await this.users.findBy({ familyName: viewer.familyName });
    const familyChild = familyMembers.find((member) => member.role === "child");
    const familyParent = familyMembers.find((member) => member.role === "parent");
    const requestedChild = requestedChildUserId
      ? familyMembers.find((member) => member.id === requestedChildUserId && member.role === "child")
      : null;
    const childUser = viewer.role === "child" ? viewer : requestedChild ?? familyChild ?? null;
    const placeholderOwner = familyParent ?? viewer;
    const childUserId = childUser?.id ?? placeholderOwner.id;
    const childSource = childUser ?? placeholderOwner;

    return {
      viewer,
      childUserId,
      child: {
        userId: childUserId,
        name: childSource.childName || childSource.displayName || "孩子",
        grade: childSource.childGrade || "四年级",
        avatar: childSource.childAvatar || "🦊",
        joined: Boolean(childUser),
      },
    };
  }

  private async walletStats(childUserId: string): Promise<WalletSummary["stats"]> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const rows = await this.ledgerEntries.find({
      where: { childUserId, createdAt: Between(monthStart, new Date()) },
    });
    const effective = rows.filter((entry) => entry.status === "approved" || entry.status === "resolved");
    const rewards = effective.filter((entry) => entry.type === "reward");
    const deductions = effective.filter((entry) => entry.type === "deduct");
    const pending = rows.filter((entry) => entry.status === "pending");

    return {
      monthlyRewardAmount: this.sum(rewards),
      monthlyDeductAmount: this.sum(deductions),
      monthlyRewardCount: rewards.length,
      monthlyDeductCount: deductions.length,
      pendingAmount: this.sum(pending),
      pendingCount: pending.length,
    };
  }

  private async weekBuckets(childUserId: string): Promise<WalletSummary["weekBuckets"]> {
    const now = new Date();
    const buckets = Array.from({ length: 4 }, (_, index) => {
      const end = new Date(now);
      end.setDate(now.getDate() - (3 - index) * 7);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return {
        start,
        end,
        label: index === 3 ? "本周" : `第${index + 1}周`,
        rewardAmount: 0,
        deductAmount: 0,
        current: index === 3,
      };
    });

    const rows = await this.ledgerEntries.find({
      where: { childUserId, createdAt: Between(buckets[0].start, buckets[3].end) },
    });

    for (const entry of rows) {
      const bucket = buckets.find((item) => entry.createdAt >= item.start && entry.createdAt <= item.end);
      if (!bucket) continue;
      if (entry.status !== "approved" && entry.status !== "resolved") continue;
      if (entry.type === "reward") bucket.rewardAmount += Number(entry.amount);
      if (entry.type === "deduct") bucket.deductAmount += Number(entry.amount);
    }

    return buckets.map(({ label, rewardAmount, deductAmount, current }) => ({
      label,
      rewardAmount,
      deductAmount,
      current,
    }));
  }

  private async walletBalance(childUserId: string, profileBalance: number) {
    const raw = await this.ledgerEntries
      .createQueryBuilder("entry")
      .select(
        "COALESCE(SUM(CASE WHEN entry.type = 'deduct' THEN -entry.amount WHEN entry.type = 'reward' THEN entry.amount ELSE 0 END), 0)",
        "balance",
      )
      .where("entry.childUserId = :childUserId", { childUserId })
      .andWhere("entry.status IN (:...statuses)", { statuses: ["approved", "resolved"] })
      .getRawOne<{ balance: string }>();
    return Number(raw?.balance ?? 0) + profileBalance;
  }

  private toWalletEntry(entry: LedgerEntryEntity, memberNameById: Map<string, string>): WalletEntry {
    return {
      id: entry.id,
      childUserId: entry.childUserId,
      initiatorUserId: entry.initiatorUserId,
      initiatorName: memberNameById.get(entry.initiatorUserId) ?? "家人",
      type: entry.type === "deduct" ? "deduct" : "reward",
      amount: Number(entry.amount),
      reason: entry.reason,
      evidence: this.parseEvidence(entry.evidence),
      status: entry.status,
      appealReason: entry.appealReason ?? null,
      appealEvidence: this.parseEvidence(entry.appealEvidence),
      resolutionNote: entry.resolutionNote ?? null,
      resolvedAt: entry.resolvedAt ? entry.resolvedAt.toISOString() : null,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  private stringifyEvidence(evidence: WalletEvidence | null | undefined) {
    return evidence ? JSON.stringify(evidence) : null;
  }

  private parseEvidence(raw: string | null): WalletEvidence | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<WalletEvidence>;
      if (
        parsed &&
        (parsed.kind === "photo" || parsed.kind === "audio" || parsed.kind === "video") &&
        typeof parsed.url === "string" &&
        typeof parsed.fileName === "string"
      ) {
        return {
          kind: parsed.kind,
          label: parsed.label || this.evidenceKindLabel(parsed.kind),
          fileName: parsed.fileName,
          mimeType: parsed.mimeType || "application/octet-stream",
          size: Number(parsed.size ?? 0),
          url: parsed.url,
          createdAt: parsed.createdAt || new Date().toISOString(),
        };
      }
    } catch {
      const legacyKind = raw.includes("录音") || raw.includes("褰曢煶") ? "audio" : raw.includes("视频") || raw.includes("瑙嗛") ? "video" : "photo";
      return {
        kind: legacyKind,
        label: raw,
        fileName: raw,
        mimeType: "",
        size: 0,
        url: "",
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  }

  private evidenceKindLabel(kind: WalletEvidence["kind"]) {
    if (kind === "audio") return "录音";
    if (kind === "video") return "视频";
    return "照片";
  }

  private async ensureLedgerAppealColumns() {
    const columns: Array<{ name: string; definition: string }> = [
      { name: "appeal_reason", definition: "VARCHAR(360) NULL" },
      { name: "evidence", definition: "TEXT NULL" },
      { name: "appeal_evidence", definition: "TEXT NULL" },
      { name: "resolution_note", definition: "VARCHAR(360) NULL" },
      { name: "resolved_at", definition: "DATETIME NULL" },
    ];
    for (const column of columns) {
      await this.ensureLedgerColumn(column.name, column.definition);
    }
  }

  private async ensureLedgerColumn(columnName: string, definition: string) {
    const exists = await this.ledgerColumnExists(columnName);
    if (!exists) {
      await this.dataSource.query(`ALTER TABLE ledger_entries ADD COLUMN ${columnName} ${definition}`);
      return;
    }
    if ((columnName === "evidence" || columnName === "appeal_evidence") && !(await this.ledgerColumnIsText(columnName))) {
      await this.dataSource.query(`ALTER TABLE ledger_entries MODIFY COLUMN ${columnName} ${definition}`);
    }
  }

  private async ledgerColumnExists(columnName: string) {
    const rows = await this.dataSource.query(
      "SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ledger_entries' AND COLUMN_NAME = ?",
      [columnName],
    ) as Array<{ count: string | number }>;
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async ledgerColumnIsText(columnName: string) {
    const rows = await this.dataSource.query(
      "SELECT DATA_TYPE AS dataType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ledger_entries' AND COLUMN_NAME = ?",
      [columnName],
    ) as Array<{ dataType: string }>;
    return rows[0]?.dataType?.toLowerCase() === "text";
  }

  private sum(entries: LedgerEntryEntity[]) {
    return entries.reduce((total, entry) => total + Number(entry.amount), 0);
  }
}
