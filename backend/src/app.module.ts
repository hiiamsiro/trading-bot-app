import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BotsModule } from './bots/bots.module';
import { TradesModule } from './trades/trades.module';
import { MarketDataModule } from './market-data/market-data.module';
import { JobsModule } from './jobs/jobs.module';
import { InstrumentsModule } from './instruments/instruments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LogsModule } from './logs/logs.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { BacktestModule } from './backtest/backtest.module';
import { TemplatesModule } from './templates/templates.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { StrategyModule } from './strategy/strategy.module';
import { ShareModule } from './share/share.module';
import { LoggingModule } from './common/logging/logging.module';
import { BillingModule } from './billing/billing.module';
import { StripeModule } from './stripe/stripe.module';
import { OptimizationModule } from './optimization/optimization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggingModule,
    // Global rate limiting: 100 requests/minute per IP (generous for normal usage)
    ThrottlerModule.forRoot([
      {
        name: 'default',
        limit: 100,
        ttl: 60_000,
      },
    ]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        db: parseInt(process.env.REDIS_DB || '0', 10),
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BotsModule,
    TradesModule,
    MarketDataModule,
    InstrumentsModule,
    DashboardModule,
    LogsModule,
    AdminModule,
    NotificationsModule,
    HealthModule,
    JobsModule,
    BacktestModule,
    TemplatesModule,
    PortfolioModule,
    StrategyModule,
    ShareModule,
    BillingModule,
    StripeModule,
    OptimizationModule,
  ],
})
export class AppModule {}
