'use client';

import { useState } from 'react';
import { resetContent, updateContent } from '@/lib/studio-actions';
import { ContentItem } from '@/lib/types';
import styles from '@/app/studio/studio.module.scss';

export function ContentEditor({ items }: { items: ContentItem[] }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.key, i.currentValue])),
  );
  const [saved, setSaved] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.key, i.currentValue])),
  );
  const [overridden, setOverridden] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((i) => [i.key, i.hasOverride])),
  );
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bySection = items.reduce<Record<string, ContentItem[]>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});

  async function save(key: string) {
    setWorking(key);
    setError(null);

    const result = await updateContent(key, values[key]);
    setWorking(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved((s) => ({ ...s, [key]: values[key] }));
    setOverridden((o) => ({ ...o, [key]: true }));
  }

  async function reset(key: string, defaultValue: string) {
    setWorking(key);
    setError(null);

    const result = await resetContent(key);
    setWorking(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setValues((v) => ({ ...v, [key]: defaultValue }));
    setSaved((s) => ({ ...s, [key]: defaultValue }));
    setOverridden((o) => ({ ...o, [key]: false }));
  }

  return (
    <div className={styles.listGroup}>
      {error && <p role="alert" className={styles.error}>{error}</p>}

      {Object.entries(bySection).map(([section, sectionItems]) => (
        <fieldset key={section} className={styles.group}>
          <legend>{section}</legend>
          <div className={styles.contentSection}>
            {sectionItems.map((item) => (
              <div key={item.key} className={styles.contentItem}>
                <label htmlFor={item.key} className="label muted">{item.key}</label>
                <textarea
                  id={item.key}
                  value={values[item.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [item.key]: e.target.value }))}
                />
                <div className={styles.contentActions}>
                  <button
                    type="button"
                    onClick={() => save(item.key)}
                    disabled={working === item.key || values[item.key] === saved[item.key]}
                  >
                    {working === item.key ? 'Guardando…' : 'Guardar'}
                  </button>
                  {overridden[item.key] && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => reset(item.key, item.defaultValue)}
                      disabled={working === item.key}
                    >
                      Restablecer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
