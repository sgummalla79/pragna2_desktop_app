import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useChatModels } from '../hooks/useChatModels';

interface ModelPickerProps {
  /** Active user_model id, or `null` when not yet pinned to a model. */
  userModelId: string | null;
  /** Parent owns persistence (PATCH conversation, or landing draft state). */
  onModelChange: (userModelId: string) => void;
}

/**
 * Inline chat-composer model picker, built on the shadcn `Select`.
 *
 * Lists every chat-eligible model (see {@link useChatModels}); the active one
 * is shown in the trigger. Renders nothing while loading or when there are no
 * chat-eligible models (the composer's setup banner covers that case). When the
 * pinned id isn't eligible anymore, it soft-defaults to the first option so the
 * trigger label is never blank.
 */
export function ModelPicker({ userModelId, onModelChange }: ModelPickerProps) {
  const { chatModels, isLoading } = useChatModels();
  if (isLoading || chatModels.length === 0) return null;

  const activeId =
    userModelId && chatModels.some((m) => m.id === userModelId)
      ? userModelId
      : chatModels[0].id;

  return (
    <Select value={activeId} onValueChange={onModelChange}>
      <SelectTrigger
        size="sm"
        aria-label="Switch model"
        // Fully blend into the composer: no border + no fill (the shadcn
        // SelectTrigger base adds `border border-input` AND a dark-mode
        // `dark:bg-input/30` fill — both overridden here via twMerge). Just a
        // subtle hover, matching the web app's borderless model pill.
        className="rounded-full border-transparent bg-transparent text-[12px] font-medium text-muted-foreground hover:bg-accent dark:bg-transparent dark:hover:bg-accent"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {chatModels.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
