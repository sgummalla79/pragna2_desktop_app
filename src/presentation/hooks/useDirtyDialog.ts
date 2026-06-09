import { useCallback } from 'react';
import { useBeforeUnload } from './useBeforeUnload';

/**
 * Props to spread onto a `<Dialog.Content>` to harden it against
 * accidental dismissal when the form inside is dirty.
 *
 * Both callbacks call `preventDefault()` when `dirty=true`, which Radix
 * interprets as "consume the event, do not transition the dialog to
 * closed." Labelled close affordances inside the dialog
 * (`<Dialog.Close>` X button, Cancel button, in-page Back link) are
 * unaffected — they fire `onOpenChange(false)` directly and are
 * considered intentional dismissals by design.
 */
export interface DirtyDialogContentProps {
  onEscapeKeyDown: (event: KeyboardEvent) => void;
  onPointerDownOutside: (event: { preventDefault: () => void }) => void;
}

export interface DirtyDialogResult {
  /** Spread onto `<Dialog.Content>`. */
  contentProps: DirtyDialogContentProps;
}

/**
 * Hardens a Radix Dialog against accidental dismissal when the wrapped
 * form is dirty, and arms the browser's `beforeunload` prompt for
 * tab close / refresh.
 *
 * Pattern at the call site:
 *
 *     const guard = useDirtyDialog(isFormDirty);
 *     <Dialog.Root open={open} onOpenChange={onClose}>
 *       <Dialog.Content {...guard.contentProps}>...
 *
 * Blocks: Escape key, overlay click, browser tab close / refresh.
 * Does NOT block: explicit close buttons rendered inside the dialog,
 * in-app `navigate()` / `<Link>` clicks (those bypass Radix entirely —
 * but the dialog's overlay physically prevents reaching such links
 * inside the chrome behind it).
 *
 * The "no confirm dialog" stance is deliberate: hardening eliminates
 * accidental dismissal, and labelled buttons are trusted intentional
 * actions. If misclicks on labelled buttons become a real reported
 * problem, add a confirm there — do not weaken the hardening.
 */
export function useDirtyDialog(dirty: boolean): DirtyDialogResult {
  useBeforeUnload(dirty);

  const onEscapeKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (dirty) event.preventDefault();
    },
    [dirty],
  );

  const onPointerDownOutside = useCallback(
    (event: { preventDefault: () => void }) => {
      if (dirty) event.preventDefault();
    },
    [dirty],
  );

  return { contentProps: { onEscapeKeyDown, onPointerDownOutside } };
}
