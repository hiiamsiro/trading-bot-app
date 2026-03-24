import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TradesService } from './trades.service';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('trades')
@Controller('trades')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get()
  @ApiOperation({
    summary: 'List trades for bots owned by the current user',
  })
  @ApiQuery({
    name: 'botId',
    required: false,
    description: 'Filter by bot UUID',
  })
  @ApiOkResponse({ description: 'Trades with minimal bot info' })
  async findAll(
    @CurrentUser() user: AuthUserPayload,
    @Query('botId') botId?: string,
  ) {
    return this.tradesService.findAll(user.userId, botId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one trade by ID' })
  @ApiOkResponse({ description: 'Trade with bot relation' })
  @ApiNotFoundResponse({ description: 'Trade not found' })
  @ApiForbiddenResponse({ description: 'Trade belongs to another user' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.tradesService.findOne(id, user.userId);
  }
}
