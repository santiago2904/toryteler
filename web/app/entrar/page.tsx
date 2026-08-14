'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { requestMagicLink } from '@/lib/checkout-actions';
import styles from './page.module.scss';

function SignIn() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/cuenta';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(
    // Set by /auth/verify when a link is expired or already used.
    params.get('error') ? 'Ese enlace ya se usó o venció. Pide otro.' : null,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);

    const result = await requestMagicLink(email.trim(), next);
    setSending(false);
    if (result.ok) setSent(true);
    else setError(result.error);
  }

  if (sent) {
    return (
      <div className={styles.entrar}>
        <h1 className="label muted">Revisa tu correo</h1>
        <p>
          Te enviamos un enlace a <strong>{email}</strong>. Ábrelo desde este mismo
          dispositivo y sigues donde ibas.
        </p>
        <p className="muted">El enlace vence en 15 minutos.</p>
        <button type="button" className="link-button" onClick={() => setSent(false)}>
          Usar otro correo
        </button>
      </div>
    );
  }

  return (
    <div className={styles.entrar}>
      <h1 className="label muted">Entrar</h1>
      <p>
        No hay contraseñas. Escribe tu correo y te mandamos un enlace para entrar.
      </p>

      <form onSubmit={submit} className={styles.form}>
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
        />

        {error && <p role="alert" className={styles.error}>{error}</p>}

        <button type="submit" disabled={sending || email.trim().length === 0}>
          {sending ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>
    </div>
  );
}

export default function SignInPage() {
  // useSearchParams needs a boundary, or the whole route opts out of static
  // rendering.
  return (
    <Suspense fallback={<div className={styles.entrar} />}>
      <SignIn />
    </Suspense>
  );
}
