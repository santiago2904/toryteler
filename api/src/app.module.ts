import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envSchema } from './config/configuration';
import { AppDataSource } from './database/data-source';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    // Same options as the CLI data source, so migrations and the running app
    // can never disagree about the schema.
    TypeOrmModule.forRoot({ ...AppDataSource.options, autoLoadEntities: true }),
  ],
})
export class AppModule {}
