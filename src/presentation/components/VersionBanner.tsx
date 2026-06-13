import { AlertTriangle, X } from 'lucide-react';
import { CLIENT_VERSION } from '@/constants/version';
import { useVersionStore } from '@/presentation/store/versionStore';

/**
 * Non-blocking "update" banner shown when the client and API are on
 * incompatible MAJOR.MINOR lines. Dismissible. Renders nothing when compatible,
 * not-yet-checked, or the API was unreachable — a failed check never blocks or
 * nags the user (Phase 2 is warn-only; see the version-compatibility spec).
 */
export function VersionBanner() {
  const status = useVersionStore((s) => s.status);
  const serverVersion = useVersionStore((s) => s.serverVersion);
  const dismissed = useVersionStore((s) => s.dismissed);
  const dismiss = useVersionStore((s) => s.dismiss);

  if (dismissed) return null;
  if (status !== 'server_outdated' && status !== 'client_outdated') return null;

  const message =
    status === 'client_outdated'
      ? `This app (v${CLIENT_VERSION}) is out of date and may stop working with the server. Please update to the latest version.`
      : `The server${serverVersion ? ` (v${serverVersion})` : ''} is older than this app expects. Some features may not work until it is updated.`;

  return (
    <div role="alert" className="w-full border-b border-amber-500/40 bg-amber-500/15">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-sm text-amber-200">
        <AlertTriangle size={16} className="shrink-0" />
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded p-1 transition-colors hover:bg-amber-500/20"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
