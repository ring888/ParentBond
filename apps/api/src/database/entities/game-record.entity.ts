import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

type GameType = "schulte" | "stroop" | "nback" | "reaction";

@Entity({ name: "game_records" })
export class GameRecordEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "varchar", length: 64 })
  userId: string;

  @Column({ name: "game_type", type: "varchar", length: 24 })
  gameType: GameType;

  @Column({ type: "date" })
  date: string;

  @Column({ type: "varchar", length: 24 })
  difficulty: string;

  @Column({ name: "duration_ms", type: "int", default: 0 })
  durationMs: number;

  @Column({ type: "int", nullable: true })
  score?: number | null;

  @Column({ type: "int", nullable: true })
  accuracy?: number | null;

  @Column({ name: "reaction_ms", type: "int", nullable: true })
  reactionMs?: number | null;

  @Column({ name: "miss_count", type: "int", default: 0 })
  missCount: number;

  @Column({ name: "detail_json", type: "text", nullable: true })
  detailJson?: string | null;

  @Column({ name: "completed_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  completedAt: Date;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}
