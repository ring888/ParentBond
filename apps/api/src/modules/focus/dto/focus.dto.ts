import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class FocusStatsQueryDto {
  @IsString()
  @MinLength(1)
  userId: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class SaveFocusRecordDto extends FocusStatsQueryDto {
  @IsIn(["daily", "task"])
  mode: "daily" | "task";

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsInt()
  @Min(1)
  @Max(14400)
  durationSeconds: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class CompanionFocusQueryDto {
  @IsString()
  @MinLength(1)
  userId: string;
}

export class CompanionFocusHeartbeatDto extends CompanionFocusQueryDto {
  @IsOptional()
  @IsIn(["daily", "task"])
  mode?: "daily" | "task";

  @IsOptional()
  @IsString()
  taskId?: string | null;

  @IsOptional()
  @IsString()
  taskTitle?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(14400)
  secondsLeft?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14400)
  totalSeconds?: number;

  @IsOptional()
  @IsBoolean()
  running?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
