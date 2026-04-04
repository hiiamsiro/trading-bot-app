import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BillingService } from '../billing/billing.service';
import { StrategyCodeService } from './strategy-code.service';
import { CreateStrategyCodeDto } from './dto/create-strategy-code.dto';
import { UpdateStrategyCodeDto } from './dto/update-strategy-code.dto';
import { ValidateStrategyCodeDto } from './dto/validate-strategy-code.dto';
import { STARTER_TEMPLATES } from './strategies/starter-templates';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('strategy-codes')
@Controller('strategy-codes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StrategyCodeController {
  constructor(
    private readonly strategyCodeService: StrategyCodeService,
    private readonly billingService: BillingService,
  ) {}

  private async checkCustomCodeAccess(user: AuthUserPayload): Promise<void> {
    const { allowed, reason } = await this.billingService.canUseCustomCode(user.userId);
    if (!allowed) {
      throw new ForbiddenException(reason);
    }
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get starter strategy code templates' })
  @ApiOkResponse({ description: 'Array of starter templates' })
  getTemplates() {
    return STARTER_TEMPLATES;
  }

  @Get()
  @ApiOperation({ summary: 'List strategy codes for the current user' })
  @ApiOkResponse({ description: 'Array of strategy codes owned by the user' })
  async findAll(@CurrentUser() user: AuthUserPayload) {
    await this.checkCustomCodeAccess(user);
    return this.strategyCodeService.listCodes(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a strategy code by ID' })
  @ApiNotFoundResponse({ description: 'Strategy code not found' })
  @ApiForbiddenResponse({ description: 'Custom code requires Pro or Premium plan' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    await this.checkCustomCodeAccess(user);
    return this.strategyCodeService.getCodeForUser(id, user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new strategy code' })
  @ApiOkResponse({ description: 'Created strategy code' })
  @ApiForbiddenResponse({ description: 'Custom code requires Pro or Premium plan' })
  async create(
    @Body() dto: CreateStrategyCodeDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    await this.checkCustomCodeAccess(user);
    return this.strategyCodeService.saveCode(user.userId, dto);
  }

  @Post('validate')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Validate strategy code without saving (rate-limited: 10/min)' })
  @ApiOkResponse({ description: 'Validation result' })
  @ApiForbiddenResponse({ description: 'Custom code requires Pro or Premium plan' })
  async validate(
    @Body() dto: ValidateStrategyCodeDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    await this.checkCustomCodeAccess(user);
    return this.strategyCodeService.validateCode(dto.code);
  }

  @Post('create-and-validate')
  @ApiOperation({ summary: 'Create and validate a strategy code in one step' })
  @ApiOkResponse({ description: 'Created strategy code with validation result' })
  @ApiForbiddenResponse({ description: 'Custom code requires Pro or Premium plan' })
  async createAndValidate(
    @Body() dto: CreateStrategyCodeDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    await this.checkCustomCodeAccess(user);
    return this.strategyCodeService.validateAndSave(user.userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a strategy code' })
  @ApiNotFoundResponse({ description: 'Strategy code not found' })
  @ApiForbiddenResponse({ description: 'Custom code requires Pro or Premium plan' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStrategyCodeDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    await this.checkCustomCodeAccess(user);
    return this.strategyCodeService.updateCode(id, user.userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a strategy code' })
  @ApiNotFoundResponse({ description: 'Strategy code not found' })
  @ApiForbiddenResponse({ description: 'Custom code requires Pro or Premium plan' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    await this.checkCustomCodeAccess(user);
    return this.strategyCodeService.deleteCode(id, user.userId);
  }
}
