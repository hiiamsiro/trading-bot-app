import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.create(registerDto);
    const token = this.generateToken(user.id, user.email, user.isAdmin);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user.id, user.email, user.isAdmin);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
      token,
    };
  }

  private generateToken(userId: string, email: string, isAdmin: boolean): string {
    return this.jwtService.sign({ sub: userId, email, isAdmin });
  }
}
