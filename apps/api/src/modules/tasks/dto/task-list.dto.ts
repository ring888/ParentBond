import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const subjects = ["math", "chinese", "english", "reading", "other"] as const;

export class TaskInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsIn(subjects)
  subject: (typeof subjects)[number];

  @IsString()
  @MinLength(1)
  title: string;

  @IsInt()
  @Min(1)
  @Max(240)
  estimatedMinutes: number;

  @IsInt()
  @Min(1)
  @Max(3)
  priority: 1 | 2 | 3;

  @IsOptional()
  @IsDateString()
  completedAt?: string | null;
}

export class SaveTaskListDto {
  @IsString()
  @MinLength(1)
  userId: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => TaskInputDto)
  tasks: TaskInputDto[];
}

export class CompleteTaskDto {
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class TaskQueryDto {
  @IsString()
  @MinLength(1)
  userId: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class TaskIdDto {
  @IsUUID()
  id: string;
}
