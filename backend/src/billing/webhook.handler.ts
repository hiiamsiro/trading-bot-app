import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { periodEnd } from './billing.service';
import { SubStatus } from '@prisma/client';

@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly config: ConfigService,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan as 'PRO' | 'PREMIUM' | undefined;

    if (!userId || !plan) {
      this.logger.warn(`checkout.session.completed missing userId or plan: ${session.id}`);
      return;
    }

    const subscriptionId = session.subscription as string | null;
    if (!subscriptionId) {
      this.logger.warn(`checkout.session.completed missing subscription: ${session.id}`);
      return;
    }

    // Fetch the full subscription from Stripe to get the actual billing period
    const stripeSub = await this.stripeService.retrieveSubscription(subscriptionId);
    const priceId = stripeSub.items.data[0]?.price.id;
    const periodEndDate = this.getPeriodEndDate(stripeSub);

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        status: 'ACTIVE',
        currentPeriodEnd: periodEndDate,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
      },
      update: {
        plan,
        status: 'ACTIVE',
        currentPeriodEnd: periodEndDate,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
      },
    });

    this.logger.log(`Subscription activated for user ${userId}: ${plan}`);
  }

  private async handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
    const userId = sub.metadata?.userId;
    if (!userId) {
      this.logger.warn(`subscription.updated missing userId: ${sub.id}`);
      return;
    }

    const plan = (sub.metadata?.plan ?? this.inferPlanFromSub(sub)) as 'PRO' | 'PREMIUM' | undefined;
    if (!plan) {
      this.logger.warn(`subscription.updated could not infer plan: ${sub.id}`);
      return;
    }

    const status = this.mapSubscriptionStatus(sub.status);
    const periodEndDate = this.getPeriodEndDate(sub);
    const priceId = sub.items.data[0]?.price.id;

    const result = await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: { plan, status, currentPeriodEnd: periodEndDate, stripePriceId: priceId },
    });

    if (result.count === 0) {
      this.logger.warn(`No subscription found in DB for Stripe subscription: ${sub.id} (userId: ${userId})`);
    } else {
      this.logger.log(`Subscription updated for user ${userId}: ${plan} (${status})`);
    }
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const result = await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: { status: 'CANCELLED' as SubStatus },
    });

    if (result.count === 0) {
      this.logger.warn(`No subscription found in DB for deleted Stripe subscription: ${sub.id}`);
    } else {
      this.logger.log(`Subscription cancelled: ${sub.id}`);
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = this.getSubscriptionId(invoice);
    if (!subscriptionId) {
      this.logger.warn(`invoice.payment_failed: could not determine subscription from invoice: ${invoice.id}`);
      return;
    }

    const result = await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscriptionId },
      data: { status: 'PAST_DUE' as SubStatus },
    });

    if (result.count === 0) {
      this.logger.warn(`No subscription found in DB for PAST_DUE Stripe subscription: ${subscriptionId}`);
    } else {
      this.logger.warn(`Payment failed for subscription: ${subscriptionId}`);
    }
  }

  private inferPlanFromSub(sub: Stripe.Subscription): string | undefined {
    const priceId = sub.items.data[0]?.price.id;
    const proPriceId = this.config.get<string>('STRIPE_PRO_PRICE_ID');
    const premiumPriceId = this.config.get<string>('STRIPE_PREMIUM_PRICE_ID');

    if (priceId === proPriceId) return 'PRO';
    if (priceId === premiumPriceId) return 'PREMIUM';
    return undefined;
  }

  private getPeriodEndDate(sub: Stripe.Subscription): Date {
    // Stripe returns current_period_end in the API but it's not in the TypeScript SDK types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = sub as any;
    if (raw.current_period_end) {
      return new Date(raw.current_period_end * 1000);
    }
    return periodEnd();
  }

  private getSubscriptionId(invoice: Stripe.Invoice): string | undefined {
    const raw = invoice as unknown as { subscription?: string | { id?: string } };
    if (typeof raw.subscription === 'string') return raw.subscription;
    if (raw.subscription?.id) return raw.subscription.id;
    const lines = invoice.lines?.data ?? [];
    for (const line of lines as Array<{ subscription?: string | { id?: string } }>) {
      if (typeof line.subscription === 'string') return line.subscription;
      if (line.subscription?.id) return line.subscription.id;
    }
    return undefined;
  }

  private mapSubscriptionStatus(status: Stripe.Subscription.Status): SubStatus {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'ACTIVE';
      case 'past_due':
      case 'unpaid':
        return 'PAST_DUE';
      default:
        return 'CANCELLED';
    }
  }
}
