import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { InstrumentsService } from './instruments.service';
import { SetInstrumentActivationDto } from './dto/set-instrument-activation.dto';
import { ListInstrumentsQueryDto } from './dto/list-instruments-query.dto';

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
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'List all instruments for admin use' })
  @ApiOkResponse({ description: 'Paginated instrument catalog for admin use' })
  async findAll(@Query() query: ListInstrumentsQueryDto) {
    const take = query.take ?? 10;
    const skip = query.skip ?? 0;
    return this.instrumentsService.findAll(take, skip, query.search);
  }

  @Post('admin/sync')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Sync instruments from configured provider metadata API' })
  @ApiOkResponse({ description: 'Sync result summary' })
  async syncFromProvider() {
    return this.instrumentsService.syncFromProvider();
  }

  @Patch('admin/:symbol/activation')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Activate or deactivate an instrument for trading' })
  @ApiOkResponse({ description: 'Updated instrument' })
  async setActivation(@Param('symbol') symbol: string, @Body() body: SetInstrumentActivationDto) {
    return this.instrumentsService.setActivationBySymbol(symbol, body.isActive);
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Get instrument details by symbol' })
  @ApiOkResponse({ description: 'Instrument details' })
  async findOne(@Param('symbol') symbol: string) {
    return this.instrumentsService.findBySymbol(symbol);
  }
}
