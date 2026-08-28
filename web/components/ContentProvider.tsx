'use client';

import { createContext, useContext } from 'react';

const ContentContext = createContext<Record<string, string>>({});

/**
 * Monta una sola vez, en RootLayout, con el mapa completo de overrides ya
 * resuelto en el servidor. Los Client Components que muestran uno de los
 * 43 textos editoriales lo leen con useContent en vez de llamar
 * content() (que es async y no se puede await dentro de un componente
 * cliente).
 */
export function ContentProvider(
  { overrides, children }: { overrides: Record<string, string>; children: React.ReactNode },
) {
  return <ContentContext.Provider value={overrides}>{children}</ContentContext.Provider>;
}

export function useContent(key: string, fallback: string): string {
  const overrides = useContext(ContentContext);
  return overrides[key] ?? fallback;
}
