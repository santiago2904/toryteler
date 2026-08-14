import { formatPrice, formatDate, timeLeft } from './format';

describe('format', () => {
  it('formats pesos without decimals and with thousand separators', () => {
    expect(formatPrice(500000)).toBe('$500.000 COP');
    expect(formatPrice(4000)).toBe('$4.000 COP');
  });

  it('formats dates in Spanish, uppercase', () => {
    expect(formatDate('2026-08-13T15:04:00Z')).toBe('13 AGO 2026');
  });

  describe('timeLeft', () => {
    // The clock is pinned: building the date and asserting on it takes a few
    // milliseconds, and without this the minute rounds down and the test fails
    // at random.
    const NOW = new Date('2026-08-14T12:00:00Z').getTime();
    beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
    afterEach(() => jest.restoreAllMocks());

    it('describes remaining time in hours and minutes', () => {
      expect(timeLeft(new Date(NOW + 2 * 3600_000 + 30 * 60_000).toISOString())).toBe('2 h 30 min');
    });

    it('drops the hours when under one', () => {
      expect(timeLeft(new Date(NOW + 45 * 60_000).toISOString())).toBe('45 min');
    });

    it('reports expired once the moment has passed', () => {
      expect(timeLeft(new Date(NOW - 1000).toISOString())).toBe('vencido');
    });
  });
});
