import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PortfolioService } from './portfolio.service';

@Controller('portfolios')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  findAll(@Request() req: { user: { sub: string } }) {
    return this.portfolioService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: { sub: string } }) {
    return this.portfolioService.findOne(id, req.user.sub);
  }

  @Get(':id/metrics')
  getMetrics(@Param('id') id: string, @Request() req: { user: { sub: string } }) {
    return this.portfolioService.getMetrics(id, req.user.sub);
  }

  @Post()
  create(
    @Body() dto: { name: string; botIds?: string[] },
    @Request() req: { user: { sub: string } },
  ) {
    return this.portfolioService.create(req.user.sub, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; botIds?: string[] },
    @Request() req: { user: { sub: string } },
  ) {
    return this.portfolioService.update(id, req.user.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: { sub: string } }) {
    return this.portfolioService.remove(id, req.user.sub);
  }
}
