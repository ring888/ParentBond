import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class ChildProfileQueryDto {
  @IsString()
  @MinLength(1)
  userId: string;
}

export class UpdateChildProfileDto extends ChildProfileQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
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

  @IsOptional()
  @IsString()
  @MaxLength(40)
  avatarLabel?: string;

  @IsOptional()
  @IsIn(["pin", "pattern"])
  pinMode?: "pin" | "pattern";

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(30)
  unlockAge?: number;

  @IsOptional()
  @IsBoolean()
  weeklyReminder?: boolean;
}

export class ParentProfileQueryDto {
  @IsString()
  @MinLength(1)
  userId: string;
}

export class UpdateParentProfileDto extends ParentProfileQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  familyName?: string;
}
