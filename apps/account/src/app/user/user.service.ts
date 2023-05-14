import { Injectable } from '@nestjs/common';
import { UserEntity } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { RMQService } from 'nestjs-rmq';
import { IUser } from '@purple/interface';
import { BuyCourseSaga } from '../sagas/buy-course.saga';
import { UserEventEmitter } from './user.event-emitter';

@Injectable()
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private rmqService: RMQService,
    private userEventEmitter: UserEventEmitter
  ) {}

  async changeProfile(user: Pick<IUser, 'displayName'>, id: string) {
    const userEntity = await this.getUser(id);
    const updatedUser = userEntity.updateProfile(user.displayName);
    await this.updateUser(updatedUser);

    return {};
  }

  async buyCourse(userId: string, courseId: string) {
    const userEntity = await this.getUser(userId);
    const saga = new BuyCourseSaga(userEntity, courseId, this.rmqService);

    const { user, paymentLink } = await saga.getState().pay();
    await this.updateUser(user);

    return { paymentLink };
  }

  async checkPayment(userId: string, courseId: string) {
    const userEntity = await this.getUser(userId);
    const saga = new BuyCourseSaga(userEntity, courseId, this.rmqService);
    const { user, status } = await saga.getState().checkPayment();

    await this.updateUser(user);

    return { status };
  }

  private async getUser(userId: string) {
    const existedUser = await this.userRepository.findUserById(userId);

    if (!existedUser) {
      throw new Error('Such user not founded');
    }

    return new UserEntity(existedUser);
  }

  private updateUser(user: UserEntity) {
    return Promise.all([
      this.userRepository.updateUser(user),
      this.userEventEmitter.handle(user),
    ]);
  }
}
