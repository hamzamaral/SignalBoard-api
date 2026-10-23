import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ListingSource, Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseService } from '../parse/parse.service';
import { MatchingService } from '../matching/matching.service';
import {
  BulkListingsDto,
  CreateListingDto,
  EnrichListingDto,
  ListListingsQueryDto,
  PasteParseDto,
} from './dto/listing.dto';
import { ListingsService } from './listings.service';

function datesFrom(dto: CreateListingDto) {
  return {
    publishedAt: optionalDate(dto.publishedAt),
    applyStartAt: optionalDate(dto.applyStartAt),
    applyEndAt: optionalDate(dto.applyEndAt),
    resultAt: optionalDate(dto.resultAt),
    examAt: optionalDate(dto.examAt),
    resultAnnounceAt: optionalDate(dto.resultAnnounceAt),
  };
}

function optionalDate(value?: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === '') return null;
  return new Date(value);
}

@ApiTags('listings')
@ApiBearerAuth()
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly parse: ParseService,
    private readonly matching: MatchingService,
  ) {}

  @Get()
  list(@Query() query: ListListingsQueryDto, @CurrentUser('id') userId: string) {
    return this.listings.list({ ...query, userId });
  }

  @Roles(Role.ADMIN)
  @Post('bulk')
  bulk(@Body() dto: BulkListingsDto) {
    return this.listings.bulk(dto);
  }

  @Roles(Role.ADMIN)
  @Post('parse')
  parsePaste(@Body() dto: PasteParseDto) {
    return this.parse.parseAndMaybeSave({
      text: dto.text,
      kind: dto.kind,
      source: dto.source,
      save: dto.save ?? false,
    });
  }

  @Roles(Role.ADMIN)
  @Post()
  async create(@Body() dto: CreateListingDto) {
    const listing = await this.listings.createManual({
      ...dto,
      source: dto.source ?? ListingSource.MANUAL,
      ...datesFrom(dto),
    });
    await this.matching.notifyMatchesForListing(listing.id);
    return listing;
  }

  @Post(':id/enrich')
  enrich(@Param('id') id: string, @Body() dto: EnrichListingDto) {
    return this.parse.enrichListing(id, dto.text);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.listings.get(id, userId);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CreateListingDto) {
    return this.listings.update(id, {
      ...dto,
      ...datesFrom(dto),
    });
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.listings.remove(id);
  }
}
