import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * Public leaderboard — returns top public bots ranked by PnL, win rate, or drawdown.
   * No authentication required. Intentionally unauthenticated so anyone can browse rankings.
   */
  @Get()
  async getLeaderboard(
    @Query('sortBy') sortBy: 'pnl' | 'winRate' | 'drawdown' = 'pnl',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    return this.leaderboardService.getLeaderboard(
      { sortBy, limit: parsedLimit, offset: parsedOffset },
      // intentionally public — requestingUserId is always undefined
    );
  }
}
