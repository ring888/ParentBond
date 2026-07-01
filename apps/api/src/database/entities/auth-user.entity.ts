import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "auth_users" })
export class AuthUserEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 80, unique: true })
  username: string;

  @Column({ name: "display_name", type: "varchar", length: 80 })
  displayName: string;

  @Column({ name: "family_name", type: "varchar", length: 120 })
  familyName: string;

  @Column({ type: "varchar", length: 16 })
  role: "parent" | "elder" | "child";

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash: string;

  @Column({ name: "pattern_hash", type: "varchar", length: 255, nullable: true })
  patternHash?: string | null;

  @Column({ name: "child_name", type: "varchar", length: 80, nullable: true })
  childName?: string | null;

  @Column({ name: "child_grade", type: "varchar", length: 24, nullable: true })
  childGrade?: string | null;

  @Column({ name: "child_avatar", type: "varchar", length: 32, nullable: true })
  childAvatar?: string | null;

  @Column({ name: "invite_code", type: "char", length: 6, unique: true })
  inviteCode: string;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}
