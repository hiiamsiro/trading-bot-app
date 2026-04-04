import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StrategySandboxService } from './strategy-sandbox.service';
import { CreateStrategyCodeDto } from './dto/create-strategy-code.dto';
import { UpdateStrategyCodeDto } from './dto/update-strategy-code.dto';

@Injectable()
export class StrategyCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sandbox: StrategySandboxService,
  ) {}

  async saveCode(
    userId: string,
    data: CreateStrategyCodeDto,
  ) {
    return this.prisma.strategyCode.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        code: data.code,
        language: data.language ?? 'javascript',
      },
    });
  }

  async getCode(id: string) {
    const code = await this.prisma.strategyCode.findUnique({ where: { id } });
    if (!code) {
      throw new NotFoundException('Strategy code not found');
    }
    return code;
  }

  async getCodeForUser(id: string, userId: string) {
    const code = await this.prisma.strategyCode.findFirst({
      where: { id, userId },
    });
    if (!code) {
      throw new NotFoundException('Strategy code not found');
    }
    return code;
  }

  async listCodes(userId: string) {
    return this.prisma.strategyCode.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        name: true,
        description: true,
        language: true,
        isValid: true,
        lastValidAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateCode(
    id: string,
    userId: string,
    data: UpdateStrategyCodeDto,
  ) {
    // Atomic: WHERE includes userId to prevent cross-user TOCTOU race
    return this.prisma.strategyCode.update({
      where: { id, userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.language !== undefined ? { language: data.language } : {}),
      },
    });
  }

  async deleteCode(id: string, userId: string) {
    const code = await this.getCodeForUser(id, userId);

    // Ensure no bots reference this source code before deleting
    const botsUsing = await this.prisma.bot.findMany({
      where: {
        strategyConfig: {
          sourceCodeId: id,
        },
      },
    });

    if (botsUsing.length > 0) {
      throw new ForbiddenException(
        `Cannot delete: ${botsUsing.length} bot(s) still reference this strategy code. Unlink them first.`,
      );
    }

    return this.prisma.strategyCode.delete({ where: { id } });
  }

  /**
   * Validates strategy code by executing it in the sandbox.
   * Updates isValid and lastValidAt on the record if an id is provided.
   * Returns the sandbox result directly for ad-hoc validation.
   */
  async validateCode(code: string): Promise<{ valid: boolean; result: string }> {
    const defaultContext = {
      symbol: 'BTCUSD',
      interval: '1h',
      candles: Array.from({ length: 50 }, (_, i) => ({
        open: 50000 + i * 100,
        high: 50200 + i * 100,
        low: 49800 + i * 100,
        close: 50100 + i * 100,
        volume: 1000,
      })),
      position: null as 'long' | 'short' | null,
      balance: 10000,
      entryPrice: null,
    };

    try {
      const result = await this.sandbox.execute(code, defaultContext);
      return { valid: true, result: result ? `${result.action} (${result.confidence}): ${result.reason}` : 'HOLD (no signal)' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      return { valid: false, result: message };
    }
  }

  async validateAndSave(
    userId: string,
    data: CreateStrategyCodeDto,
  ) {
    const validation = await this.validateCode(data.code);

    const record = await this.prisma.strategyCode.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        code: data.code,
        language: data.language ?? 'javascript',
        isValid: validation.valid,
        lastValidAt: validation.valid ? new Date() : null,
      },
    });

    return { record, validation };
  }
}
