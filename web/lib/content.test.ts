import { content } from './content';

describe('content', () => {
  const ORIGINAL_ENV = process.env;
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => { process.env = { ...ORIGINAL_ENV }; });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    global.fetch = ORIGINAL_FETCH;
  });

  it('sin API_URL, siempre devuelve el fallback', async () => {
    delete process.env.API_URL;
    expect(await content('home.empty.body', 'Texto original')).toBe('Texto original');
  });

  it('con override, devuelve el texto guardado', async () => {
    process.env.API_URL = 'http://api.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'home.empty.body': 'Texto nuevo' }),
    }) as never;
    expect(await content('home.empty.body', 'Texto original')).toBe('Texto nuevo');
  });

  it('sin override para esa clave, devuelve el fallback', async () => {
    process.env.API_URL = 'http://api.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'otra.clave': 'x' }),
    }) as never;
    expect(await content('home.empty.body', 'Texto original')).toBe('Texto original');
  });

  it('si la API falla, cae al fallback en vez de tronar la página', async () => {
    process.env.API_URL = 'http://api.test';
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as never;
    expect(await content('home.empty.body', 'Texto original')).toBe('Texto original');
  });

  it('si la API responde con error, cae al fallback', async () => {
    process.env.API_URL = 'http://api.test';
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as never;
    expect(await content('home.empty.body', 'Texto original')).toBe('Texto original');
  });
});
