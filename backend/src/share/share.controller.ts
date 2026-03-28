import { Controller, Get, Post, Body, Query, Param, UseGuards, NotFoundException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ShareService } from './share.service';
import { BotsService } from '../bots/bots.service';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('marketplace')
@Controller('marketplace')
export class ShareController {
  constructor(
    private readonly shareService: ShareService,
    private readonly botsService: BotsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Browse public bots/strategies' })
  @ApiOkResponse({ description: 'Paginated list of public bots' })
  async browse(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('search') search?: string,
    @Query('strategy') strategy?: string,
  ) {
    return this.shareService.browsePublic({
      take: take ? parseInt(take, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
      search,
      strategy,
    });
  }

  @Get('bot/:slug')
  @ApiOperation({ summary: 'Get a public bot by share slug (no auth required)' })
  @ApiOkResponse({ description: 'Public bot details' })
  @ApiNotFoundResponse({ description: 'Not found' })
  async getBySlug(@Param('slug') slug: string) {
    const bot = await this.shareService.getBySlug(slug);
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }
    return bot;
  }

  @Post('clone/:slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clone a public bot into your account' })
  @ApiOkResponse({ description: 'Cloned bot created in your account' })
  @ApiNotFoundResponse({ description: 'Bot not found' })
  async clone(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() body: { name?: string; symbol?: string },
  ) {
    const source = await this.shareService.getBySlug(slug);
    if (!source) {
      throw new NotFoundException('Bot not found');
    }

    return this.botsService.cloneFromShare(source, user.userId, body.name, body.symbol);
  }
}
