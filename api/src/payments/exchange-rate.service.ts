import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * Cuántos pesos vale un dólar, según la TRM oficial de Banco de la
 * República (datos.gov.co, sin llave). Se pide una vez al crear un pedido
 * — nunca se recalcula después, así un pedido ya creado no cambia de
 * precio a mitad de camino.
 *
 * lazy: caché en memoria de proceso — basta con una instancia de Railway.
 * Si el día que haya más de una esto reaparece como inconsistencia, mover
 * a un valor compartido (Postgres o similar).
 */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private cached: { copPerUsd: number; fetchedAt: number } | null = null;
  private readonly TTL_MS = 24 * 3_600_000; // la TRM se publica un día hábil por día

  async copPerUsd(): Promise<number> {
    if (this.cached && Date.now() - this.cached.fetchedAt < this.TTL_MS) {
      return this.cached.copPerUsd;
    }

    try {
      const res = await fetch(
        'https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1',
      );
      if (!res.ok) throw new Error(`TRM_QUERY_FAILED_${res.status}`);

      const [row] = (await res.json()) as { valor?: string }[];
      const rate = Number.parseFloat(row?.valor ?? '');
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('TRM_MALFORMED_RESPONSE');

      this.cached = { copPerUsd: rate, fetchedAt: Date.now() };
      return rate;
    } catch (error) {
      this.logger.warn(`No se pudo obtener la TRM: ${error}`);
      // Una TRM de ayer sigue siendo una tasa real; inventar una no lo es.
      if (this.cached) return this.cached.copPerUsd;
      throw new ServiceUnavailableException('EXCHANGE_RATE_UNAVAILABLE');
    }
  }
}
