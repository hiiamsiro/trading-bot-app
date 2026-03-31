import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /** GET /leaderboard?sortBy=pnl|winRate|drawdown&limit=20&offset=0 */
  @Get()
  async getLeaderboard(
    @Req() req: { user?: { userId: string } },
    @Query('sortBy') sortBy: 'pnl' | 'winRate' | 'drawdown' = 'pnl',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    return this.leaderboardService.getLeaderboard(
      { sortBy, limit: parsedLimit, offset: parsedOffset },
      req.user?.userId,
    );
  }
}
