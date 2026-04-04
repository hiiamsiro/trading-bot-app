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
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BotsService } from './bots.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { CreateBotFromBuilderDto } from './dto/create-bot-from-builder.dto';
import { CreateBotFromCodeDto } from './dto/create-bot-from-code.dto';
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

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish bot to marketplace' })
  @ApiOkResponse({ description: 'Bot is now public with a share slug' })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  async publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.publishBot(id, user.userId);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Remove bot from marketplace' })
  @ApiOkResponse({ description: 'Bot is no longer public' })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  async unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.unpublishBot(id, user.userId);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start bot (demo execution)' })
  @ApiOkResponse({ description: 'Bot is running' })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  async start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.start(id, user.userId);
  }

  @Post(':id/stop')
  @ApiOperation({ summary: 'Stop bot (demo execution)' })
  @ApiOkResponse({ description: 'Bot is stopped' })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  async stop(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.stop(id, user.userId);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'List logs for a bot (newest first)' })
  @ApiOkResponse({
    description: 'Paginated bot log entries',
  })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  async findLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListBotLogsQueryDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.botsService.findLogs(id, user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bot by ID' })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.findOne(id, user.userId);
  }

  @Post('from-builder')
  @ApiOperation({ summary: 'Create a bot from the visual strategy builder' })
  @ApiOkResponse({ description: 'Created bot with builder config' })
  @ApiBadRequestResponse({ description: 'Invalid builder config' })
  async createFromBuilder(
    @Body() dto: CreateBotFromBuilderDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.botsService.createFromBuilder(dto, user.userId);
  }

  @Post('from-code')
  @ApiOperation({ summary: 'Create a bot from a saved strategy code' })
  @ApiOkResponse({ description: 'Created bot (custom_code strategy)' })
  async createFromCode(@Body() dto: CreateBotFromCodeDto, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.createFromCode(dto, user.userId);
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
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.botsService.remove(id, user.userId);
  }
}
