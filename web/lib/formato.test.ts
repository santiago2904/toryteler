import { formatearPrecio, formatearFecha, tiempoRestante } from './formato';

describe('formato', () => {
  it('formatea pesos sin decimales y con separador de miles', () => {
    expect(formatearPrecio(500000)).toBe('$500.000 COP');
    expect(formatearPrecio(4000)).toBe('$4.000 COP');
  });

  it('formatea la fecha en español y en mayúsculas', () => {
    expect(formatearFecha('2026-08-13T15:04:00Z')).toBe('13 AGO 2026');
  });

  it('describe el tiempo restante en horas y minutos', () => {
    const enDosHoras = new Date(Date.now() + 2 * 3600_000 + 30 * 60_000).toISOString();
    expect(tiempoRestante(enDosHoras)).toBe('2 h 30 min');
  });

  it('reporta vencido cuando ya pasó', () => {
    expect(tiempoRestante(new Date(Date.now() - 1000).toISOString())).toBe('vencido');
  });
});
