import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BillingService, PLAN_ORDER, PlanLimits } from './billing.service';
import { UpdatePlanDto } from './dto/update-plan.dto';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('billing')
@Controller('billing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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
  async getLimits(@CurrentUser() user: AuthUserPayload): Promise<PlanLimits> {
    const plan = await this.billingService.getPlan(user.userId);
    return this.billingService.getPlanLimits(plan);
  }

  @Patch('plan')
  @ApiOperation({ summary: 'Update subscription plan (simulated — no Stripe)' })
  @ApiOkResponse({ description: 'Updated subscription' })
  @ApiForbiddenResponse({ description: 'Downgrade not supported' })
  async updatePlan(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdatePlanDto,
  ) {
    const target = dto.plan;

    // Explicit allow-list guard (belt-and-suspenders over class-validator)
    if (!PLAN_ORDER.includes(target)) {
      throw new BadRequestException(`Invalid plan: ${target}`);
    }

    // Atomic: read current plan + downgrade check + upsert in same transaction
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
    const limits = this.billingService.getPlanLimits(updated.plan);
    return { ...updated, limits };
  }
}
