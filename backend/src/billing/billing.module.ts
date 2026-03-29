import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { WebhookHandler } from './webhook.handler';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [ConfigModule, StripeModule],
  controllers: [BillingController],
  providers: [BillingService, WebhookHandler],
  exports: [BillingService],
})
export class BillingModule {}
