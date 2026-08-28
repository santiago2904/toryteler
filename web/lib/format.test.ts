import { formatPrice, formatDate, timeLeft, caretAfterFormat } from './format';

describe('format', () => {
  it('formats dollars with cents and a thousands separator', () => {
    expect(formatPrice(2500)).toBe('$25.00 USD');
    expect(formatPrice(400)).toBe('$4.00 USD');
    expect(formatPrice(1234567)).toBe('$12,345.67 USD');
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
  describe('caretAfterFormat', () => {
    it('keeps the caret at the end when nothing follows it', () => {
      expect(caretAfterFormat('2.400.000', 0)).toBe(9);
    });

    it('counts digits, not characters, so separators do not drag it', () => {
      // 2.400.00|0 → one digit to the right
      expect(caretAfterFormat('2.400.000', 1)).toBe(8);
      // 2.4|00.000 → five digits to the right
      expect(caretAfterFormat('2.400.000', 5)).toBe(3);
    });

    it('stops at the start when asked for more digits than there are', () => {
      expect(caretAfterFormat('2.400', 99)).toBe(0);
    });

    it('handles an empty value', () => {
      expect(caretAfterFormat('', 3)).toBe(0);
    });
  });
});
