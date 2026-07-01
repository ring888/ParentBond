import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "users" })
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "family_id", type: "varchar", length: 64 })
  familyId: string;

  @Column({ type: "varchar", length: 24 })
  role: "child" | "parent" | "elder";

  @Column({ type: "varchar", length: 80 })
  name: string;

  @Column({ name: "birth_date", type: "date", nullable: true })
  birthDate?: string | null;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}
