import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TradesService } from './trades.service';

@ApiTags('trades')
@Controller('trades')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all trades for current user' })
  @ApiQuery({ name: 'botId', required: false })
  async findAll(@Request() req, @Query('botId') botId?: string) {
    return this.tradesService.findAll(req.user.userId, botId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get trade by ID' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.tradesService.findOne(id, req.user.userId);
  }
}
