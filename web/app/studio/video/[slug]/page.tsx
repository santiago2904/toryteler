import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { AdminDropDetail } from '@/lib/types';
import { VideoForm } from '@/components/VideoForm';

export const metadata: Metadata = { title: 'Editar video — Studio' };

/** Always fresh: this is the form that just saved. */
export const dynamic = 'force-dynamic';

export default async function EditVideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let video: AdminDropDetail;
  try {
    // The admin endpoint, so a draft can be edited at all.
    video = await apiGet<AdminDropDetail>(`/admin/drops/${slug}`, true);
  } catch {
    notFound();
  }
  return <VideoForm video={video} />;
}
