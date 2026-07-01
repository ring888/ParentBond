import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export class WalletEvidenceDto {
  @IsIn(["photo", "audio", "video"])
  kind: "photo" | "audio" | "video";

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  fileName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  mimeType: string;

  @IsInt()
  @Min(1)
  @Max(12582912)
  size: number;

  @IsString()
  @MinLength(1)
  @MaxLength(360)
  url: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  createdAt: string;
}

export class WalletSummaryQueryDto {
  @IsString()
  @MinLength(1)
  userId: string;
}

export class CreateWalletEntryDto extends WalletSummaryQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  childUserId?: string;

  @IsIn(["reward", "deduct"])
  type: "reward" | "deduct";

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999)
  amount: number;

  @IsString()
  @MinLength(2)
  @MaxLength(240)
  reason: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WalletEvidenceDto)
  evidence?: WalletEvidenceDto | null;
}

export class ResolveWalletEntryDto extends WalletSummaryQueryDto {
  @IsIn(["approved", "appealing"])
  status: "approved" | "appealing";

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(360)
  appealReason?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WalletEvidenceDto)
  appealEvidence?: WalletEvidenceDto | null;
}

export class ParentReviewWalletEntryDto extends WalletSummaryQueryDto {
  @IsIn(["approved", "cancelled"])
  status: "approved" | "cancelled";

  @IsOptional()
  @IsString()
  @MaxLength(360)
  resolutionNote?: string;
}

export class UploadWalletEvidenceDto extends WalletSummaryQueryDto {
  @IsIn(["photo", "audio", "video"])
  kind: "photo" | "audio" | "video";

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  fileName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  mimeType: string;

  @IsString()
  @MinLength(16)
  dataBase64: string;
}
