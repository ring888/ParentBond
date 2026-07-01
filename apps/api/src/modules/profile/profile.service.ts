import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AuthUserEntity } from "../../database/entities/auth-user.entity";
import { ChildProfileEntity } from "../../database/entities/child-profile.entity";
import { FocusRecordEntity } from "../../database/entities/focus-record.entity";
import { GameRecordEntity } from "../../database/entities/game-record.entity";
import { GrowthRecordEntity } from "../../database/entities/growth-record.entity";
import { LedgerEntryEntity } from "../../database/entities/ledger-entry.entity";
import { TaskEntity } from "../../database/entities/task.entity";
import { ChildProfileQueryDto, ParentProfileQueryDto, UpdateChildProfileDto, UpdateParentProfileDto } from "./dto/profile.dto";

const weekLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const subjectMeta: Record<TaskEntity["subject"], { label: string; icon: string }> = {
  math: { label: "数学", icon: "📐" },
  chinese: { label: "语文", icon: "✍️" },
  english: { label: "英语", icon: "🌍" },
  reading: { label: "阅读", icon: "📚" },
  other: { label: "其他", icon: "✨" },
};

const gameMeta: Record<GameRecordEntity["gameType"], { name: string; icon: string }> = {
  schulte: { name: "舒尔特方格", icon: "🎯" },
  stroop: { name: "颜色冲突", icon: "🎨" },
  nback: { name: "N-back 记忆", icon: "🧠" },
  reaction: { name: "反应挑战", icon: "⚡" },
};

type ChildProfileBadge = {
  id: string;
  icon: string;
  label: string;
  earned: boolean;
  tone: "gold" | "purple" | "green" | "neutral";
};

type ChildProfileSummary = {
  userId: string;
  familyName: string;
  childName: string;
  childGrade: string;
  childAvatar: string;
  avatarLabel: string;
  stats: {
    tomatoCount: number;
    streakDays: number;
    walletBalance: number;
    monthlyRewardAmount: number;
    pendingRewardAmount: number;
    pendingRewardCount: number;
    growthStories: number;
    pendingLetters: number;
    completedTasksToday: number;
    totalTasksToday: number;
    totalFocusSecondsToday: number;
  };
  focusWeek: Array<{ date: string; label: string; totalSeconds: number }>;
  badges: ChildProfileBadge[];
  settings: {
    pinMode: "pin" | "pattern";
    unlockAge: number;
    weeklyReminder: boolean;
  };
  updatedAt: string;
};

type ParentProfileMember = {
  id: string;
  name: string;
  role: "child" | "parent" | "elder";
  roleLabel: string;
  avatar: string;
  badge: string;
};

type ParentProfileSummary = {
  userId: string;
  displayName: string;
  familyName: string;
  role: "parent" | "elder";
  inviteCode: string;
  child: {
    userId: string;
    name: string;
    grade: string;
    avatar: string;
    joined: boolean;
  };
  stats: {
    memberCount: number;
    childRecordDays: number;
    monthlyRewards: number;
    monthlyDeductions: number;
    walletBalance: number;
    monthlyRewardAmount: number;
    monthlyDeductAmount: number;
    pendingRewardAmount: number;
    pendingRewardCount: number;
    companionStreakDays: number;
    childFocusSecondsToday: number;
    completedTasksToday: number;
    totalTasksToday: number;
  };
  focusWeek: Array<{ date: string; label: string; totalSeconds: number }>;
  members: ParentProfileMember[];
  updatedAt: string;
};

type ParentChildTimelineItem = {
  id: string;
  kind: "focus" | "task" | "game" | "wallet";
  time: string;
  occurredAt: string;
  title: string;
  detail: string;
  icon: string;
  tone: "green" | "purple" | "gold" | "blue" | "coral";
  value?: string | null;
};

type ParentChildSubjectStat = {
  subject: TaskEntity["subject"];
  label: string;
  icon: string;
  completed: number;
  total: number;
  percent: number;
};

type ParentChildDetailSummary = {
  userId: string;
  familyName: string;
  child: ParentProfileSummary["child"];
  stats: {
    completedTasksToday: number;
    totalTasksToday: number;
    totalFocusSecondsToday: number;
    walletBalance: number;
    pendingRewardAmount: number;
    pendingRewardCount: number;
    streakDays: number;
    monthlyRewardAmount: number;
    monthlyDeductAmount: number;
    gameSessionsToday: number;
  };
  timeline: ParentChildTimelineItem[];
  subjectStats: ParentChildSubjectStat[];
  focusWeek: ParentProfileSummary["focusWeek"];
  walletHistory: Array<{
    id: string;
    type: "reward" | "deduct";
    amount: number;
    reason: string;
    status: "pending" | "approved" | "appealing" | "resolved" | "cancelled";
    initiatorName: string;
    createdAt: string;
  }>;
  updatedAt: string;
};

