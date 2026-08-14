import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AdminGuard, SessionGuard } from './auth/session.guard';
import { envSchema } from './config/configuration';
import { ContractPdfService } from './contracts/contract-pdf.service';
import { ContractsController } from './contracts/contracts.controller';
import { ContractsService } from './contracts/contracts.service';
import { AppDataSource } from './database/data-source';
import { DropsController } from './drops/drops.controller';
import { DropsService } from './drops/drops.service';
import { MailService } from './mail/mail.service';
import { AccountService } from './orders/account.service';
import { MeController } from './orders/me.controller';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { OtpService } from './otp/otp.service';
import { PaymentGateway } from './payments/payment-gateway';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { ReconciliationService } from './payments/reconciliation.service';
import { WompiGateway } from './payments/wompi/wompi.gateway';
import { PiecesController } from './pieces/pieces.controller';
import { PiecesService } from './pieces/pieces.service';
import { PlaybackController } from './playback/playback.controller';
import { PlaybackService, PlaybackUrlSigner } from './playback/playback.service';
import { CloudinaryDocumentStore, DocumentStore } from './storage/document-store';

/**
 * Signs a short-lived Cloudflare Stream URL.
 *
 * Lives here rather than inside PlaybackService so the service never learns who
 * hosts the video: the tests hand it a fake signer and exercise the window
 * logic without a network.
 */
const cloudflareSigner =
  (config: ConfigService): PlaybackUrlSigner =>
  async (videoAssetId, ttlSeconds) => {
    const account = config.get<string>('CF_STREAM_ACCOUNT_ID');
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/stream/${videoAssetId}/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.get<string>('CF_STREAM_TOKEN')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
      },
    );
    if (!res.ok) throw new Error(`CF_STREAM_TOKEN_FAILED_${res.status}`);

    const json = (await res.json()) as { result: { token: string } };
    return `https://customer-stream.cloudflarestream.com/${json.result.token}/manifest/video.m3u8`;
  };

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    // Same options as the CLI data source, so migrations and the running app
    // can never disagree about the schema.
    TypeOrmModule.forRoot({ ...AppDataSource.options, autoLoadEntities: true }),
    // Only the reconciliation sweep runs on a schedule.
    ScheduleModule.forRoot(),
  ],
  controllers: [
    AuthController,
    PiecesController,
    DropsController,
    OrdersController,
    ContractsController,
    PaymentsController,
    PlaybackController,
    MeController,
    AdminController,
  ],
  providers: [
    AuthService,
    SessionGuard,
    AdminGuard,
    OtpService,
    MailService,
    PiecesService,
    DropsService,
    OrdersService,
    AccountService,
    ContractsService,
    ContractPdfService,
    PaymentsService,
    ReconciliationService,
    AdminService,
    // The rest of the system depends on the abstract class, so swapping the
    // provider is this one line.
    { provide: PaymentGateway, useClass: WompiGateway },
    { provide: DocumentStore, useClass: CloudinaryDocumentStore },
    {
      provide: PlaybackService,
      inject: [getDataSourceToken(), ConfigService],
      useFactory: (ds: DataSource, config: ConfigService) =>
        new PlaybackService(ds, cloudflareSigner(config)),
    },
  ],
})
export class AppModule {}
