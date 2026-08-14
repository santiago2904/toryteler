import {
  Body,
  Controller,
  INestApplication,
  Module,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { IdempotencyInterceptor } from '../../src/common/idempotency/idempotency.interceptor';

/** Counts real executions: the point is that the effect happens once. */
let runs = 0;

@Controller('demo')
class DemoController {
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  create(@Body() body: { value: string }) {
    runs += 1;
    return { id: `created-${runs}`, echo: body.value };
  }

  @Post('boom')
  @UseInterceptors(IdempotencyInterceptor)
  fail() {
    runs += 1;
    throw new Error('handler exploded');
  }
}

describe('idempotency', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    ds = await testDb();

    @Module({
      imports: [TypeOrmModule.forRoot({ ...ds.options, autoLoadEntities: true })],
      controllers: [DemoController],
    })
    class TestModule {}

    const mod = await Test.createTestingModule({ imports: [TestModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });

  beforeEach(async () => { await truncateAll(ds); runs = 0; });
  afterAll(async () => { await app.close(); await ds.destroy(); });

  const post = (path = '/demo') => request(app.getHttpServer()).post(path);

  it('requires the Idempotency-Key header', async () => {
    await post().send({ value: 'a' }).expect(400);
    expect(runs).toBe(0);
  });

  it('same key and same body returns the original answer', async () => {
    const first = await post().set('Idempotency-Key', 'k1').send({ value: 'a' }).expect(201);
    const second = await post().set('Idempotency-Key', 'k1').send({ value: 'a' }).expect(201);
    expect(second.body).toEqual(first.body);
    expect(runs).toBe(1);
  });

  it('same key with a different body is rejected', async () => {
    await post().set('Idempotency-Key', 'k2').send({ value: 'a' }).expect(201);
    await post().set('Idempotency-Key', 'k2').send({ value: 'b' }).expect(409);
    expect(runs).toBe(1);
  });

  it('two simultaneous requests run the effect once', async () => {
    const send = () => post().set('Idempotency-Key', 'k3').send({ value: 'a' });
    const [a, b] = await Promise.all([send(), send()]);

    // What must hold is that the effect happened once. The loser either gets
    // the stored answer or, if it arrives while the original is still running,
    // a 409 telling it to retry — asserting one of the two would make this test
    // depend on which request wins a race that is decided in microseconds.
    expect(runs).toBe(1);
    for (const res of [a, b]) expect([201, 409]).toContain(res.status);
    const answered = [a, b].filter((r) => r.status === 201);
    for (const res of answered) expect(res.body).toEqual(answered[0].body);
  });

  it('different keys are different requests', async () => {
    await post().set('Idempotency-Key', 'k4').send({ value: 'a' }).expect(201);
    await post().set('Idempotency-Key', 'k5').send({ value: 'a' }).expect(201);
    expect(runs).toBe(2);
  });

  it('a failed handler leaves the key reusable', async () => {
    await post('/demo/boom').set('Idempotency-Key', 'k6').send({}).expect(500);
    const [{ count }] = await ds.query(
      `SELECT count(*)::int AS count FROM idempotency_keys WHERE key = 'k6'`);
    expect(count).toBe(0);
  });
});
