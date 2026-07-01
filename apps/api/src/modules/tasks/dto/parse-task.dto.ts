import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class ParseTaskDto {
  @IsString()
  @MinLength(2)
  rawText: string;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(18)
  childAge?: number;

  @IsOptional()
  @IsIn(["openai", "claude", "deepseek", "mimo"])
  provider?: "openai" | "claude" | "deepseek" | "mimo";

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}
