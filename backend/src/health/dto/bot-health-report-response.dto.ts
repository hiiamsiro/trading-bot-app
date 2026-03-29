import { ApiProperty } from '@nestjs/swagger';

export class BotHealthIssueDto {
  @ApiProperty({ example: 'uuid' })
  botId: string;

  @ApiProperty({ example: 'BTC Scalper' })
  botName: string;

  @ApiProperty({ example: 'BTCUSDT' })
  symbol: string;

  @ApiProperty({ enum: ['stuck', 'no_data'] })
  issue: 'stuck' | 'no_data';

  @ApiProperty({ example: 'No tick received in 15m' })
  detail: string;

  @ApiProperty({ example: '2026-03-29T10:00:00.000Z', nullable: true })
  lastRunAt: string | null;

  @ApiProperty({ example: '2026-03-29T09:55:00.000Z', nullable: true })
  lastSignalAt: string | null;

  @ApiProperty({ example: 900000 })
  sinceMs: number;
}

export class HealthyBotDto {
  @ApiProperty({ example: 'uuid' })
  botId: string;

  @ApiProperty({ example: 'ETH Bot' })
  botName: string;

  @ApiProperty({ example: 'ETHUSDT' })
  symbol: string;
}

export class BotHealthReportResponseDto {
  @ApiProperty()
  totalRunning: number;

  @ApiProperty({ type: [BotHealthIssueDto] })
  stuck: BotHealthIssueDto[];

  @ApiProperty({ type: [BotHealthIssueDto] })
  noData: BotHealthIssueDto[];

  @ApiProperty({ type: [HealthyBotDto] })
  healthy: HealthyBotDto[];
}
