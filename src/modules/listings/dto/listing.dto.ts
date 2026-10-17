import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingKind, ListingSource, ListingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListListingsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ListingKind })
  @IsOptional()
  @IsEnum(ListingKind)
  kind?: ListingKind;

  @ApiPropertyOptional({ enum: ListingStatus })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @ApiPropertyOptional({ enum: ListingSource })
  @IsOptional()
  @IsEnum(ListingSource)
  source?: ListingSource;
}

export class CreateListingDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  institutionName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  institutionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rawText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  educationLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kpssScoreType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  kpssMinScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quota?: number;

  @ApiPropertyOptional({ enum: ListingKind })
  @IsOptional()
  @IsEnum(ListingKind)
  kind?: ListingKind;

  @ApiPropertyOptional({ enum: ListingSource })
  @IsOptional()
  @IsEnum(ListingSource)
  source?: ListingSource;

  @ApiPropertyOptional({ enum: ListingStatus })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  applyStartAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  applyEndAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  resultAt?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];
}

export class PasteParseDto {
  @ApiProperty({ description: 'Ham ilan metni' })
  @IsString()
  @MinLength(20)
  text!: string;

  @ApiPropertyOptional({ enum: ListingKind })
  @IsOptional()
  @IsEnum(ListingKind)
  kind?: ListingKind;

  @ApiPropertyOptional({ enum: ListingSource })
  @IsOptional()
  @IsEnum(ListingSource)
  source?: ListingSource;

  @ApiPropertyOptional({ description: 'Parse sonrası kaydet' })
  @IsOptional()
  save?: boolean;
}
