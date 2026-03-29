import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  RawBody,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BillingService, PLAN_ORDER } from './billing.service';
import { StripeService } from '../stripe/stripe.service';
import { WebhookHandler } from './webhook.handler';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('billing')
@Controller('billing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly stripeService: StripeService,
    private readonly webhookHandler: WebhookHandler,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user subscription + plan limits' })
  @ApiOkResponse({ description: 'Subscription details with effective plan limits' })
  async getMySubscription(@CurrentUser() user: AuthUserPayload) {
    const sub = await this.billingService.getOrCreateSubscription(user.userId);
    const limits = this.billingService.getPlanLimits(sub.plan);
    return {
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      limits,
    };
  }

  @Get('limits')
  @ApiOperation({ summary: 'Plan limits for the current user' })
  @ApiOkResponse({ description: 'Effective plan limits' })
  async getLimits(@CurrentUser() user: AuthUserPayload) {
    const plan = await this.billingService.getPlan(user.userId);
    return this.billingService.getPlanLimits(plan);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe Checkout session to upgrade plan' })
  @ApiOkResponse({ description: 'Redirect URL to Stripe Checkout' })
  async createCheckout(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateCheckoutDto,
  ) {
    const { url } = await this.stripeService.createCheckoutSession(
      user.userId,
      user.email,
      dto.plan,
    );
    return { url };
  }

  @Post('portal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe Billing Portal session' })
  @ApiOkResponse({ description: 'Redirect URL to Stripe Billing Portal' })
  async createPortalSession(@CurrentUser() user: AuthUserPayload) {
    const dbUser = await this.billingService.getUserWithStripeCustomer(user.userId);
    if (!dbUser?.stripeCustomerId) {
      throw new BadRequestException('No billing account found');
    }
    const { url } = await this.stripeService.createPortalSession(dbUser.stripeCustomerId);
    return { url };
  }

  @Post('webhook')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint (no auth — validated by signature)' })
  async handleWebhook(
    @Headers('stripe-signature') sig: string,
    @RawBody() rawBody: Buffer,
  ) {
    const event = this.stripeService.constructWebhookEvent(rawBody, sig);
    await this.webhookHandler.handleEvent(event);
    return { received: true };
  }

  @Patch('plan')
  @ApiOperation({ summary: 'Update subscription plan (admin/internal use)' })
  @ApiOkResponse({ description: 'Updated subscription' })
  @ApiForbiddenResponse({ description: 'Downgrade not supported' })
  async updatePlan(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdatePlanDto,
  ) {
    const target = dto.plan;

    if (!PLAN_ORDER.includes(target)) {
      throw new BadRequestException(`Invalid plan: ${target}`);
    }

    const updated = await this.billingService.updatePlanAtomically(
      user.userId,
      target,
      PLAN_ORDER,
      (currentRank: number, targetRank: number) => {
        if (targetRank < currentRank) {
          throw new ForbiddenException('Downgrade not supported in this version');
        }
      },
    );

    const limits = this.billingService.getPlanLimits(updated.plan);
    return { ...updated, limits };
  }

  @Patch('cancel')
  @ApiOperation({ summary: 'Cancel subscription (reverts to Free)' })
  @ApiOkResponse({ description: 'Subscription cancelled' })
  async cancel(@CurrentUser() user: AuthUserPayload) {
    const updated = await this.billingService.cancelSubscription(user.userId);
    // cancelSubscription is idempotent — no sub record means already cancelled
    const plan = updated?.plan ?? 'FREE';
    const limits = this.billingService.getPlanLimits(plan);
    return { plan, status: updated?.status ?? 'CANCELLED', limits };
  }
}
