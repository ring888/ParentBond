import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "focus_records" })
export class FocusRecordEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "varchar", length: 64 })
  userId: string;

  @Column({ type: "date" })
  date: string;

  @Column({ type: "varchar", length: 12 })
  mode: "daily" | "task";

  @Column({ name: "task_id", type: "char", length: 36, nullable: true })
  taskId?: string | null;

  @Column({ name: "duration_seconds", type: "int", default: 0 })
  durationSeconds: number;

  @Column({ name: "completed_at", type: "datetime", nullable: true })
  completedAt?: Date | null;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}
