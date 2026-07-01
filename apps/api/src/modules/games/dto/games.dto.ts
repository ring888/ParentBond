import { IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

const gameTypes = ["schulte", "stroop", "nback", "reaction"] as const;
type GameType = typeof gameTypes[number];

export class GameSummaryQueryDto {
  @IsString()
  @MinLength(1)
  userId: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class SaveGameRecordDto extends GameSummaryQueryDto {
  @IsIn(gameTypes)
  gameType: GameType;

  @IsString()
  @MinLength(1)
  difficulty: string;

  @IsInt()
  @Min(0)
  @Max(3_600_000)
  durationMs: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3_600_000)
  score?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  accuracy?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60_000)
  reactionMs?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  missCount?: number;

  @IsOptional()
  @IsObject()
  detail?: Record<string, unknown> | null;
}
