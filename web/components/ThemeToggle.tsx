'use client';

/**
 * Toggles between light and dark, and remembers the choice.
 *
 * The button always reads "Tema" instead of the current state: reading the
 * theme on first render would mean touching localStorage before hydration,
 * which produces either a hydration mismatch or a flash of changing text. The
 * accessible label does explain what it does.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const isDark =
      root.dataset.theme === 'dark' ||
      (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);

    const next = isDark ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private mode or storage blocked: the theme lasts for the session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="link-button"
      aria-label="Cambiar entre tema claro y oscuro"
    >
      Tema
    </button>
  );
}
