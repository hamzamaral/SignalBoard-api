import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';

class SmtpDto {
  @IsString()
  host!: string;

  @IsNumber()
  port!: number;

  @IsBoolean()
  secure!: boolean;

  @IsString()
  user!: string;

  @IsString()
  @MinLength(1)
  pass!: string;

  @IsString()
  from!: string;
}

class LlmDto {
  @IsIn(['NONE', 'OLLAMA', 'GEMINI', 'GROQ'])
  provider!: 'NONE' | 'OLLAMA' | 'GEMINI' | 'GROQ';

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  model?: string;
}

@ApiTags('settings')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.getPublicSettings();
  }

  @Put('smtp')
  setSmtp(@Body() dto: SmtpDto) {
    return this.settings.setSmtpConfig(dto);
  }

  @Put('llm')
  setLlm(@Body() dto: LlmDto) {
    return this.settings.setLlmConfig(dto);
  }
}
