import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class MemorySummaryQueryDto {
  @IsString()
  @MinLength(1)
  userId: string;
}

export class CreateMemoryDto extends MemorySummaryQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12)
  mood: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  week?: string;
}
