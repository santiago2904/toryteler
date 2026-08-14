import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { DropDetail, EntitlementSummary } from '@/lib/types';
import { EphemeralPlayer } from '@/components/EphemeralPlayer';

export const metadata: Metadata = { title: 'Ver — Toryteler' };

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let entitlement: EntitlementSummary;
  try {
    entitlement = await apiGet<EntitlementSummary>(`/me/entitlements/${id}`, true);
  } catch {
    notFound();
  }

  // The window length and the poster belong to the drop, not the entitlement:
  // reading them from there keeps a single source for both.
  const drop = await apiGet<DropDetail>(`/drops/${entitlement.dropSlug}`);

  return (
    <EphemeralPlayer
      entitlementId={entitlement.id}
      title={entitlement.dropTitle}
      posterImage={drop.posterImage}
      windowHours={drop.viewWindowHours}
      // lazy: comes from the session once the API exists.
      viewerEmail="tu@correo.com"
      firstPlayedAt={entitlement.firstPlayedAt}
      expiresAt={entitlement.expiresAt}
    />
  );
}
