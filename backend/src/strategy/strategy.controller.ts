import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { IsDefined } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StrategyBuilderService } from './strategy-builder.service';
import { type BuilderConfig, type CompiledResult } from './strategy-builder.schema';

// Validation is done by StrategyBuilderService, not class-validator.
// @IsDefined() simply tells NestJS "this property is allowed" (bypasses forbidNonWhitelisted).
class ValidateBuilderConfigDto {
  @ApiProperty({ description: 'Visual builder config — validated by StrategyBuilderService' })
  @IsDefined()
  config: Record<string, unknown>;
}

class CompileBuilderConfigDto {
  @ApiProperty({ description: 'Visual builder config — validated by StrategyBuilderService' })
  @IsDefined()
  config: Record<string, unknown>;
}

@ApiTags('strategy-builder')
@Controller('strategy-builder')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StrategyBuilderController {
  constructor(private readonly builderService: StrategyBuilderService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a visual builder config' })
  @ApiOkResponse({ description: 'Config is valid' })
  @ApiBadRequestResponse({ description: 'Validation error details' })
  validate(@Body() dto: ValidateBuilderConfigDto): { valid: true } {
    this.builderService.validateConfig(dto.config);
    return { valid: true };
  }

  @Post('compile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compile a visual builder config into strategy+params' })
  @ApiOkResponse({ description: 'Compiled strategy result' })
  @ApiBadRequestResponse({ description: 'Compilation error' })
  compile(@Body() dto: CompileBuilderConfigDto): CompiledResult {
    this.builderService.validateConfig(dto.config);
    return this.builderService.compileConfig(dto.config as unknown as BuilderConfig);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get a default empty builder config' })
  getDefault(): BuilderConfig {
    return this.builderService.createDefault();
  }
}
