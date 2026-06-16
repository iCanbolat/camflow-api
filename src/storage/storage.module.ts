import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BunnyStorageService } from './bunny-storage.service';
import { LocalStorageService } from './local-storage.service';
import { STORAGE } from './storage.provider';

/**
 * Provides the active StorageProvider under the `STORAGE` token, selected by
 * STORAGE_DRIVER (local for dev, bunny for prod).
 */
@Global()
@Module({
  providers: [
    LocalStorageService,
    BunnyStorageService,
    {
      provide: STORAGE,
      inject: [ConfigService, LocalStorageService, BunnyStorageService],
      useFactory: (
        config: ConfigService,
        local: LocalStorageService,
        bunny: BunnyStorageService,
      ) =>
        config.get<string>('STORAGE_DRIVER', 'local') === 'bunny'
          ? bunny
          : local,
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
