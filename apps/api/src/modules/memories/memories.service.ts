import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { AuthUserEntity } from "../../database/entities/auth-user.entity";
import { GrowthRecordEntity } from "../../database/entities/growth-record.entity";
import { CreateMemoryDto, MemorySummaryQueryDto } from "./dto/memories.dto";

type MoodShare = {
  id: string;
  familyName: string;
  authorId: string;
  authorName: string;
  authorRole: AuthUserEntity["role"];
  authorAvatar: string;
  mood: string;
  content: string;
  createdAt: string;
};

type MoodShareSummary = {
  userId: string;
  familyName: string;
  items: MoodShare[];
  updatedAt: string;
};

@Injectable()
export class MemoriesService implements OnModuleInit {
  constructor(
    @InjectRepository(AuthUserEntity)
    private readonly users: Repository<AuthUserEntity>,
    @InjectRepository(GrowthRecordEntity)
    private readonly records: Repository<GrowthRecordEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.ensureGrowthRecordTable();
  }

  async summary(query: MemorySummaryQueryDto): Promise<MoodShareSummary> {
    const viewer = await this.resolveViewer(query.userId);
    const familyKey = this.familyKey(viewer.familyName);
    const records = await this.records.find({
      where: { familyId: familyKey },
      order: { createdAt: "DESC" },
      take: 80,
    });
    const authors = await this.authorMap(records.map((record) => record.authorId));

    return {
      userId: viewer.id,
      familyName: viewer.familyName,
      items: records.map((record) => this.toMoodShare(record, authors.get(record.authorId))),
      updatedAt: new Date().toISOString(),
    };
  }

  async create(dto: CreateMemoryDto): Promise<MoodShareSummary> {
    const viewer = await this.resolveViewer(dto.userId);
    const content = dto.content.trim();
    const mood = dto.mood.trim();

    if (!content) {
      throw new BadRequestException("请先写下想分享的心情");
    }
    if (!mood) {
      throw new BadRequestException("请选择一个心情");
    }

    await this.records.save(
      this.records.create({
        familyId: this.familyKey(viewer.familyName),
        authorId: viewer.id,
        week: mood.slice(0, 12),
        content: content.slice(0, 240),
        isPrivate: false,
        unlockAt: null,
      }),
    );

    return this.summary({ userId: viewer.id });
  }

  private async resolveViewer(userId: string) {
    const viewer = await this.users.findOneBy({ id: userId });
    if (!viewer) throw new NotFoundException("没有找到这个账号");
    return viewer;
  }

  private familyKey(familyName: string) {
    return familyName.slice(0, 64);
  }

  private async authorMap(authorIds: string[]) {
    const uniqueIds = Array.from(new Set(authorIds.filter(Boolean)));
    if (!uniqueIds.length) return new Map<string, AuthUserEntity>();

    const users = await this.users.findBy({ id: In(uniqueIds) });
    return new Map(users.map((user) => [user.id, user]));
  }

  private toMoodShare(record: GrowthRecordEntity, author?: AuthUserEntity | null): MoodShare {
    return {
      id: record.id,
      familyName: author?.familyName ?? record.familyId,
      authorId: record.authorId,
      authorName: this.authorName(author),
      authorRole: author?.role ?? "elder",
      authorAvatar: this.authorAvatar(author),
      mood: record.week || "✨",
      content: record.content,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private authorName(author?: AuthUserEntity | null) {
    if (!author) return "家人";
    if (author.role === "child") return author.childName || author.displayName || "孩子";
    if (author.role === "parent") return author.displayName || "家长";
    return author.displayName || "家人";
  }

  private authorAvatar(author?: AuthUserEntity | null) {
    if (!author) return "✨";
    if (author.role === "child") return author.childAvatar || "🦊";
    if (author.role === "parent") return "👨";
    return "👵";
  }

  private async ensureGrowthRecordTable() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS growth_records (
        id CHAR(36) PRIMARY KEY,
        family_id VARCHAR(64) NOT NULL,
        author_id VARCHAR(64) NOT NULL,
        week VARCHAR(12) NOT NULL,
        content TEXT NOT NULL,
        is_private BOOLEAN NOT NULL DEFAULT FALSE,
        unlock_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_growth_family_created (family_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
}
