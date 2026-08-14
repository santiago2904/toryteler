import type { Metadata } from 'next';
import { VideoForm } from '@/components/VideoForm';

export const metadata: Metadata = { title: 'Nuevo video — Studio' };

export default function NewVideoPage() {
  return <VideoForm />;
}
