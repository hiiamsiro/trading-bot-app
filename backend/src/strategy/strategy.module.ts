import { Module } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { StrategyBuilderService } from './strategy-builder.service';
import { StrategyBuilderController } from './strategy.controller';

@Module({
  controllers: [StrategyBuilderController],
  providers: [StrategyService, StrategyBuilderService],
  exports: [StrategyService, StrategyBuilderService],
})
export class StrategyModule {}
