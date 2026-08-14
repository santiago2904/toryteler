'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '@/lib/checkout-actions';

/**
 * Leaves the session. Needed for something as ordinary as checking how the shop
 * looks to somebody else, which until now meant deleting a cookie by hand.
 */
export function SignOutButton() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  return (
    <button
      type="button"
      className="link-button"
      disabled={leaving}
      onClick={async () => {
        setLeaving(true);
        await signOut();
        // Home rather than the sign-in screen: leaving is not the start of
        // coming back.
        router.push('/');
        router.refresh();
      }}
    >
      {leaving ? 'Saliendo…' : 'Salir'}
    </button>
  );
}
