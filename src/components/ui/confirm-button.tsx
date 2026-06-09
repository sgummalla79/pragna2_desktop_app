import { useState, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Button } from '@/components/ui/button';

type ConfirmButtonProps = Omit<React.ComponentProps<typeof Button>, 'onClick'> & {
  /** Title rendered in the confirmation dialog. */
  confirmTitle: string;
  /** Body text below the title. Plain string or any node. */
  confirmDescription?: ReactNode;
  /** Label for the destructive confirm action. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel action. Defaults to "Cancel". */
  cancelLabel?: string;
  /**
   * Called when the user confirms. Errors propagate to the caller — this
   * wrapper only handles the open/close lifecycle.
   */
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
};

/**
 * Drop-in replacement for `<Button>` that gates the click behind a
 * confirmation dialog. Use for any destructive action.
 */
export function ConfirmButton({
  confirmTitle,
  confirmDescription,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  children,
  variant = 'destructive',
  ...buttonProps
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant={variant} {...buttonProps}>
          {children}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[700] bg-foreground/40 backdrop-blur-sm" />
        <Dialog.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-[701] -translate-x-1/2 -translate-y-1/2 w-[420px] max-w-[calc(100vw-32px)] flex flex-col gap-4 rounded-lg border border-border bg-popover p-6 shadow-2xl"
        >
          <div className="flex flex-col gap-1.5">
            <Dialog.Title className="text-base font-bold text-foreground m-0">
              {confirmTitle}
            </Dialog.Title>
            {confirmDescription && (
              <Dialog.Description className="text-sm text-foreground m-0 leading-relaxed">
                {confirmDescription}
              </Dialog.Description>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" disabled={busy}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              variant={variant}
              size="sm"
              onClick={handleConfirm}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? `${confirmLabel}…` : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
