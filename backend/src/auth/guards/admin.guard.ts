import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type AuthUserPayload = { userId: string; email: string };

function parseAdminEmails(raw: string | undefined | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly adminEmails: Set<string>;

  constructor(private readonly configService: ConfigService) {
    this.adminEmails = parseAdminEmails(this.configService.get<string>('ADMIN_EMAILS'));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUserPayload | undefined;

    const email = user?.email?.toLowerCase();
    if (!email || !this.adminEmails.has(email)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
