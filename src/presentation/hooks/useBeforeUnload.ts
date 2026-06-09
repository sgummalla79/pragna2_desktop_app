import { useEffect } from 'react';

/**
 * Show the browser's native "Changes you made may not be saved" prompt
 * on tab close / refresh / out-of-app navigation when `when` is true.
 *
 * The custom message arg is intentionally not exposed — every modern
 * browser ignores it and shows its own generic copy. The hook's only
 * job is to gate whether the prompt fires.
 *
 * @param when truthy to arm the listener, falsy to detach
 */
export function useBeforeUnload(when: boolean): void {
  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers require returnValue to be set to ANY non-empty
      // string before they will surface the prompt. The string itself
      // is never shown to the user.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);
}
