import { ExchangeRateService } from '../../src/payments/exchange-rate.service';

describe('exchange rate', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  function respondWith(body: unknown, ok = true) {
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    }) as unknown as typeof fetch;
  }

  it('reads the rate from the response', async () => {
    respondWith([{ valor: '3144.28' }]);
    const svc = new ExchangeRateService();
    expect(await svc.copPerUsd()).toBeCloseTo(3144.28);
  });

  it('caches it: a second call within the TTL does not fetch again', async () => {
    respondWith([{ valor: '4000' }]);
    const svc = new ExchangeRateService();
    await svc.copPerUsd();
    global.fetch = jest.fn(); // if called again, the assertion below fails
    expect(await svc.copPerUsd()).toBe(4000);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to the last cached rate when the query fails', async () => {
    respondWith([{ valor: '3500' }]);
    const svc = new ExchangeRateService();
    await svc.copPerUsd();
    respondWith({}, false);
    expect(await svc.copPerUsd()).toBe(3500);
  });

  it('refuses to invent a rate when there is no cache and the query fails', async () => {
    respondWith({}, false);
    const svc = new ExchangeRateService();
    await expect(svc.copPerUsd()).rejects.toThrow(/EXCHANGE_RATE_UNAVAILABLE/);
  });

  it('refuses a malformed response the same way', async () => {
    respondWith([{ valor: 'no-es-un-numero' }]);
    const svc = new ExchangeRateService();
    await expect(svc.copPerUsd()).rejects.toThrow(/EXCHANGE_RATE_UNAVAILABLE/);
  });
});
