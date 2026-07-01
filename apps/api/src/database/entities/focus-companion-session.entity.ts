import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "focus_companion_sessions" })
export class FocusCompanionSessionEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "family_name", type: "varchar", length: 120 })
  familyName: string;

  @Column({ name: "child_user_id", type: "varchar", length: 64 })
  childUserId: string;

  @Column({ name: "parent_user_id", type: "varchar", length: 64, nullable: true })
  parentUserId?: string | null;

  @Column({ type: "varchar", length: 12 })
  mode: "daily" | "task";

  @Column({ name: "task_id", type: "char", length: 36, nullable: true })
  taskId?: string | null;

  @Column({ name: "task_title", type: "varchar", length: 180, nullable: true })
  taskTitle?: string | null;

  @Column({ type: "varchar", length: 16, default: "active" })
  status: "active" | "ended";

  @Column({ name: "seconds_left", type: "int", default: 0 })
  secondsLeft: number;

  @Column({ name: "total_seconds", type: "int", default: 0 })
  totalSeconds: number;

  @Column({ name: "ends_at", type: "datetime", nullable: true })
  endsAt?: Date | null;

  @Column({ name: "child_running", type: "boolean", default: false })
  childRunning: boolean;

  @Column({ name: "parent_joined", type: "boolean", default: false })
  parentJoined: boolean;

  @Column({ name: "last_child_seen_at", type: "datetime", nullable: true })
  lastChildSeenAt?: Date | null;

  @Column({ name: "last_parent_seen_at", type: "datetime", nullable: true })
  lastParentSeenAt?: Date | null;

  @Column({ name: "started_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  startedAt: Date;

  @Column({ name: "ended_at", type: "datetime", nullable: true })
  endedAt?: Date | null;

  @Column({ name: "updated_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date;
}
