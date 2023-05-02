import { Injectable } from '@nestjs/common';
import { UserRepository } from '../user/repositories/user.repository';
import { UserEntity } from '../user/entities/user.entity';
import { UserRole } from '@purple/interface';
import { JwtService } from '@nestjs/jwt';
import { AccountRegister } from '@purple/contracts';

@Injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService
  ) {}

  async register({ email, password, displayName }: AccountRegister.Request) {
    const oldUser = await this.userRepository.findUserByEmail(email);

    if (oldUser) {
      throw new Error('User already registered');
    }

    const userEntity = await new UserEntity({
      displayName,
      email,
      passwordHash: '',
      role: UserRole.Student,
    }).setPassword(password);

    const newUser = await this.userRepository.createUser(userEntity);

    return { email: newUser.email };
  }

  async validateUser(email: string, password: string) {
    const user = await this.userRepository.findUserByEmail(email);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const userEntity = await new UserEntity(user);
    const isCorrectPassword = await userEntity.validatePassword(password);

    if (!isCorrectPassword) {
      throw new Error('Invalid email or password');
    }

    return { id: user._id };
  }

  async login(id: string) {
    return {
      access_token: await this.jwtService.signAsync({ id }),
    };
  }
}
