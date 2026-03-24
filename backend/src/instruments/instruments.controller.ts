import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstrumentsService } from './instruments.service';

@ApiTags('instruments')
@Controller('instruments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InstrumentsController {
  constructor(private readonly instrumentsService: InstrumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List active instruments for trading' })
  @ApiOkResponse({ description: 'Array of active instruments' })
  async findActive() {
    return this.instrumentsService.findActive();
  }

  @Get('admin/all')
  @ApiOperation({ summary: 'List all instruments for admin use' })
  @ApiOkResponse({ description: 'Array of all instruments' })
  async findAll() {
    return this.instrumentsService.findAll();
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Get instrument details by symbol' })
  @ApiOkResponse({ description: 'Instrument details' })
  async findOne(@Param('symbol') symbol: string) {
    return this.instrumentsService.findBySymbol(symbol);
  }
}
