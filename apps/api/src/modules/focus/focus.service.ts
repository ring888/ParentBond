import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AuthSessionEntity } from "../../database/entities/auth-session.entity";
import { AuthUserEntity } from "../../database/entities/auth-user.entity";
import { FocusCompanionSessionEntity } from "../../database/entities/focus-companion-session.entity";
import { FocusRecordEntity } from "../../database/entities/focus-record.entity";
import { CompanionFocusHeartbeatDto, CompanionFocusQueryDto, FocusStatsQueryDto, SaveFocusRecordDto } from "./dto/focus.dto";

type FocusStats = {
  completedSessionsToday: number;
  totalSecondsToday: number;
  streakDays: number;
};

@Injectable()
export class FocusService implements OnModuleInit {
  constructor(
    @InjectRepository(FocusRecordEntity)
    private readonly focusRecordRepository: Repository<FocusRecordEntity>,
    @InjectRepository(FocusCompanionSessionEntity)
    private readonly companionSessions: Repository<FocusCompanionSessionEntity>,
    @InjectRepository(AuthUserEntity)
    private readonly users: Repository<AuthUserEntity>,
    @InjectRepository(AuthSessionEntity)
    private readonly sessions: Repository<AuthSessionEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.ensureCompanionSessionTable();
    await this.ensureCompanionSessionColumns();
  }

  async stats(query: FocusStatsQueryDto): Promise<FocusStats> {
    const date = this.normalizeDate(query.date);
    const total = await this.focusRecordRepository
      .createQueryBuilder("record")
      .select("COALESCE(SUM(record.durationSeconds), 0)", "totalSeconds")
      .where("record.userId = :userId", { userId: query.userId })
      .andWhere("record.date = :date", { date })
      .getRawOne<{ totalSeconds: string }>();
    const completedSessionsToday = await this.focusRecordRepository
      .createQueryBuilder("record")
      .where("record.userId = :userId", { userId: query.userId })
      .andWhere("record.date = :date", { date })
      .andWhere("record.completedAt IS NOT NULL")
      .getCount();
    const dateRows = await this.focusRecordRepository
      .createQueryBuilder("record")
      .select("DISTINCT DATE_FORMAT(record.date, '%Y-%m-%d')", "date")
      .where("record.userId = :userId", { userId: query.userId })
      .andWhere("record.durationSeconds > 0")
      .orderBy("DATE_FORMAT(record.date, '%Y-%m-%d')", "DESC")
      .getRawMany<{ date: string }>();

    let expectedDate = date;
    let streakDays = 0;
    for (const row of dateRows) {
      const recordDate = row.date;
      if (recordDate !== expectedDate) break;
      streakDays += 1;
      expectedDate = this.previousDate(expectedDate);
    }

    return {
      completedSessionsToday,
      totalSecondsToday: Number(total?.totalSeconds ?? 0),
      streakDays,
    };
  }

  async saveRecord(dto: SaveFocusRecordDto): Promise<FocusStats> {
    const date = this.normalizeDate(dto.date);
    await this.focusRecordRepository.save(
      this.focusRecordRepository.create({
        userId: dto.userId,
        date,
        mode: dto.mode,
        taskId: dto.taskId ?? null,
        durationSeconds: dto.durationSeconds,
        completedAt: dto.completed ? new Date() : null,
      }),
    );

    return this.stats({ userId: dto.userId, date });
  }

  async companion(query: CompanionFocusQueryDto) {
    const context = await this.resolveFamilyContext(query.userId);
    return this.toCompanionState(context);
  }

