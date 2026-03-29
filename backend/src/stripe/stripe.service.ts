import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly appUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new InternalServerErrorException('STRIPE_SECRET_KEY is not configured');
    }

    const appUrl = config.get<string>('APP_URL');
    if (!appUrl) {
      throw new InternalServerErrorException('APP_URL is not configured — set it to your deployment URL');
    }

    this.stripe = new Stripe(secretKey);
    this.appUrl = appUrl;
  }

  private getPriceId(plan: 'PRO' | 'PREMIUM'): string {
    const priceId =
      plan === 'PRO'
        ? this.config.get<string>('STRIPE_PRO_PRICE_ID')
        : this.config.get<string>('STRIPE_PREMIUM_PRICE_ID');
    if (!priceId) {
      throw new InternalServerErrorException(
        `STRIPE_${plan}_PRICE_ID is not configured`,
      );
    }
    return priceId;
  }

  private getProductName(plan: 'PRO' | 'PREMIUM'): string {
    return (
      this.config.get<string>(`STRIPE_${plan}_PRODUCT_NAME`) ??
      `Trading Bot ${plan}`
    );
  }

  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (user?.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      metadata: { userId },
      email,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createCheckoutSession(
    userId: string,
    email: string,
    plan: 'PRO' | 'PREMIUM',
  ): Promise<{ url: string }> {
    const customerId = await this.getOrCreateCustomer(userId, email);
    const priceId = this.getPriceId(plan);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.appUrl}/settings?tab=billing&checkout=success`,
      cancel_url: `${this.appUrl}/settings?tab=billing&checkout=cancelled`,
      metadata: { userId, plan },
      subscription_data: {
        metadata: { userId, plan },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new InternalServerErrorException('Failed to create checkout session');
    }

    return { url: session.url };
  }

  async createPortalSession(stripeCustomerId: string): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${this.appUrl}/settings?tab=billing`,
    });

    return { url: session.url };
  }

  constructWebhookEvent(payload: Buffer, sig: string): Stripe.Event {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET is not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    } catch (err) {
      // Re-throw Stripe signature errors as BadRequestException so AllExceptionsFilter
      // returns a 400 to Stripe (triggering retry) with a safe message.
      const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
      throw new BadRequestException(message);
    }
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }
}
