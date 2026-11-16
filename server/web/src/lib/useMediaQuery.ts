import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query. Returns `false` during SSR and in
 * environments without matchMedia (e.g. some test runners).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mql = window.matchMedia(query);
    const handleChange = () => setMatches(mql.matches);

    handleChange();
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}
