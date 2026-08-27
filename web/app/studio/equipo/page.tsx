import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { Profile, TeamMember } from '@/lib/types';
import { TeamManager } from '@/components/TeamManager';
import styles from '../studio.module.scss';

export const metadata: Metadata = { title: 'Equipo — Studio' };

/** The list changes the moment someone is added or removed. */
export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const [profile, team] = await Promise.all([
    apiGet<Profile>('/me', true),
    apiGet<TeamMember[]>('/admin/team', true),
  ]);

  return (
    <div className={styles.published}>
      <h1 className="label muted">Equipo</h1>
      <p className="muted">
        Quien está aquí puede abrir el studio: publicar piezas y videos, ver los pedidos y
        despacharlos. Al agregar a alguien le mandamos un enlace de entrada a su correo.
      </p>

      <TeamManager team={team} selfId={profile.id} />
    </div>
  );
}