@Injectable()
export class ProfileService implements OnModuleInit {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(AuthUserEntity)
    private readonly authUsers: Repository<AuthUserEntity>,
    @InjectRepository(ChildProfileEntity)
    private readonly childProfiles: Repository<ChildProfileEntity>,
    @InjectRepository(TaskEntity)
    private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(FocusRecordEntity)
    private readonly focusRecords: Repository<FocusRecordEntity>,
    @InjectRepository(GameRecordEntity)
    private readonly gameRecords: Repository<GameRecordEntity>,
    @InjectRepository(LedgerEntryEntity)
    private readonly ledgerEntries: Repository<LedgerEntryEntity>,
    @InjectRepository(GrowthRecordEntity)
    private readonly growthRecords: Repository<GrowthRecordEntity>,
  ) {}

  async onModuleInit() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS child_profiles (
        user_id VARCHAR(64) PRIMARY KEY,
        child_name VARCHAR(80) NOT NULL,
        child_grade VARCHAR(24) NOT NULL,
        child_avatar VARCHAR(32) NOT NULL,
        avatar_label VARCHAR(40) NOT NULL DEFAULT '小狐狸',
        pin_mode VARCHAR(16) NOT NULL DEFAULT 'pin',
        unlock_age INT NOT NULL DEFAULT 18,
        weekly_reminder BOOLEAN NOT NULL DEFAULT TRUE,
        wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async childSummary(query: ChildProfileQueryDto): Promise<ChildProfileSummary> {
    const user = await this.authUsers.findOneBy({ id: query.userId });
    if (!user) {
      throw new NotFoundException("没有找到这个家庭账号");
    }

    const profile = await this.ensureProfile(user);
    const today = this.normalizeDate();
    const focusWeek = await this.focusWeek(query.userId);
    const todayTasks = await this.tasks.findBy({ userId: query.userId, date: today });
    const completedTasksToday = todayTasks.filter((task) => task.completedAt).length;
    const tomatoCount = await this.focusRecords
      .createQueryBuilder("record")
      .where("record.userId = :userId", { userId: query.userId })
      .andWhere("record.completedAt IS NOT NULL")
      .getCount();
    const totalFocusSecondsToday = focusWeek[focusWeek.length - 1]?.totalSeconds ?? 0;
    const streakDays = await this.streakDays(query.userId, today);
    const growthStories = await this.growthRecords.countBy({ familyId: user.familyName });
    const pendingLetters = await this.growthRecords.countBy({ familyId: user.familyName, isPrivate: true });
    const walletBalance = await this.walletBalance(query.userId, Number(profile.walletBalance ?? 0));
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyRewards = await this.ledgerEntries
      .createQueryBuilder("entry")
      .select("COALESCE(SUM(entry.amount), 0)", "amount")
      .where("entry.childUserId = :userId", { userId: query.userId })
      .andWhere("entry.type = :type", { type: "reward" })
      .andWhere("entry.createdAt >= :monthStart", { monthStart })
      .andWhere("entry.status IN (:...statuses)", { statuses: ["approved", "resolved"] })
      .getRawOne<{ amount: string }>();
    const pendingRewards = await this.ledgerEntries
      .createQueryBuilder("entry")
      .select("COUNT(*)", "count")
      .addSelect("COALESCE(SUM(entry.amount), 0)", "amount")
      .where("entry.childUserId = :userId", { userId: query.userId })
      .andWhere("entry.type = :type", { type: "reward" })
      .andWhere("entry.status = :status", { status: "pending" })
      .getRawOne<{ count: string; amount: string }>();

    return {
      userId: query.userId,
      familyName: user.familyName,
      childName: profile.childName,
      childGrade: profile.childGrade,
      childAvatar: profile.childAvatar,
      avatarLabel: profile.avatarLabel,
      stats: {
        tomatoCount,
        streakDays,
        walletBalance,
        monthlyRewardAmount: Number(monthlyRewards?.amount ?? 0),
        pendingRewardAmount: Number(pendingRewards?.amount ?? 0),
        pendingRewardCount: Number(pendingRewards?.count ?? 0),
        growthStories,
        pendingLetters,
        completedTasksToday,
        totalTasksToday: todayTasks.length,
        totalFocusSecondsToday,
      },
      focusWeek,
      badges: this.badges({
        tomatoCount,
        streakDays,
        completedTasksToday,
        totalTasksToday: todayTasks.length,
      }),
      settings: {
        pinMode: profile.pinMode,
        unlockAge: profile.unlockAge,
        weeklyReminder: profile.weeklyReminder,
      },
      updatedAt: (profile.updatedAt ?? profile.createdAt ?? new Date()).toISOString(),
    };
  }

  async updateChildProfile(dto: UpdateChildProfileDto): Promise<ChildProfileSummary> {
    const user = await this.authUsers.findOneBy({ id: dto.userId });
    if (!user) {
      throw new NotFoundException("没有找到这个家庭账号");
    }

    const profile = await this.ensureProfile(user);

    if (dto.childName !== undefined) {
      profile.childName = dto.childName.trim();
      user.childName = profile.childName;
    }
    if (dto.childGrade !== undefined) {
      profile.childGrade = dto.childGrade.trim();
      user.childGrade = profile.childGrade;
    }
    if (dto.childAvatar !== undefined) {
      profile.childAvatar = dto.childAvatar.trim();
      user.childAvatar = profile.childAvatar;
    }
    if (dto.avatarLabel !== undefined) profile.avatarLabel = dto.avatarLabel.trim();
    if (dto.pinMode !== undefined) profile.pinMode = dto.pinMode;
    if (dto.unlockAge !== undefined) profile.unlockAge = dto.unlockAge;
    if (dto.weeklyReminder !== undefined) profile.weeklyReminder = dto.weeklyReminder;

    await this.authUsers.save(user);
    await this.childProfiles.save(profile);

    return this.childSummary({ userId: dto.userId });
  }

  async parentSummary(query: ParentProfileQueryDto): Promise<ParentProfileSummary> {
    const user = await this.authUsers.findOneBy({ id: query.userId });
    if (!user || user.role === "child") {
      throw new NotFoundException("没有找到这个家长账号");
    }

    const today = this.normalizeDate();
    const members = await this.authUsers.findBy({ familyName: user.familyName });
    const childUser = members.find((member) => member.role === "child");
    const childUserId = childUser?.id ?? user.id;
    const todayTasks = await this.tasks.findBy({ userId: childUserId, date: today });
    const focusWeek = await this.focusWeek(childUserId);
    const companionStreakDays = await this.streakDays(childUserId, today);
    const childFocusSecondsToday = focusWeek[focusWeek.length - 1]?.totalSeconds ?? 0;
    const childRecordDays = await this.focusRecords
      .createQueryBuilder("record")
      .select("COUNT(DISTINCT record.date)", "count")
      .where("record.userId = :userId", { userId: childUserId })
      .getRawOne<{ count: string }>();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyRewards = await this.ledgerEntries
      .createQueryBuilder("entry")
      .where("entry.childUserId = :childUserId", { childUserId })
      .andWhere("entry.type = :type", { type: "reward" })
      .andWhere("entry.createdAt >= :monthStart", { monthStart })
      .getCount();
    const monthlyDeductions = await this.ledgerEntries
      .createQueryBuilder("entry")
      .where("entry.childUserId = :childUserId", { childUserId })
      .andWhere("entry.type = :type", { type: "deduct" })
      .andWhere("entry.createdAt >= :monthStart", { monthStart })
      .getCount();
    const monthlyLedger = await this.ledgerEntries
      .createQueryBuilder("entry")
      .select(
        "COALESCE(SUM(CASE WHEN entry.type = 'reward' THEN entry.amount ELSE 0 END), 0)",
        "rewardAmount",
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN entry.type = 'deduct' THEN entry.amount ELSE 0 END), 0)",
        "deductAmount",
      )
      .where("entry.childUserId = :childUserId", { childUserId })
      .andWhere("entry.createdAt >= :monthStart", { monthStart })
      .andWhere("entry.status IN (:...statuses)", { statuses: ["approved", "resolved"] })
      .getRawOne<{ rewardAmount: string; deductAmount: string }>();
    const pendingRewards = await this.ledgerEntries
      .createQueryBuilder("entry")
      .select("COUNT(*)", "count")
      .addSelect("COALESCE(SUM(entry.amount), 0)", "amount")
      .where("entry.childUserId = :childUserId", { childUserId })
      .andWhere("entry.type = :type", { type: "reward" })
      .andWhere("entry.status = :status", { status: "pending" })
      .getRawOne<{ count: string; amount: string }>();
    const childProfile = await this.childProfiles.findOneBy({ userId: childUserId });
    const walletBalance = await this.walletBalance(childUserId, Number(childProfile?.walletBalance ?? 0));

    const childName = childUser?.childName || childUser?.displayName || user.childName || "孩子";
    const childGrade = childUser?.childGrade || user.childGrade || "四年级";
    const childAvatar = childUser?.childAvatar || user.childAvatar || "🦊";

    const memberCards = members.map((member) => this.memberCard(member));
    if (!childUser) {
      memberCards.push({
        id: `pending-child-${user.id}`,
        name: childName,
        role: "child",
        roleLabel: `孩子 · ${childGrade}`,
        avatar: childAvatar,
        badge: "待加入",
      });
    }

    return {
      userId: user.id,
      displayName: user.displayName,
      familyName: user.familyName,
      role: user.role,
      inviteCode: user.inviteCode,
      child: {
        userId: childUserId,
        name: childName,
        grade: childGrade,
        avatar: childAvatar,
        joined: Boolean(childUser),
      },
      stats: {
        memberCount: memberCards.length,
        childRecordDays: Number(childRecordDays?.count ?? 0),
        monthlyRewards,
        monthlyDeductions,
        walletBalance,
        monthlyRewardAmount: Number(monthlyLedger?.rewardAmount ?? 0),
        monthlyDeductAmount: Number(monthlyLedger?.deductAmount ?? 0),
        pendingRewardAmount: Number(pendingRewards?.amount ?? 0),
        pendingRewardCount: Number(pendingRewards?.count ?? 0),
        companionStreakDays,
        childFocusSecondsToday,
        completedTasksToday: todayTasks.filter((task) => task.completedAt).length,
        totalTasksToday: todayTasks.length,
      },
      focusWeek,
      members: memberCards,
      updatedAt: new Date().toISOString(),
    };
  }

  async parentChildDetail(query: ParentProfileQueryDto): Promise<ParentChildDetailSummary> {
    const user = await this.authUsers.findOneBy({ id: query.userId });
    if (!user || user.role === "child") {
      throw new NotFoundException("没有找到这个家长账号");
    }

    const today = this.normalizeDate();
    const todayRange = this.dateRange(today);
    const monthStart = this.monthStartDate(today);
    const members = await this.authUsers.findBy({ familyName: user.familyName });
    const childUser = members.find((member) => member.role === "child");
    const childUserId = childUser?.id ?? user.id;
    const childProfile = await this.childProfiles.findOneBy({ userId: childUserId });
    const childName = childUser?.childName || childUser?.displayName || user.childName || "孩子";
    const childGrade = childUser?.childGrade || user.childGrade || "四年级";
    const childAvatar = childUser?.childAvatar || user.childAvatar || "🦊";
    const memberNameById = new Map(members.map((member) => [member.id, member.displayName || member.childName || "家人"]));
    const focusWeek = await this.focusWeek(childUserId);
    const todayTasks = await this.tasks.find({
      where: { userId: childUserId, date: today },
      order: { orderIndex: "ASC", createdAt: "ASC" },
    });
    const todayFocusRecords = await this.focusRecords.find({
      where: { userId: childUserId, date: today },
      order: { createdAt: "DESC" },
    });
    const todayGameRecords = await this.gameRecords.find({
      where: { userId: childUserId, date: today },
      order: { completedAt: "DESC" },
      take: 12,
    });
    const recentLedgerEntries = await this.ledgerEntries.find({
      where: { childUserId },
      order: { createdAt: "DESC" },
      take: 8,
    });
    const todayLedgerEntries = await this.ledgerEntries
      .createQueryBuilder("entry")
      .where("entry.childUserId = :childUserId", { childUserId })
      .andWhere("entry.createdAt >= :start", { start: todayRange.start })
      .andWhere("entry.createdAt < :end", { end: todayRange.end })
      .orderBy("entry.createdAt", "DESC")
      .getMany();
    const subjectRows = await this.tasks
      .createQueryBuilder("task")
      .select("task.subject", "subject")
      .addSelect("COUNT(*)", "total")
      .addSelect("COALESCE(SUM(CASE WHEN task.completedAt IS NOT NULL THEN 1 ELSE 0 END), 0)", "completed")
      .where("task.userId = :childUserId", { childUserId })
      .andWhere("task.date BETWEEN :start AND :end", { start: monthStart, end: today })
      .groupBy("task.subject")
      .getRawMany<{ subject: TaskEntity["subject"]; total: string; completed: string }>();
    const monthlyLedger = await this.ledgerEntries
      .createQueryBuilder("entry")
      .select(
        "COALESCE(SUM(CASE WHEN entry.type = 'reward' THEN entry.amount ELSE 0 END), 0)",
        "rewardAmount",
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN entry.type = 'deduct' THEN entry.amount ELSE 0 END), 0)",
        "deductAmount",
      )
      .where("entry.childUserId = :childUserId", { childUserId })
      .andWhere("entry.createdAt >= :monthStartDate", { monthStartDate: this.dateRange(monthStart).start })
      .andWhere("entry.status IN (:...statuses)", { statuses: ["approved", "resolved"] })
      .getRawOne<{ rewardAmount: string; deductAmount: string }>();
    const pendingRewards = await this.ledgerEntries
      .createQueryBuilder("entry")
      .select("COUNT(*)", "count")
      .addSelect("COALESCE(SUM(entry.amount), 0)", "amount")
      .where("entry.childUserId = :childUserId", { childUserId })
      .andWhere("entry.type = :type", { type: "reward" })
      .andWhere("entry.status = :status", { status: "pending" })
      .getRawOne<{ count: string; amount: string }>();
    const walletBalance = await this.walletBalance(childUserId, Number(childProfile?.walletBalance ?? 0));
    const streakDays = await this.streakDays(childUserId, today);
    const totalFocusSecondsToday = focusWeek[focusWeek.length - 1]?.totalSeconds ?? 0;

    return {
      userId: user.id,
      familyName: user.familyName,
      child: {
        userId: childUserId,
        name: childName,
        grade: childGrade,
        avatar: childAvatar,
        joined: Boolean(childUser),
      },
      stats: {
        completedTasksToday: todayTasks.filter((task) => task.completedAt).length,
        totalTasksToday: todayTasks.length,
        totalFocusSecondsToday,
        walletBalance,
        pendingRewardAmount: Number(pendingRewards?.amount ?? 0),
        pendingRewardCount: Number(pendingRewards?.count ?? 0),
        streakDays,
        monthlyRewardAmount: Number(monthlyLedger?.rewardAmount ?? 0),
        monthlyDeductAmount: Number(monthlyLedger?.deductAmount ?? 0),
        gameSessionsToday: todayGameRecords.length,
      },
      timeline: this.buildChildTimeline({
        tasks: todayTasks,
        focusRecords: todayFocusRecords,
        gameRecords: todayGameRecords,
        ledgerEntries: todayLedgerEntries,
        memberNameById,
      }),
      subjectStats: this.buildSubjectStats(subjectRows),
      focusWeek,
      walletHistory: recentLedgerEntries.map((entry) => this.toParentChildWalletItem(entry, memberNameById)),
      updatedAt: new Date().toISOString(),
    };
  }

  async updateParentProfile(dto: UpdateParentProfileDto): Promise<ParentProfileSummary> {
    const user = await this.authUsers.findOneBy({ id: dto.userId });
    if (!user || user.role === "child") {
      throw new NotFoundException("没有找到这个家长账号");
    }

    if (dto.displayName !== undefined) {
      user.displayName = dto.displayName.trim();
    }

    if (dto.familyName !== undefined && user.role === "parent") {
      const nextFamilyName = dto.familyName.trim();
      const oldFamilyName = user.familyName;
      user.familyName = nextFamilyName;
      if (nextFamilyName !== oldFamilyName) {
        await this.authUsers
          .createQueryBuilder()
          .update(AuthUserEntity)
          .set({ familyName: nextFamilyName })
          .where("family_name = :oldFamilyName", { oldFamilyName })
          .execute();
      }
    }

    await this.authUsers.save(user);
    return this.parentSummary({ userId: user.id });
  }

  private async ensureProfile(user: AuthUserEntity) {
    const existing = await this.childProfiles.findOneBy({ userId: user.id });
    if (existing) return existing;

    return this.childProfiles.save(
      this.childProfiles.create({
        userId: user.id,
        childName: user.childName || "小明",
        childGrade: user.childGrade || "四年级",
        childAvatar: user.childAvatar || "🦊",
        avatarLabel: this.avatarLabel(user.childAvatar || "🦊"),
        pinMode: "pin",
        unlockAge: 18,
        weeklyReminder: true,
        walletBalance: "0",
      }),
    );
  }

  private async focusWeek(userId: string) {
    const dates = Array.from({ length: 7 }, (_, index) => this.addDays(this.normalizeDate(), index - 6));
    const rows = await this.focusRecords
      .createQueryBuilder("record")
      .select("DATE_FORMAT(record.date, '%Y-%m-%d')", "date")
      .addSelect("COALESCE(SUM(record.durationSeconds), 0)", "totalSeconds")
      .where("record.userId = :userId", { userId })
      .andWhere("record.date BETWEEN :start AND :end", { start: dates[0], end: dates[6] })
      .groupBy("DATE_FORMAT(record.date, '%Y-%m-%d')")
      .getRawMany<{ date: string; totalSeconds: string }>();
    const totals = new Map(rows.map((row) => [row.date, Number(row.totalSeconds)]));

    return dates.map((date) => ({
      date,
      label: date === dates[dates.length - 1] ? "今天" : weekLabels[new Date(`${date}T00:00:00.000Z`).getUTCDay()],
      totalSeconds: totals.get(date) ?? 0,
    }));
  }

  private async streakDays(userId: string, today: string) {
    const rows = await this.focusRecords
      .createQueryBuilder("record")
      .select("DISTINCT DATE_FORMAT(record.date, '%Y-%m-%d')", "date")
      .where("record.userId = :userId", { userId })
      .andWhere("record.durationSeconds > 0")
      .orderBy("DATE_FORMAT(record.date, '%Y-%m-%d')", "DESC")
      .getRawMany<{ date: string }>();
    let expectedDate = today;
    let streak = 0;
    for (const row of rows) {
      if (row.date !== expectedDate) break;
      streak += 1;
      expectedDate = this.addDays(expectedDate, -1);
    }
    return streak;
  }

  private async walletBalance(userId: string, profileBalance: number) {
    const raw = await this.ledgerEntries
      .createQueryBuilder("entry")
      .select(
        "COALESCE(SUM(CASE WHEN entry.type = 'deduct' THEN -entry.amount WHEN entry.type = 'reward' THEN entry.amount ELSE 0 END), 0)",
        "balance",
      )
      .where("entry.childUserId = :userId", { userId })
      .andWhere("entry.status IN (:...statuses)", { statuses: ["approved", "resolved"] })
      .getRawOne<{ balance: string }>();
    return Number(raw?.balance ?? 0) + profileBalance;
  }

  private buildChildTimeline(input: {
    tasks: TaskEntity[];
    focusRecords: FocusRecordEntity[];
    gameRecords: GameRecordEntity[];
    ledgerEntries: LedgerEntryEntity[];
    memberNameById: Map<string, string>;
  }): ParentChildTimelineItem[] {
    const taskById = new Map(input.tasks.map((task) => [task.id, task]));
    const focusSecondsByTask = input.focusRecords.reduce((map, record) => {
      if (!record.taskId) return map;
      map.set(record.taskId, (map.get(record.taskId) ?? 0) + record.durationSeconds);
      return map;
    }, new Map<string, number>());
    const items: Array<{ occurredAt: Date; item: Omit<ParentChildTimelineItem, "time" | "occurredAt"> }> = [];

    for (const task of input.tasks) {
      if (!task.completedAt) continue;
      const meta = subjectMeta[task.subject];
      const focusMinutes = Math.max(
        1,
        Math.round((focusSecondsByTask.get(task.id) ?? task.estimatedMinutes * 60) / 60),
      );
      items.push({
        occurredAt: task.completedAt,
        item: {
          id: `task-${task.id}`,
          kind: "task",
          title: this.completedTaskTitle(task.title),
          detail: `✓ ${focusMinutes}分钟完成 · ${meta.label}`,
          icon: "✓",
          tone: "green",
          value: null,
        },
      });
    }

    items.push(...this.buildFocusTimelineItems(input.focusRecords, taskById));

    for (const record of input.gameRecords) {
      const meta = gameMeta[record.gameType];
      items.push({
        occurredAt: record.completedAt,
        item: {
          id: `game-${record.id}`,
          kind: "game",
          title: `${meta.name} ${record.difficulty}`,
          detail: "⭐ 专注热身训练完成",
          icon: meta.icon,
          tone: "gold",
          value: this.gameRecordLabel(record),
        },
      });
    }

    for (const entry of input.ledgerEntries) {
      const isReward = entry.type !== "deduct";
      const initiatorName = input.memberNameById.get(entry.initiatorUserId) ?? "家人";
      items.push({
        occurredAt: entry.createdAt,
        item: {
          id: `wallet-${entry.id}`,
          kind: "wallet",
          title: `${initiatorName}发起${isReward ? "奖励" : "扣款"}`,
          detail: `${entry.reason} · ${this.walletStatusText(entry.status)}`,
          icon: isReward ? "⭐" : "⚠️",
          tone: isReward ? "green" : "coral",
          value: `${isReward ? "+" : "-"}¥${this.moneyLabel(Number(entry.amount))}`,
        },
      });
    }

    return items
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, 8)
      .map(({ occurredAt, item }) => ({
        ...item,
        time: this.timeLabel(occurredAt),
        occurredAt: occurredAt.toISOString(),
      }));
  }

  private buildFocusTimelineItems(
    records: FocusRecordEntity[],
    taskById: Map<string, TaskEntity>,
  ): Array<{ occurredAt: Date; item: Omit<ParentChildTimelineItem, "time" | "occurredAt"> }> {
    const groups = new Map<string, {
      id: string;
      mode: FocusRecordEntity["mode"];
      taskTitle?: string;
      totalSeconds: number;
      latestAt: Date;
      completedCount: number;
      syncCount: number;
    }>();

    for (const record of records) {
      const key = `${record.mode}:${record.taskId ?? "daily"}`;
      const occurredAt = record.completedAt ?? record.createdAt;
      const task = record.taskId ? taskById.get(record.taskId) : null;
      const existing = groups.get(key);
      if (existing) {
        existing.totalSeconds += record.durationSeconds;
        existing.completedCount += record.completedAt ? 1 : 0;
        existing.syncCount += record.completedAt ? 0 : 1;
        if (occurredAt.getTime() > existing.latestAt.getTime()) {
          existing.latestAt = occurredAt;
          existing.id = record.id;
        }
        continue;
      }

      groups.set(key, {
        id: record.id,
        mode: record.mode,
        taskTitle: task?.title,
        totalSeconds: record.durationSeconds,
        latestAt: occurredAt,
        completedCount: record.completedAt ? 1 : 0,
        syncCount: record.completedAt ? 0 : 1,
      });
    }

    const completedOrdinals = new Map<string, number>();
    records
      .filter((record) => record.completedAt)
      .sort(
        (left, right) =>
          (left.completedAt ?? left.createdAt).getTime() - (right.completedAt ?? right.createdAt).getTime(),
      )
      .forEach((record, index) => completedOrdinals.set(record.id, index + 1));

    const items: Array<{ occurredAt: Date; item: Omit<ParentChildTimelineItem, "time" | "occurredAt"> }> = [];

    for (const group of groups.values()) {
      if (group.completedCount < 1) continue;

      const tomatoIndex = completedOrdinals.get(group.id) ?? group.completedCount;
      const taskTitle = group.mode === "task" && group.taskTitle ? group.taskTitle : "日常番茄";
      const title = `完成第 ${tomatoIndex} 个番茄钟 · ${taskTitle}`;
      const minutes = Math.max(1, Math.round(group.totalSeconds / 60));

      items.push({
        occurredAt: group.latestAt,
        item: {
          id: `focus-${group.mode}-${group.taskTitle ?? "daily"}-${group.id}`,
          kind: "focus",
          title,
          detail: group.completedCount > 1
            ? `✓ 累计${this.minutesLabel(group.totalSeconds)} · 完成${group.completedCount}轮`
            : `✓ ${minutes}分钟完成`,
          icon: "⏱",
          tone: "purple",
          value: "+1🍅",
        },
      });
    }

    return items;
  }

  private completedTaskTitle(title: string) {
    return title.trim().startsWith("完成") ? title.trim() : `完成${title.trim()}`;
  }

  private buildSubjectStats(rows: Array<{ subject: TaskEntity["subject"]; total: string; completed: string }>): ParentChildSubjectStat[] {
    const bySubject = new Map(rows.map((row) => [row.subject, {
      total: Number(row.total ?? 0),
      completed: Number(row.completed ?? 0),
    }]));
    const defaultSubjects: TaskEntity["subject"][] = ["math", "chinese", "english", "reading"];
    const subjects = [
      ...defaultSubjects,
      ...rows
        .map((row) => row.subject)
        .filter((subject) => !defaultSubjects.includes(subject)),
    ];

    return subjects.map((subject) => {
      const stat = bySubject.get(subject) ?? { total: 0, completed: 0 };
      const meta = subjectMeta[subject];
      return {
        subject,
        label: meta.label,
        icon: meta.icon,
        completed: stat.completed,
        total: stat.total,
        percent: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0,
      };
    });
  }

  private toParentChildWalletItem(entry: LedgerEntryEntity, memberNameById: Map<string, string>) {
    return {
      id: entry.id,
      type: entry.type === "deduct" ? "deduct" as const : "reward" as const,
      amount: Number(entry.amount),
      reason: entry.reason,
      status: entry.status,
      initiatorName: memberNameById.get(entry.initiatorUserId) ?? "家人",
      createdAt: entry.createdAt.toISOString(),
    };
  }

  private gameRecordLabel(record: GameRecordEntity) {
    if (record.gameType === "schulte") return `${(Number(record.score ?? record.durationMs) / 1000).toFixed(1)}s`;
    if (record.gameType === "reaction") return `${Number(record.reactionMs ?? record.score ?? 0)}ms`;
    return `${Number(record.accuracy ?? record.score ?? 0)}%`;
  }

  private walletStatusText(status: LedgerEntryEntity["status"]) {
    if (status === "approved") return "已确认";
    if (status === "appealing") return "申诉中";
    if (status === "resolved") return "已处理";
    if (status === "cancelled") return "已取消";
    return "待确认";
  }

  private moneyLabel(value: number) {
    return value.toFixed(value % 1 === 0 ? 0 : 2);
  }

  private minutesLabel(seconds: number) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `${minutes}分钟`;
  }

  private timeLabel(value: Date) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "--:--";
    return `${value.getHours().toString().padStart(2, "0")}:${value.getMinutes().toString().padStart(2, "0")}`;
  }

  private monthStartDate(date: string) {
    return `${date.slice(0, 8)}01`;
  }

  private dateRange(date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private badges(input: {
    tomatoCount: number;
    streakDays: number;
    completedTasksToday: number;
    totalTasksToday: number;
  }): ChildProfileBadge[] {
    const perfectDay = input.totalTasksToday > 0 && input.completedTasksToday === input.totalTasksToday;
    return [
      { id: "streak-7", icon: "🔥", label: "7天连续", earned: input.streakDays >= 7, tone: "gold" },
      { id: "tomato-50", icon: "🍅", label: "50个番茄", earned: input.tomatoCount >= 50, tone: "purple" },
      { id: "perfect-day", icon: "⭐", label: "满分达人", earned: perfectDay, tone: "green" },
      { id: "tomato-100", icon: "🏆", label: "100个番茄", earned: input.tomatoCount >= 100, tone: "neutral" },
      { id: "streak-30", icon: "📚", label: "30天连续", earned: input.streakDays >= 30, tone: "neutral" },
    ];
  }

  private memberCard(user: AuthUserEntity): ParentProfileMember {
    if (user.role === "child") {
      return {
        id: user.id,
        name: user.childName || user.displayName,
        role: "child",
        roleLabel: `孩子 · ${user.childGrade || "未设置年级"}`,
        avatar: user.childAvatar || "🦊",
        badge: "已加入",
      };
    }

    if (user.role === "parent") {
      return {
        id: user.id,
        name: user.displayName,
        role: "parent",
        roleLabel: "家长 · 管理员",
        avatar: "👨",
        badge: "家长",
      };
    }

    return {
      id: user.id,
      name: user.displayName,
      role: "elder",
      roleLabel: "家人 · 可发起奖励",
      avatar: "👴",
      badge: "家人",
    };
  }

  private avatarLabel(avatar: string) {
    const labels: Record<string, string> = {
      "🦊": "小狐狸",
      "🐼": "熊猫",
      "🦁": "小狮子",
      "🐯": "小老虎",
      "🦋": "蝴蝶",
      "🐉": "小龙",
      "🦄": "独角兽",
      "🚀": "火箭",
    };
    return labels[avatar] ?? "自定义头像";
  }

  private normalizeDate(date = new Date().toISOString()) {
    return date.slice(0, 10);
  }

  private addDays(date: string, days: number) {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }
}
