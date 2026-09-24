import { useCallback, useState } from 'react';

/** useState persistido no localStorage (preferências de interface). */
export default function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initialValue : JSON.parse(stored);
    } catch {
      return initialValue;
    }
  });

  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* armazenamento indisponível: mantém só em memória */
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update];
}
