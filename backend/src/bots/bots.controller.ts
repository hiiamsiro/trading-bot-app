import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BotsService } from './bots.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';
import { ListBotLogsQueryDto } from './dto/list-bot-logs-query.dto';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('bots')
@Controller('bots')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get()
  @ApiOperation({ summary: 'List bots for the current user' })
  @ApiOkResponse({ description: 'Array of bots owned by the user' })
  async findAll(@CurrentUser() user: AuthUserPayload) {
    return this.botsService.findAll(user.userId);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start bot (demo execution)' })
  @ApiOkResponse({ description: 'Bot is running' })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  @ApiForbiddenResponse({ description: 'Bot belongs to another user' })
  async start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.start(id, user.userId);
  }

  @Post(':id/stop')
  @ApiOperation({ summary: 'Stop bot (demo execution)' })
  @ApiOkResponse({ description: 'Bot is stopped' })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  @ApiForbiddenResponse({ description: 'Bot belongs to another user' })
  async stop(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.stop(id, user.userId);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'List logs for a bot (newest first)' })
  @ApiOkResponse({
    description: 'Paginated bot log entries',
  })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  @ApiForbiddenResponse({ description: 'Bot belongs to another user' })
  async findLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListBotLogsQueryDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const take = query.take ?? 50;
    const skip = query.skip ?? 0;
    return this.botsService.findLogs(id, user.userId, take, skip);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bot by ID' })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  @ApiForbiddenResponse({ description: 'Bot belongs to another user' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.findOne(id, user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new bot' })
  @ApiOkResponse({ description: 'Created bot' })
  async create(@Body() createBotDto: CreateBotDto, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.create(createBotDto, user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update bot' })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  @ApiForbiddenResponse({ description: 'Bot belongs to another user' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBotDto: UpdateBotDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.botsService.update(id, updateBotDto, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete bot' })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  @ApiForbiddenResponse({ description: 'Bot belongs to another user' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.remove(id, user.userId);
  }
}
