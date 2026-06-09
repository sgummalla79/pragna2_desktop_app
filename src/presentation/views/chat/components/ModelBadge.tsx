import { useMemo } from 'react';
import { useModels } from '@/presentation/hooks/models/useModels';

interface Props {
  /** The user_model id stamped on the assistant message (BE R4 #0).
   *  `null` / `undefined` renders nothing. */
  userModelId: string | null | undefined;
}

/**
 * Quiet "by Claude Sonnet 4.6" attribution under assistant turns.
 *
 * Looks up the model in the already-warm `useModels` cache (the picker shares
 * it), so this adds zero round-trips. When the id doesn't resolve (model later
 * archived, historical NULL id, cache miss), renders nothing — better empty
 * than wrong. Styling is intentionally muted (metadata, not content).
 */
export function ModelBadge({ userModelId }: Props) {
  const { data: models } = useModels();

  const displayName = useMemo(() => {
    if (!userModelId || !models) return null;
    return models.find((m) => m.id === userModelId)?.displayName ?? null;
  }, [models, userModelId]);

  if (!displayName) return null;

  return (
    <span className="text-[11px] text-muted-foreground select-none">by {displayName}</span>
  );
}
