import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

type AuthUserPayload = { userId: string; email: string; isAdmin: boolean };

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUserPayload | undefined;

    if (user?.isAdmin === true) {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}