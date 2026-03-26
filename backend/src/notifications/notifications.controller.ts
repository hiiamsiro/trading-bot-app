import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { MarkNotificationReadDto } from './dto/mark-notification-read.dto';
import { NotificationsService } from './notifications.service';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for current user (newest first)' })
  @ApiOkResponse({ description: 'Paginated notifications with unread count' })
  async findAll(@CurrentUser() user: AuthUserPayload, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.findAll(user.userId, query);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification read/unread' })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() body: MarkNotificationReadDto,
  ) {
    return this.notificationsService.markOneRead(user.userId, id, body.isRead ?? true);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  @ApiOkResponse({ description: 'Count of notifications updated' })
  async markAllRead(@CurrentUser() user: AuthUserPayload) {
    return this.notificationsService.markAllRead(user.userId);
  }
}
