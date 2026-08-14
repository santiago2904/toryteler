import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { DropDetail } from '@/lib/types';
import { VideoForm } from '@/components/VideoForm';

export const metadata: Metadata = { title: 'Editar video — Studio' };

export default async function EditVideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let video: DropDetail;
  try {
    video = await apiGet<DropDetail>(`/drops/${slug}`);
  } catch {
    notFound();
  }
  return <VideoForm video={video} />;
}
