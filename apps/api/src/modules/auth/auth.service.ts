import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { DataSource, Repository } from "typeorm";
import { AuthSessionEntity } from "../../database/entities/auth-session.entity";
import { AuthUserEntity } from "../../database/entities/auth-user.entity";
import { FocusRecordEntity } from "../../database/entities/focus-record.entity";
import { LedgerEntryEntity } from "../../database/entities/ledger-entry.entity";
import { TaskEntity } from "../../database/entities/task.entity";
import { JoinChildFamilyDto, JoinFamilyDto, LoginDto, RegisterDto } from "./dto/auth.dto";

const scrypt = promisify(scryptCallback);
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const inviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(AuthUserEntity)
    private readonly users: Repository<AuthUserEntity>,
    @InjectRepository(AuthSessionEntity)
    private readonly sessions: Repository<AuthSessionEntity>,
    @InjectRepository(TaskEntity)
    private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(FocusRecordEntity)
    private readonly focusRecords: Repository<FocusRecordEntity>,
    @InjectRepository(LedgerEntryEntity)
    private readonly ledgerEntries: Repository<LedgerEntryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.ensureSessionLastSeenColumn();
  }

  async register(dto: RegisterDto) {
    const username = dto.username.trim();
    const existing = await this.users.findOneBy({ username });
    if (existing) {
      throw new ConflictException("这个账号已经被使用，请换一个昵称");
    }

    const user = await this.users.save(
      this.users.create({
        username,
        displayName: dto.displayName.trim(),
        familyName: dto.familyName.trim(),
        role: dto.role,
        passwordHash: await this.hashPassword(dto.password),
        childName: dto.childName?.trim() || null,
        childGrade: dto.childGrade?.trim() || null,
        childAvatar: dto.childAvatar?.trim() || null,
        inviteCode: await this.createInviteCode(),
      }),
    );

    return this.createSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOneBy({ username: dto.username.trim() });
    if (!user || !(await this.verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("账号或密码不正确");
    }

    return this.createSession(user);
  }

  async joinFamily(dto: JoinFamilyDto) {
    const inviteCode = dto.inviteCode.trim().toUpperCase();
    const owner = await this.users.findOneBy({ inviteCode, role: "parent" });
    if (!owner) {
      throw new UnauthorizedException("邀请码无效或已失效");
    }

    const username = dto.username.trim();
    const existing = await this.users.findOneBy({ username });
    if (existing) {
      throw new ConflictException("这个账号已经被使用，请换一个昵称");
    }

    const user = await this.users.save(
      this.users.create({
        username,
        displayName: dto.displayName.trim(),
        familyName: owner.familyName,
        role: "elder",
        passwordHash: await this.hashPassword(dto.password),
        childName: owner.childName,
        childGrade: owner.childGrade,
        childAvatar: owner.childAvatar,
        inviteCode: await this.createInviteCode(),
      }),
    );

    return this.createSession(user);
  }

  async joinChildFamily(dto: JoinChildFamilyDto) {
    const inviteCode = dto.inviteCode.trim().toUpperCase();
    const owner = await this.users.findOneBy({ inviteCode, role: "parent" });
    if (!owner) {
      throw new UnauthorizedException("邀请码无效或已失效");
    }

    const childName = dto.childName.trim() || owner.childName || "孩子";
    const childAvatar = dto.childAvatar?.trim() || owner.childAvatar || "🦊";
    const existing = await this.users.findOneBy({ familyName: owner.familyName, role: "child" });

    if (existing) {
      existing.displayName = childName;
      existing.passwordHash = await this.hashPassword(dto.password);
      existing.childName = childName;
      existing.childGrade = owner.childGrade;
      existing.childAvatar = childAvatar;
      await this.users.save(existing);
      await this.movePlaceholderChildData(owner, existing);
      return this.createSession(existing);
    }

    const user = await this.users.save(
      this.users.create({
        username: await this.createChildUsername(inviteCode),
        displayName: childName,
        familyName: owner.familyName,
        role: "child",
        passwordHash: await this.hashPassword(dto.password),
        childName,
        childGrade: owner.childGrade,
        childAvatar,
        inviteCode: await this.createInviteCode(),
      }),
    );

    await this.movePlaceholderChildData(owner, user);
    return this.createSession(user);
  }

  async me(token: string) {
    const session = await this.sessions.findOneBy({ token });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("登录已过期，请重新登录");
    }

    session.lastSeenAt = new Date();
    await this.sessions.save(session);

    const user = await this.users.findOneByOrFail({ id: session.userId });
    return this.publicUser(user);
  }

  async heartbeat(token: string) {
    const session = await this.sessions.findOneBy({ token });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("鐧诲綍宸茶繃鏈燂紝璇烽噸鏂扮櫥褰?");
    }

    session.lastSeenAt = new Date();
    await this.sessions.save(session);
    return { ok: true, lastSeenAt: session.lastSeenAt.toISOString() };
  }

  async logout(token: string) {
    await this.sessions.delete({ token });
    return { ok: true };
  }

  private async createSession(user: AuthUserEntity) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + sessionLifetimeMs);
    const lastSeenAt = new Date();
    await this.sessions.save(this.sessions.create({ token, userId: user.id, expiresAt, lastSeenAt }));

    return { token, user: this.publicUser(user) };
  }

  private publicUser(user: AuthUserEntity) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      familyName: user.familyName,
      role: user.role,
      childName: user.childName ?? null,
      childGrade: user.childGrade ?? null,
      childAvatar: user.childAvatar ?? null,
      inviteCode: user.inviteCode,
    };
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const hash = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${hash.toString("hex")}`;
  }

  private async verifyPassword(password: string, encoded: string) {
    const [salt, storedHash] = encoded.split(":");
    if (!salt || !storedHash) return false;

    const candidate = (await scrypt(password, salt, 64)) as Buffer;
    return timingSafeEqual(candidate, Buffer.from(storedHash, "hex"));
  }

  private async createInviteCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const value = Array.from({ length: 6 }, () => inviteAlphabet[Math.floor(Math.random() * inviteAlphabet.length)]).join("");
      const existing = await this.users.findOneBy({ inviteCode: value });
      if (!existing) return value;
    }

    throw new ConflictException("邀请码生成失败，请重试");
  }

  private async createChildUsername(inviteCode: string) {
    const base = `child-${inviteCode.toLowerCase()}`;
    const existing = await this.users.findOneBy({ username: base });
    if (!existing) return base;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const username = `${base}-${randomBytes(2).toString("hex")}`;
      const duplicate = await this.users.findOneBy({ username });
      if (!duplicate) return username;
    }

    throw new ConflictException("孩子账号生成失败，请重试");
  }

  private async movePlaceholderChildData(owner: AuthUserEntity, child: AuthUserEntity) {
    const today = this.normalizeDate();
    const childTaskCount = await this.tasks.countBy({ userId: child.id, date: today });
    if (childTaskCount === 0) {
      await this.tasks.update({ userId: owner.id, date: today }, { userId: child.id });
    }

    const childFocusCount = await this.focusRecords.countBy({ userId: child.id, date: today });
    if (childFocusCount === 0) {
      await this.focusRecords.update({ userId: owner.id, date: today }, { userId: child.id });
    }

    const childLedgerCount = await this.ledgerEntries.countBy({ childUserId: child.id });
    if (childLedgerCount === 0) {
      await this.ledgerEntries.update({ childUserId: owner.id }, { childUserId: child.id });
    }
  }

  private normalizeDate(date = new Date().toISOString()) {
    return date.slice(0, 10);
  }

  private async ensureSessionLastSeenColumn() {
    const rows = await this.dataSource.query(
      "SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_sessions' AND COLUMN_NAME = 'last_seen_at'",
    ) as Array<{ count: string | number }>;
    if (Number(rows[0]?.count ?? 0) > 0) return;

    await this.dataSource.query("ALTER TABLE auth_sessions ADD COLUMN last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  }
}
