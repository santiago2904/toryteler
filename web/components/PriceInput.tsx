'use client';

import { caretAfterFormat } from '@/lib/format';
import styles from './PriceInput.module.scss';

const DOLLARS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Amount in pesos, formatted as it is typed: 2400000 reads as 2.400.000.
 *
 * It cannot be <input type="number">, which refuses any character that is not
 * a digit and therefore cannot show separators. Type text plus inputMode
 * numeric gives the numeric keypad on phones all the same.
 *
 * The caret is the subtle part: reformatting rewrites the whole value and the
 * browser drops the caret at the end, so correcting a digit in the middle is
 * impossible. Counting the digits to the right of the caret survives the
 * separators moving around.
 */
export function PriceInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const shown = value > 0 ? `$${DOLLARS.format(value / 100)}` : '';

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const caret = input.selectionStart ?? input.value.length;
    const digitsAfterCaret = input.value.slice(caret).replace(/\D/g, '').length;

    const digits = input.value.replace(/\D/g, '').slice(0, 12); // no absurd amounts
    const next = digits ? Number.parseInt(digits, 10) : 0;
    onChange(next);

    // After React repaints, walk back from the end until the same number of
    // digits is to the right again.
    requestAnimationFrame(() => {
      const text = next > 0 ? `$${DOLLARS.format(next / 100)}` : '';
      const position = caretAfterFormat(text, digitsAfterCaret);
      input.setSelectionRange(position, position);
    });
  }

  return (
    <div className={styles.field}>
      <span className={styles.symbol} aria-hidden="true">$</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        onChange={handleChange}
        placeholder="0"
        className={styles.input}
      />
      <span className={styles.currency} aria-hidden="true">USD</span>
    </div>
  );
}