  async heartbeat(dto: CompanionFocusHeartbeatDto) {
    const context = await this.resolveFamilyContext(dto.userId);
    const now = new Date();
    let activeSession = await this.findActiveCompanionSession(context.familyName);

    if (context.viewer.role === "child") {
      if (dto.active === false) {
        if (activeSession?.status === "active") {
          activeSession.status = "ended";
          activeSession.endedAt = now;
          activeSession.lastChildSeenAt = now;
          activeSession.updatedAt = now;
          await this.companionSessions.save(activeSession);
        }
      } else if (dto.mode) {
        const taskId = dto.mode === "task" ? dto.taskId ?? null : null;
        const taskTitle = dto.mode === "task" ? dto.taskTitle?.trim().slice(0, 180) || null : null;
        const shouldStartNew =
          !activeSession ||
          activeSession.mode !== dto.mode ||
          (activeSession.taskId ?? null) !== taskId ||
          activeSession.status !== "active";

        if (shouldStartNew) {
          if (activeSession?.status === "active") {
            activeSession.status = "ended";
            activeSession.endedAt = now;
            activeSession.updatedAt = now;
            await this.companionSessions.save(activeSession);
          }

          activeSession = this.companionSessions.create({
            familyName: context.familyName,
            childUserId: context.childUserId,
            parentUserId: null,
            mode: dto.mode,
            taskId,
            taskTitle,
            status: "active",
            secondsLeft: this.clampSeconds(dto.secondsLeft ?? dto.totalSeconds ?? 0, 0),
            totalSeconds: this.clampSeconds(dto.totalSeconds ?? dto.secondsLeft ?? 0, 1),
            childRunning: Boolean(dto.running),
            endsAt: dto.running
              ? new Date(now.getTime() + this.clampSeconds(dto.secondsLeft ?? dto.totalSeconds ?? 0, 0) * 1000)
              : null,
            parentJoined: false,
            lastChildSeenAt: now,
            startedAt: now,
            updatedAt: now,
          });
        }

        const session = activeSession;
        if (!session) {
          return this.toCompanionState(context);
        }

        session.familyName = context.familyName;
        session.childUserId = context.childUserId;
        session.mode = dto.mode;
        session.taskId = taskId;
        session.taskTitle = taskTitle;
        session.secondsLeft = this.clampSeconds(dto.secondsLeft ?? session.secondsLeft, 0);
        session.totalSeconds = this.clampSeconds(dto.totalSeconds ?? session.totalSeconds, 1);
        session.childRunning = Boolean(dto.running && session.secondsLeft > 0);
        session.endsAt = session.childRunning ? new Date(now.getTime() + session.secondsLeft * 1000) : null;
        session.lastChildSeenAt = now;
        session.updatedAt = now;

        if (session.secondsLeft <= 0 && !session.childRunning) {
          session.status = "ended";
          session.endedAt = now;
        } else {
          session.status = "active";
          session.endedAt = null;
        }

        await this.companionSessions.save(session);
      }
    } else if (activeSession?.status === "active") {
      activeSession.parentUserId = context.viewer.id;
      activeSession.parentJoined = dto.active === false ? false : true;
      activeSession.lastParentSeenAt = now;
      activeSession.updatedAt = now;
      await this.companionSessions.save(activeSession);
    }

    return this.toCompanionState(context);
  }

  private normalizeDate(date?: string) {
    return (date ?? new Date().toISOString()).slice(0, 10);
  }

