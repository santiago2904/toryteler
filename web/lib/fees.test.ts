import { calculateFees } from './fees';

describe('fees', () => {
  it('a very cheap price loses a third to the flat fee', () => {
    const f = calculateFees(100); // $1.00
    expect(f.payoutUsdCents).toBe(67);
    expect(f.percentage).toBe(33);
  });

  it('at the suggested price the fee drops to single digits', () => {
    const f = calculateFees(500); // $5.00
    expect(f.percentage).toBeLessThanOrEqual(9);
    expect(f.payoutUsdCents).toBe(457);
  });

  it('on an expensive piece the flat fee stops mattering', () => {
    expect(calculateFees(25000).percentage).toBe(3); // $250.00
  });

  it('never reports a negative payout', () => {
    expect(calculateFees(10).payoutUsdCents).toBe(0);
  });

  it('a zero price does not divide by zero', () => {
    expect(calculateFees(0)).toEqual({ feeUsdCents: 0, payoutUsdCents: 0, percentage: 0 });
  });
});
