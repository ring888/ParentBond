import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  username: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  familyName: string;

  @IsIn(["parent", "elder"])
  role: "parent" | "elder";

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  childName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  childGrade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  childAvatar?: string;
}

export class JoinFamilyDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  inviteCode: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  username: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;
}

export class JoinChildFamilyDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  inviteCode: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  childName: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  childAvatar?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(16)
  password: string;
}

export class ChildLoginDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  inviteCode: string;

  @IsOptional()
  @IsIn(["pin", "pattern"])
  unlockType?: "pin" | "pattern";

  @IsString()
  @MinLength(4)
  @MaxLength(16)
  password: string;
}

export class SetChildPatternDto {
  @IsString()
  @MinLength(1)
  userId: string;

  @IsString()
  @MinLength(4)
  @MaxLength(9)
  pattern: string;
}

export class LoginDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  username: string;

  @IsOptional()
  @IsIn(["pin", "pattern"])
  unlockType?: "pin" | "pattern";

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password: string;
}
