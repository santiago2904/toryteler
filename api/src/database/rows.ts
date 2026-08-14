/**
 * TypeORM 1.x returns different shapes depending on the statement:
 *
 *   SELECT …                     → [{…}, {…}]
 *   UPDATE … / DELETE …          → [[], 1]           rows and affected count
 *   UPDATE … RETURNING stock     → [[{…}], 1]
 *   INSERT … ON CONFLICT         → []                reports nothing at all
 *   INSERT … RETURNING key       → [[{…}], 1]
 *
 * That fourth line is the trap: an INSERT without RETURNING gives no way to
 * tell an insert from a conflict. **Always add RETURNING to an INSERT whose
 * outcome you need to branch on.**
 *
 * Reading `.length` on the second shape gives 2 regardless of whether anything
 * was updated, which silently turns "nobody got the unit" into "someone did".
 * Every conditional update in this codebase depends on that count being right,
 * so it goes through here instead of being unpacked at each call site.
 */

type QueryResult = unknown;

function isTuple(result: QueryResult): result is [unknown[], number] {
  return (
    Array.isArray(result) &&
    result.length === 2 &&
    Array.isArray(result[0]) &&
    typeof result[1] === 'number'
  );
}

/** How many rows the statement actually touched. */
export function affectedRows(result: QueryResult): number {
  if (isTuple(result)) return result[1];
  return Array.isArray(result) ? result.length : 0;
}

/** The returned rows, whichever shape they arrived in. */
export function returnedRows<T = Record<string, unknown>>(result: QueryResult): T[] {
  if (isTuple(result)) return result[0] as T[];
  return Array.isArray(result) ? (result as T[]) : [];
}

/** First returned row, or null. */
export function firstRow<T = Record<string, unknown>>(result: QueryResult): T | null {
  return returnedRows<T>(result)[0] ?? null;
}
