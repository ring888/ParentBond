import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "tasks" })
export class TaskEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "varchar", length: 64 })
  userId: string;

  @Column({ type: "date" })
  date: string;

  @Column({ type: "varchar", length: 24 })
  subject: "math" | "chinese" | "english" | "reading" | "other";

  @Column({ type: "varchar", length: 180 })
  title: string;

  @Column({ name: "estimated_minutes", type: "int", default: 20 })
  estimatedMinutes: number;

  @Column({ type: "int", default: 2 })
  priority: 1 | 2 | 3;

  @Column({ name: "order_index", type: "int", default: 0 })
  orderIndex: number;

  @Column({ name: "completed_at", type: "datetime", nullable: true })
  completedAt?: Date | null;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}
