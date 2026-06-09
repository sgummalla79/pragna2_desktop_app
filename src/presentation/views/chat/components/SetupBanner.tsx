import { Link } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { ERRORS } from '@/constants/errors';

/**
 * Inline notice shown in the composer when the user has no chat-eligible model.
 * Links to the Providers settings page so they can connect a provider and
 * enable a chat model. The composer disables sending while this shows.
 */
export function SetupBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
      <Settings2 size={15} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{ERRORS.CHT_007.message}</span>
      <Link
        to={ROUTES.SETTINGS_PROVIDERS}
        className="shrink-0 font-medium text-primary underline underline-offset-2 hover:opacity-80"
      >
        Set up
      </Link>
    </div>
  );
}
