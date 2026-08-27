'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addAdmin, removeAdmin } from '@/lib/studio-actions';
import { TeamMember } from '@/lib/types';
import styles from '@/app/studio/studio.module.scss';

export function TeamManager({ team, selfId }: { team: TeamMember[]; selfId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [working, setWorking] = useState<string | null>(null); // 'add' or a member id
  const [error, setError] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setWorking('add');
    setError(null);

    const result = await addAdmin(email.trim());
    setWorking(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEmail('');
    router.refresh();
  }

  async function remove(id: string) {
    setWorking(id);
    setError(null);

    const result = await removeAdmin(id);
    setWorking(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.listGroup}>
      <form onSubmit={add} className={styles.shipping}>
        <label htmlFor="team-email">Correo</label>
        <input
          id="team-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          required
        />
        <button type="submit" disabled={working === 'add' || email.trim().length === 0}>
          {working === 'add' ? 'Agregando…' : 'Dar acceso'}
        </button>
      </form>

      {error && <p role="alert" className={styles.error}>{error}</p>}

      <ul>
        {team.map((member) => (
          <li key={member.id} className={styles.team}>
            <span className="label">{member.email}</span>
            {member.id === selfId ? (
              <span className="muted label">Eres tú</span>
            ) : (
              <button
                type="button"
                className="link-button"
                onClick={() => remove(member.id)}
                disabled={working === member.id}
              >
                {working === member.id ? 'Quitando…' : 'Quitar acceso'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
