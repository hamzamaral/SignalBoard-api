import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingKind, ListingSource, ListingStatus } from '@prisma/client';
import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MinLength,
  ValidateIf,
  ValidateNested,
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

  /** Bizim sisteme eklenme tarihi (YYYY-MM-DD) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({
    enum: [
      'createdAt',
      'updatedAt',
      'applyEndAt',
      'applyStartAt',
      'resultAnnounceAt',
      'publishedAt',
      'title',
      'position',
      'institution',
    ],
  })
  @IsOptional()
  @IsIn([
    'createdAt',
    'updatedAt',
    'applyEndAt',
    'applyStartAt',
    'resultAnnounceAt',
    'publishedAt',
    'title',
    'position',
    'institution',
  ])
  sort?: ListingSort;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

export type ListingSort =
  | 'createdAt'
  | 'updatedAt'
  | 'applyEndAt'
  | 'applyStartAt'
  | 'resultAnnounceAt'
  | 'publishedAt'
  | 'title'
  | 'position'
  | 'institution';

export class BulkListingsDto {
  @ApiProperty({ enum: ['delete', 'close'] })
  @IsIn(['delete', 'close'])
  action!: 'delete' | 'close';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  ids?: string[];

  @ApiPropertyOptional({ description: 'Açıktaki filtreye uyan tüm kayıtlar' })
  @IsOptional()
  @IsBoolean()
  allMatching?: boolean;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}

export class EnrichListingDto {
  @ApiPropertyOptional({ description: 'İlan metni; boşsa mevcut rawText kullanılır' })
  @IsOptional()
  @IsString()
  text?: string;
}

export class ListingPositionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sequenceNo?: number;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceClass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  grade?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quota?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  educationRequirement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kpssScoreType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  kpssMinScore?: number;
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  applicationPlace?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicationMethods?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredDocuments?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  generalRequirements?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialRequirements?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  examTopics?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evaluationNotes?: string;

  @ApiPropertyOptional({ type: [ListingPositionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListingPositionDto)
  positions?: ListingPositionDto[];

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

  @OptionalDate()
  publishedAt?: string;

  @OptionalDate()
  applyStartAt?: string;

  @OptionalDate()
  applyEndAt?: string;

  @OptionalDate()
  resultAt?: string;

  @OptionalDate()
  examAt?: string;

  @OptionalDate()
  resultAnnounceAt?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];
}

/** Empty string clears the date on update; omitted leaves it unchanged. */
function OptionalDate() {
  return applyDecorators(
    ApiPropertyOptional(),
    IsOptional(),
    ValidateIf((_, value) => value !== ''),
    IsDateString(),
  );
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
