import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BotsService } from './bots.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';

@ApiTags('bots')
@Controller('bots')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all bots for current user' })
  async findAll(@Request() req) {
    return this.botsService.findAll(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bot by ID' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.botsService.findOne(id, req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new bot' })
  async create(@Body() createBotDto: CreateBotDto, @Request() req) {
    return this.botsService.create(createBotDto, req.user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update bot' })
  async update(
    @Param('id') id: string,
    @Body() updateBotDto: UpdateBotDto,
    @Request() req,
  ) {
    return this.botsService.update(id, updateBotDto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete bot' })
  async remove(@Param('id') id: string, @Request() req) {
    return this.botsService.remove(id, req.user.userId);
  }
}
