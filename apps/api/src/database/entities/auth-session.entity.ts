import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "auth_sessions" })
export class AuthSessionEntity {
  @PrimaryColumn({ type: "char", length: 64 })
  token: string;

  @Column({ name: "user_id", type: "char", length: 36 })
  userId: string;

  @Column({ name: "expires_at", type: "datetime" })
  expiresAt: Date;

  @Column({ name: "last_seen_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  lastSeenAt: Date;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}
