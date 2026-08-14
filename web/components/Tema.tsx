'use client';

/**
 * Alterna entre claro y oscuro y recuerda la elección.
 *
 * El botón dice siempre «Tema» en vez del estado actual: leer el tema en el
 * primer render exigiría tocar localStorage antes de hidratar, y eso produce
 * o un desajuste de hidratación o un parpadeo de texto. La etiqueta accesible
 * sí explica qué hace.
 */
export function Tema() {
  function alternar() {
    const raiz = document.documentElement;
    const oscuroAhora =
      raiz.dataset.tema === 'oscuro' ||
      (!raiz.dataset.tema && matchMedia('(prefers-color-scheme: dark)').matches);

    const siguiente = oscuroAhora ? 'claro' : 'oscuro';
    raiz.dataset.tema = siguiente;
    try {
      localStorage.setItem('tema', siguiente);
    } catch {
      // Modo privado o almacenamiento bloqueado: el tema dura la sesión y ya.
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className="enlace"
      aria-label="Cambiar entre tema claro y oscuro"
    >
      Tema
    </button>
  );
}
