import { BuyCourseSagaState } from './buy-course.state';
import { UserEntity } from '../user/entities/user.entity';
import {
  CourseGetCourse,
  PaymentCheck,
  PaymentGenerateLink,
  PaymentStatus,
} from '@purple/contracts';
import { PurchaseState } from '@purple/interface';

export class BuyCourseSagaStateStarted extends BuyCourseSagaState {
  public async pay(): Promise<{ paymentLink: string; user: UserEntity }> {
    const { course } = await this.saga.rmqService.send<
      CourseGetCourse.Request,
      CourseGetCourse.Response
    >(CourseGetCourse.topic, { id: this.saga.courseId });

    if (!course) {
      throw new Error('This course is not exist');
    }

    if (course.price === 0) {
      this.saga.setState(PurchaseState.Purchased, course._id);
      return { paymentLink: null, user: this.saga.user };
    }

    const { paymentLink } = await this.saga.rmqService.send<
      PaymentGenerateLink.Request,
      PaymentGenerateLink.Response
    >(PaymentGenerateLink.topic, {
      courseId: course._id,
      userId: this.saga.user._id,
      sum: course.price,
    });

    this.saga.setState(PurchaseState.WaitingForPayment, course._id);

    return { paymentLink, user: this.saga.user };
  }

  public async checkPayment(): Promise<{
    user: UserEntity;
    status: PaymentStatus;
  }> {
    throw new Error('Cant check payment that isnt started');
  }

  public async cancel(): Promise<{ user: UserEntity }> {
    this.saga.setState(PurchaseState.Cancelled, this.saga.courseId);

    return { user: this.saga.user };
  }
}

export class BuyCourseSagaStateWaitingForPayment extends BuyCourseSagaState {
  pay(): Promise<{ paymentLink: string; user: UserEntity }> {
    throw new Error('Cant create a link when payment is in process');
  }

  async checkPayment(): Promise<{ user: UserEntity; status: PaymentStatus }> {
    const { status } = await this.saga.rmqService.send<
      PaymentCheck.Request,
      PaymentCheck.Response
    >(PaymentCheck.topic, {
      courseId: this.saga.courseId,
      userId: this.saga.user._id,
    });

    if (status === 'Cancelled') {
      this.saga.setState(PurchaseState.Cancelled, this.saga.courseId);

      return { user: this.saga.user, status: 'Cancelled' };
    }

    if (status !== 'Success') {
      return { user: this.saga.user, status: 'Success' };
    }

    this.saga.setState(PurchaseState.Purchased, this.saga.courseId);
    return { user: this.saga.user, status: 'Progress' };
  }

  cancel(): Promise<{ user: UserEntity }> {
    throw new Error('Cant cancel payment in process');
  }
}

export class BuyCourseSagaStatePurchased extends BuyCourseSagaState {
  pay(): Promise<{ paymentLink: string; user: UserEntity }> {
    throw new Error('Cant pay for purchased course');
  }

  checkPayment(): Promise<{ user: UserEntity; status: PaymentStatus }> {
    throw new Error('Cant check payment for purchased course');
  }

  cancel(): Promise<{ user: UserEntity }> {
    throw new Error('Cant cancel payment for purchased course');
  }
}

export class BuyCourseSagaStateCanceled extends BuyCourseSagaState {
  async pay(): Promise<{ paymentLink: string; user: UserEntity }> {
    this.saga.setState(PurchaseState.Started, this.saga.courseId);

    return this.saga.getState().pay();
  }

  checkPayment(): Promise<{ user: UserEntity; status: PaymentStatus }> {
    throw new Error('Cant check payment for canceled course');
  }

  cancel(): Promise<{ user: UserEntity }> {
    throw new Error('This payment for course already cancelled');
  }
}
