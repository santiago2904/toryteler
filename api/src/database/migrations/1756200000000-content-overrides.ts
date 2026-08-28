import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Los textos editoriales que el artista puede cambiar desde /studio sin
 * tocar código. Solo existe una fila por clave que en efecto se cambió —
 * el texto original vive en el código (CONTENT_KEYS), no aquí, así que no
 * hace falta sembrar nada al lanzar esta función.
 */
export class ContentOverrides1756200000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE content_overrides (
        key varchar PRIMARY KEY,
        value text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NOT NULL REFERENCES users(id)
      )
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE content_overrides`);
  }
}
