import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "child_profiles" })
export class ChildProfileEntity {
  @PrimaryColumn({ name: "user_id", type: "varchar", length: 64 })
  userId: string;

  @Column({ name: "child_name", type: "varchar", length: 80 })
  childName: string;

  @Column({ name: "child_grade", type: "varchar", length: 24 })
  childGrade: string;

  @Column({ name: "child_avatar", type: "varchar", length: 32 })
  childAvatar: string;

  @Column({ name: "avatar_label", type: "varchar", length: 40, default: "小狐狸" })
  avatarLabel: string;

  @Column({ name: "pin_mode", type: "varchar", length: 16, default: "pin" })
  pinMode: "pin" | "pattern";

  @Column({ name: "unlock_age", type: "int", default: 18 })
  unlockAge: number;

  @Column({ name: "weekly_reminder", type: "boolean", default: true })
  weeklyReminder: boolean;

  @Column({ name: "wallet_balance", type: "decimal", precision: 10, scale: 2, default: 0 })
  walletBalance: string;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime" })
  updatedAt: Date;
}
