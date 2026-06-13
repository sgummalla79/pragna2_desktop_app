import { AlertTriangle } from 'lucide-react';
import { CLIENT_VERSION } from '@/constants/version';
import { useVersionStore } from '@/presentation/store/versionStore';

/**
 * Full-screen, non-dismissible "update required" block shown when the API has
 * rejected this client with 426 Upgrade Required (Phase 3 enforcement). Renders
 * nothing until that happens, so it is dormant while the API still serves this
 * client. See pragna2-api/docs/architecture/version-compatibility.md.
 */
export function UpdateRequiredScreen() {
  const blocked = useVersionStore((s) => s.blocked);
  const message = useVersionStore((s) => s.blockMessage);

  if (!blocked) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-required-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/95 p-6"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-popover p-6 text-center shadow-2xl">
        <AlertTriangle className="mx-auto mb-4 text-amber-500" size={40} aria-hidden="true" />
        <h1 id="update-required-title" className="mb-2 text-lg font-semibold text-foreground">
          Update required
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {message ?? 'A newer version of this app is required to continue.'}
        </p>
        <p className="text-xs text-muted-foreground">Current version: v{CLIENT_VERSION}</p>
      </div>
    </div>
  );
}
