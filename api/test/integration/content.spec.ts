import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { ContentService } from '../../src/content/content.service';

describe('content overrides', () => {
  let ds: DataSource;
  let content: ContentService;
  let adminId: string;

  beforeAll(async () => {
    ds = await testDb();
    content = new ContentService(ds);
  });

  beforeEach(async () => {
    await truncateAll(ds);
    const [u] = await ds.query(
      `INSERT INTO users (email, is_admin) VALUES ('tory@toryteler.co', true) RETURNING id`,
    );
    adminId = u.id;
  });
  afterAll(async () => { await ds.destroy(); });

  it('sin overrides, el mapa está vacío', async () => {
    expect(await content.getOverrides()).toEqual({});
  });

  it('guarda un override y lo devuelve', async () => {
    await content.setOverride('home.empty.body', 'Todavía nada, vuelve pronto.', adminId);
    expect(await content.getOverrides()).toEqual({
      'home.empty.body': 'Todavía nada, vuelve pronto.',
    });
  });

  it('guardar dos veces la misma clave actualiza, no duplica', async () => {
    await content.setOverride('home.empty.body', 'Primero', adminId);
    await content.setOverride('home.empty.body', 'Segundo', adminId);
    expect(await content.getOverrides()).toEqual({ 'home.empty.body': 'Segundo' });
  });

  it('rechaza una clave que no existe', async () => {
    await expect(content.setOverride('no.existe', 'x', adminId)).rejects.toThrow(/UNKNOWN_KEY/);
  });

  it('listForAdmin trae las 43 con hasOverride correcto', async () => {
    await content.setOverride('home.empty.body', 'Cambiado', adminId);
    const list = await content.listForAdmin();
    expect(list).toHaveLength(43);
    const home = list.find((i) => i.key === 'home.empty.body')!;
    expect(home).toEqual({
      key: 'home.empty.body',
      section: 'Home',
      defaultValue: 'Aún no hay nada publicado.',
      currentValue: 'Cambiado',
      hasOverride: true,
    });
    const untouched = list.find((i) => i.key === 'cart.empty.body')!;
    expect(untouched).toEqual({
      key: 'cart.empty.body',
      section: 'Carrito',
      defaultValue: 'No tienes nada en el carrito.',
      currentValue: 'No tienes nada en el carrito.',
      hasOverride: false,
    });
  });

  it('restablecer borra el override', async () => {
    await content.setOverride('home.empty.body', 'Cambiado', adminId);
    await content.resetOverride('home.empty.body');
    expect(await content.getOverrides()).toEqual({});
  });

  it('restablecer algo que nunca se cambió no falla', async () => {
    await expect(content.resetOverride('home.empty.body')).resolves.toBeUndefined();
  });

  it('restablecer una clave que no existe sí falla', async () => {
    await expect(content.resetOverride('no.existe')).rejects.toThrow(/UNKNOWN_KEY/);
  });
});
