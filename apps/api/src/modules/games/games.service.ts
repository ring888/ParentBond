import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { GameRecordEntity } from "../../database/entities/game-record.entity";
import { GameSummaryQueryDto, SaveGameRecordDto } from "./dto/games.dto";

type GameType = "schulte" | "stroop" | "nback" | "reaction";

type GameRecord = {
  id: string;
  userId: string;
  gameType: GameType;
  date: string;
  difficulty: string;
  durationMs: number;
  score?: number | null;
  accuracy?: number | null;
  reactionMs?: number | null;
  missCount: number;
  detail?: Record<string, unknown> | null;
  completedAt: string;
  createdAt: string;
};

type GameSummaryItem = {
  gameType: GameType;
  name: string;
  icon: string;
  metricLabel: string;
  bestLabel: string;
  recentLabel: string;
  todayCount: number;
  history: GameRecord[];
  trend: Array<{ label: string; value: number }>;
};

type GameSummary = {
  userId: string;
  date: string;
  todaySessions: number;
  todayMinutes: number;
  totalSessions: number;
  games: GameSummaryItem[];
  updatedAt: string;
};

const gameMeta: Record<GameType, { name: string; icon: string; metricLabel: string; lowerIsBetter: boolean }> = {
  schulte: { name: "舒尔特方格", icon: "🔢", metricLabel: "视觉搜索 · 注意广度", lowerIsBetter: true },
  stroop: { name: "Stroop 冲突", icon: "🎨", metricLabel: "抑制干扰 · 执行控制", lowerIsBetter: false },
  nback: { name: "N-back 记忆", icon: "🧠", metricLabel: "工作记忆 · 持续注意", lowerIsBetter: false },
  reaction: { name: "反应挑战", icon: "⚡", metricLabel: "反应速度 · 抑制平衡", lowerIsBetter: true },
};

const gameTypes = Object.keys(gameMeta) as GameType[];

@Injectable()
export class GamesService implements OnModuleInit {
  constructor(
    @InjectRepository(GameRecordEntity)
    private readonly gameRecords: Repository<GameRecordEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS game_records (
        id CHAR(36) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        game_type VARCHAR(24) NOT NULL,
        date DATE NOT NULL,
        difficulty VARCHAR(24) NOT NULL,
        duration_ms INT NOT NULL DEFAULT 0,
        score INT NULL,
        accuracy INT NULL,
        reaction_ms INT NULL,
        miss_count INT NOT NULL DEFAULT 0,
        detail_json TEXT NULL,
        completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_game_records_user_date (user_id, date),
        INDEX idx_game_records_user_game (user_id, game_type, completed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async summary(query: GameSummaryQueryDto): Promise<GameSummary> {
    const date = this.normalizeDate(query.date);
    const records = await this.gameRecords.find({
      where: { userId: query.userId },
      order: { completedAt: "DESC" },
      take: 120,
    });
    const todayRecords = records.filter((record) => record.date === date);
    const games = gameTypes.map((gameType) => this.summaryItem(gameType, records, todayRecords));

    return {
      userId: query.userId,
      date,
      todaySessions: todayRecords.length,
      todayMinutes: Math.round(todayRecords.reduce((sum, record) => sum + record.durationMs, 0) / 60_000),
      totalSessions: records.length,
      games,
      updatedAt: new Date().toISOString(),
    };
  }

  async saveRecord(dto: SaveGameRecordDto): Promise<GameSummary> {
    const date = this.normalizeDate(dto.date);
    await this.gameRecords.save(
      this.gameRecords.create({
        userId: dto.userId,
        gameType: dto.gameType,
        date,
        difficulty: dto.difficulty.trim(),
        durationMs: dto.durationMs,
        score: dto.score ?? null,
        accuracy: dto.accuracy ?? null,
        reactionMs: dto.reactionMs ?? null,
        missCount: dto.missCount ?? 0,
        detailJson: dto.detail ? JSON.stringify(dto.detail) : null,
        completedAt: new Date(),
      }),
    );

    return this.summary({ userId: dto.userId, date });
  }

  private summaryItem(gameType: GameType, records: GameRecordEntity[], todayRecords: GameRecordEntity[]): GameSummaryItem {
    const meta = gameMeta[gameType];
    const gameRecords = records.filter((record) => record.gameType === gameType);
    const todayCount = todayRecords.filter((record) => record.gameType === gameType).length;
    const best = this.bestRecord(gameType, gameRecords);
    const latest = gameRecords[0];
    const history = gameRecords.slice(0, 8).map((record) => this.toRecord(record));

    return {
      gameType,
      name: meta.name,
      icon: meta.icon,
      metricLabel: meta.metricLabel,
      bestLabel: best ? this.recordLabel(gameType, best) : "暂无记录",
      recentLabel: latest ? this.recordLabel(gameType, latest) : "先完成一轮",
      todayCount,
      history,
      trend: gameRecords
        .slice(0, 7)
        .reverse()
        .map((record, index) => ({
          label: index === Math.min(6, gameRecords.length - 1) ? "最新" : `第${index + 1}次`,
          value: this.recordValue(gameType, record),
        })),
    };
  }

  private bestRecord(gameType: GameType, records: GameRecordEntity[]) {
    const scored = records.filter((record) => this.recordValue(gameType, record) > 0);
    if (!scored.length) return null;
    const lowerIsBetter = gameMeta[gameType].lowerIsBetter;
    return scored.reduce((best, record) => {
      const current = this.recordValue(gameType, record);
      const bestValue = this.recordValue(gameType, best);
      return lowerIsBetter ? (current < bestValue ? record : best) : current > bestValue ? record : best;
    });
  }

  private recordValue(gameType: GameType, record: GameRecordEntity) {
    if (gameType === "schulte") return Number(record.score ?? record.durationMs ?? 0);
    if (gameType === "reaction") return Number(record.reactionMs ?? record.score ?? 0);
    return Number(record.accuracy ?? record.score ?? 0);
  }

  private recordLabel(gameType: GameType, record: GameRecordEntity) {
    if (gameType === "schulte") return `${(this.recordValue(gameType, record) / 1000).toFixed(1)}s`;
    if (gameType === "reaction") return `${this.recordValue(gameType, record)}ms`;
    return `${this.recordValue(gameType, record)}%`;
  }

  private toRecord(record: GameRecordEntity): GameRecord {
    return {
      id: record.id,
      userId: record.userId,
      gameType: record.gameType,
      date: record.date,
      difficulty: record.difficulty,
      durationMs: record.durationMs,
      score: record.score ?? null,
      accuracy: record.accuracy ?? null,
      reactionMs: record.reactionMs ?? null,
      missCount: record.missCount,
      detail: this.parseDetail(record.detailJson),
      completedAt: record.completedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    };
  }

  private parseDetail(raw?: string | null) {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private normalizeDate(date?: string) {
    return (date ?? new Date().toISOString()).slice(0, 10);
  }
}
