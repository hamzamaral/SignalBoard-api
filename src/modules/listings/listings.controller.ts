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
import { CreateListingDto, ListListingsQueryDto, PasteParseDto } from './dto/listing.dto';
import { ListingsService } from './listings.service';

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
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
      applyStartAt: dto.applyStartAt ? new Date(dto.applyStartAt) : null,
      applyEndAt: dto.applyEndAt ? new Date(dto.applyEndAt) : null,
      resultAt: dto.resultAt ? new Date(dto.resultAt) : null,
    });
    await this.matching.notifyMatchesForListing(listing.id);
    return listing;
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.listings.get(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CreateListingDto) {
    return this.listings.update(id, {
      ...dto,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
      applyStartAt: dto.applyStartAt ? new Date(dto.applyStartAt) : undefined,
      applyEndAt: dto.applyEndAt ? new Date(dto.applyEndAt) : undefined,
      resultAt: dto.resultAt ? new Date(dto.resultAt) : undefined,
    });
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.listings.remove(id);
  }
}
