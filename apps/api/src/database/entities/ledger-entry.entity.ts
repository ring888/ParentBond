import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "ledger_entries" })
export class LedgerEntryEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "child_user_id", type: "varchar", length: 64 })
  childUserId: string;

  @Column({ name: "initiator_user_id", type: "varchar", length: 64 })
  initiatorUserId: string;

  @Column({ type: "varchar", length: 24 })
  type: "reward" | "deduct" | "promise";

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  amount: string;

  @Column({ type: "varchar", length: 240 })
  reason: string;

  @Column({ type: "text", nullable: true })
  evidence: string | null;

  @Column({ type: "varchar", length: 24, default: "pending" })
  status: "pending" | "approved" | "appealing" | "resolved" | "cancelled";

  @Column({ name: "appeal_reason", type: "varchar", length: 360, nullable: true })
  appealReason: string | null;

  @Column({ name: "appeal_evidence", type: "text", nullable: true })
  appealEvidence: string | null;

  @Column({ name: "resolution_note", type: "varchar", length: 360, nullable: true })
  resolutionNote: string | null;

  @Column({ name: "resolved_at", type: "datetime", nullable: true })
  resolvedAt: Date | null;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}
