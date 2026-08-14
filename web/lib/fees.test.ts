import { calculateFees } from './fees';

describe('fees', () => {
  it('a token price loses almost half', () => {
    const f = calculateFees(4000);
    expect(f.payoutCop).toBe(2994);
    expect(f.percentage).toBe(25);
  });

  it('at the suggested price the fee drops to single digits', () => {
    const f = calculateFees(15000);
    expect(f.percentage).toBeLessThanOrEqual(9);
    expect(f.payoutCop).toBe(13702); // 15,000 − (398 + 900)
  });

  it('on an expensive piece the flat fee stops mattering', () => {
    expect(calculateFees(2400000).percentage).toBe(3);
  });

  it('never reports a negative payout', () => {
    expect(calculateFees(500).payoutCop).toBe(0);
  });

  it('a zero price does not divide by zero', () => {
    expect(calculateFees(0)).toEqual({ feeCop: 0, payoutCop: 0, percentage: 0 });
  });
});