  private previousDate(date: string) {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() - 1);
    return value.toISOString().slice(0, 10);
  }

  private async resolveFamilyContext(viewerUserId: string) {
    const viewer = await this.users.findOneBy({ id: viewerUserId });
    if (!viewer) throw new NotFoundException("User not found");

    const members = await this.users.findBy({ familyName: viewer.familyName });
    const child = viewer.role === "child"
      ? viewer
      : members.find((member) => member.role === "child") ?? null;
    const parent = members.find((member) => member.role === "parent") ?? (viewer.role !== "child" ? viewer : null);

    return {
      viewer,
      members,
      familyName: viewer.familyName,
      childUserId: child?.id ?? parent?.id ?? viewer.id,
      child,
      parent,
    };
  }

  private async toCompanionState(context: Awaited<ReturnType<FocusService["resolveFamilyContext"]>>) {
    const serverNow = new Date();
    const activeSession = await this.findActiveCompanionSession(context.familyName);
    const parentPresence = await this.userPresence(context.parent?.id ?? activeSession?.parentUserId ?? null);
    const childPresence = await this.userPresence(context.childUserId);
    const sessionChildOnline = this.isRecent(activeSession?.lastChildSeenAt ?? null);

    return {
      familyName: context.familyName,
      childUserId: context.childUserId,
      parentUserId: context.parent?.id ?? activeSession?.parentUserId ?? null,
      parentName: context.parent?.displayName ?? null,
      childOnline: childPresence.online || sessionChildOnline,
      parentOnline: parentPresence.online,
      childLastSeenAt: (activeSession?.lastChildSeenAt ?? childPresence.lastSeenAt)?.toISOString() ?? null,
      parentLastSeenAt: (activeSession?.lastParentSeenAt ?? parentPresence.lastSeenAt)?.toISOString() ?? null,
      activeSession: activeSession ? this.toSessionPayload(activeSession, serverNow) : null,
      serverNow: serverNow.toISOString(),
      updatedAt: serverNow.toISOString(),
    };
  }

  private async findActiveCompanionSession(familyName: string) {
    const staleCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
    return this.companionSessions
      .createQueryBuilder("session")
      .where("session.familyName = :familyName", { familyName })
      .andWhere("session.status = :status", { status: "active" })
      .andWhere("session.updatedAt >= :staleCutoff", { staleCutoff })
      .orderBy("session.updatedAt", "DESC")
      .getOne();
  }

  private async userPresence(userId: string | null | undefined) {
    if (!userId) return { online: false, lastSeenAt: null as Date | null };

    const now = new Date();
    const cutoff = new Date(Date.now() - 90_000);
    const session = await this.sessions
      .createQueryBuilder("session")
      .where("session.userId = :userId", { userId })
      .andWhere("session.expiresAt > :now", { now })
      .orderBy("session.lastSeenAt", "DESC")
      .getOne();

    const lastSeenAt = session?.lastSeenAt ?? null;
    return {
      online: Boolean(lastSeenAt && lastSeenAt >= cutoff),
      lastSeenAt,
    };
  }

  private isRecent(value: Date | null | undefined) {
    return Boolean(value && value.getTime() >= Date.now() - 90_000);
  }

  private toSessionPayload(session: FocusCompanionSessionEntity, serverNow = new Date()) {
    const liveSecondsLeft = session.childRunning && session.endsAt
      ? Math.max(0, Math.ceil((session.endsAt.getTime() - serverNow.getTime()) / 1000))
      : session.secondsLeft;
    return {
      id: session.id,
      familyName: session.familyName,
      childUserId: session.childUserId,
      parentUserId: session.parentUserId ?? null,
      mode: session.mode,
      taskId: session.taskId ?? null,
      taskTitle: session.taskTitle ?? null,
      status: session.status,
      secondsLeft: liveSecondsLeft,
      totalSeconds: session.totalSeconds,
      endsAt: session.endsAt ? session.endsAt.toISOString() : null,
      childRunning: Boolean(session.childRunning),
      parentJoined: Boolean(session.parentJoined),
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt ? session.endedAt.toISOString() : null,
      lastChildSeenAt: session.lastChildSeenAt ? session.lastChildSeenAt.toISOString() : null,
      lastParentSeenAt: session.lastParentSeenAt ? session.lastParentSeenAt.toISOString() : null,
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  private clampSeconds(value: number, minimum: number) {
    if (!Number.isFinite(value)) return minimum;
    return Math.max(minimum, Math.min(14400, Math.round(value)));
  }

  private async ensureCompanionSessionTable() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS focus_companion_sessions (
        id CHAR(36) PRIMARY KEY,
        family_name VARCHAR(120) NOT NULL,
        child_user_id VARCHAR(64) NOT NULL,
        parent_user_id VARCHAR(64) NULL,
        mode VARCHAR(12) NOT NULL,
        task_id CHAR(36) NULL,
        task_title VARCHAR(180) NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        seconds_left INT NOT NULL DEFAULT 0,
        total_seconds INT NOT NULL DEFAULT 0,
        ends_at DATETIME NULL,
        child_running BOOLEAN NOT NULL DEFAULT FALSE,
        parent_joined BOOLEAN NOT NULL DEFAULT FALSE,
        last_child_seen_at DATETIME NULL,
        last_parent_seen_at DATETIME NULL,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_focus_companion_family_status (family_name, status, updated_at),
        INDEX idx_focus_companion_child (child_user_id, updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async ensureCompanionSessionColumns() {
    const rows = await this.dataSource.query(
      "SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'focus_companion_sessions' AND COLUMN_NAME = 'ends_at'",
    ) as Array<{ count: string | number }>;
    if (Number(rows[0]?.count ?? 0) > 0) return;

    await this.dataSource.query("ALTER TABLE focus_companion_sessions ADD COLUMN ends_at DATETIME NULL AFTER total_seconds");
  }
}
