import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "growth_records" })
export class GrowthRecordEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "family_id", type: "varchar", length: 64 })
  familyId: string;

  @Column({ name: "author_id", type: "varchar", length: 64 })
  authorId: string;

  @Column({ type: "varchar", length: 12 })
  week: string;

  @Column({ type: "text" })
  content: string;

  @Column({ name: "is_private", type: "boolean", default: false })
  isPrivate: boolean;

  @Column({ name: "unlock_at", type: "datetime", nullable: true })
  unlockAt?: Date | null;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}
