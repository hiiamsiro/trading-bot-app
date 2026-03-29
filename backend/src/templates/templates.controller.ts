import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('templates')
@Controller('templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List user templates and system defaults' })
  @ApiOkResponse({ description: 'All available templates for the user' })
  async findAll(@CurrentUser() user: AuthUserPayload) {
    return this.templatesService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a template by ID' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.templatesService.findOne(id, user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Save the current configuration as a reusable template' })
  @ApiOkResponse({ description: 'Created template' })
  async create(@Body() dto: CreateTemplateDto, @CurrentUser() user: AuthUserPayload) {
    return this.templatesService.create(dto, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user template' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUserPayload) {
    return this.templatesService.remove(id, user.userId);
  }
}
