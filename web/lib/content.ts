/**
 * Los textos editoriales que el artista puede cambiar desde /studio. Sin
 * API_URL (modo maqueta) o si la API falla, siempre cae al texto que ya
 * vive en el código — el contenido es decorativo, nunca debe tronar una
 * página.
 */

export async function getOverrides(): Promise<Record<string, string>> {
  const base = process.env.API_URL;
  if (!base) return {};
  try {
    const res = await fetch(`${base}/content`, { next: { tags: ['content'] } });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function content(key: string, fallback: string): Promise<string> {
  const overrides = await getOverrides();
  return overrides[key] ?? fallback;
}
