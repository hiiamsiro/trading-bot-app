import { Module, Global } from '@nestjs/common';
import { AppLogger } from './logger.service';

export { AppLogger } from './logger.service';

@Global()
@Module({
  providers: [
    {
      provide: AppLogger,
      useValue: new AppLogger('system'),
    },
  ],
  exports: [AppLogger],
})
export class LoggingModule {}
