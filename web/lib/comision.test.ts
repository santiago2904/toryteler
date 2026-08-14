import { calcularComision } from './comision';

describe('comisión', () => {
  it('un precio simbólico pierde casi la mitad', () => {
    const c = calcularComision(4000);
    expect(c.recibeCop).toBe(2994);
    expect(c.porcentaje).toBe(25);
  });

  it('desde el precio recomendado la comisión baja a un dígito', () => {
    const c = calcularComision(15000);
    expect(c.porcentaje).toBeLessThanOrEqual(9);
    expect(c.recibeCop).toBe(13702); // 15.000 − (398 + 900)
  });

  it('en una pieza cara el fijo deja de importar', () => {
    expect(calcularComision(2400000).porcentaje).toBe(3);
  });

  it('nunca reporta un neto negativo', () => {
    const c = calcularComision(500);
    expect(c.recibeCop).toBe(0);
  });

  it('un precio de cero no divide por cero', () => {
    expect(calcularComision(0)).toEqual({ comisionCop: 0, recibeCop: 0, porcentaje: 0 });
  });
});
