import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import PragnaLogo from '@brand/logo.svg?react';
import { ROUTES } from '@/constants/routes';
import { APP_NAME } from '@/constants/api';
import { useServices } from '@/presentation/providers/ServiceContext';
import { useDefaultAgent } from '@/presentation/hooks/agents/useAgents';
import { usePragnaSlashFlows } from '@/presentation/hooks/flows/usePragnaSlashFlows';
import { logger } from '@/infrastructure/logging/logger';
import { ChatInput } from './components/ChatInput';
import { ModelPicker } from './components/ModelPicker';
import { ThinkingToggle } from './components/ThinkingToggle';
import { SetupBanner } from './components/SetupBanner';
import { useChatModels } from './hooks/useChatModels';
import { useGreeting } from './hooks/useGreeting';
import { writePendingInitialMessage } from './hooks/initialMessageHandoff';

/**
 * Landing surface for `/chat` — shown when no conversation is open.
 *
 * A personalised greeting over a centered composer. On send: eager-create the
 * conversation (with the landing's model + thinking choices), invalidate the
 * sidebar list, stash the message under the new id, and navigate to
 * `/chat/{id}` where {@link ChatSessionView} consumes it and fires the first
 * turn. Chat is gated on having a chat-eligible model AND a default agent; the
 * composer shows an inline banner and disables sending until both exist.
 */
export default function ChatLandingView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const greeting = useGreeting();
  const { conversationService } = useServices();
  const { chatModels, isLoading: modelsLoading } = useChatModels();
  const { data: defaultAgent, isLoading: agentLoading } = useDefaultAgent();
  // Primes the `['pragna','flows']` cache so the session view's first-turn slash
  // dispatch sees the names synchronously on mount; also drives the popover here.
  const { data: slashFlows } = usePragnaSlashFlows();

  const [draft, setDraft] = useState('');
  const [userModelId, setUserModelId] = useState<string | null>(null);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // A fresh conversation id, generated once per landing mount.
  const pendingConvId = useMemo(() => crypto.randomUUID(), []);

  const hasChatModel = chatModels.length > 0;
  const hasDefaultAgent = defaultAgent != null;
  const ready = hasChatModel && hasDefaultAgent;
  const gating = !modelsLoading && !agentLoading && !ready;

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || creating || !ready) return;
    setSendError(null);
    setCreating(true);
    try {
      // Eager-create the row BEFORE navigation so the session view's
      // conversation-scoped queries don't 404 during the handoff. Idempotent.
      await conversationService.create({
        threadId: pendingConvId,
        userModelId: userModelId ?? null,
        thinkingEnabled,
      });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      writePendingInitialMessage(pendingConvId, {
        text,
        userModelId: userModelId ?? undefined,
        thinkingEnabled,
      });
      navigate(`${ROUTES.CHAT}/${pendingConvId}`);
    } catch (err) {
      // Loud failure: stay on the landing so the user can retry without losing
      // their text (ChatInput still holds it). Prefer the backend detail.
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? (err instanceof Error ? err.message : 'Failed to start chat.');
      setSendError(String(detail));
      logger.fromError('CHT_002:create', err);
      setCreating(false);
    }
  }, [
    draft,
    creating,
    ready,
    conversationService,
    pendingConvId,
    userModelId,
    thinkingEnabled,
    queryClient,
    navigate,
  ]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-6 flex select-none items-center gap-4">
          {/* Logo before the greeting, on the same row. Fixed 70px tall; width
              follows the aspect ratio (square Pragna star, wide Salesforce mark). */}
          <PragnaLogo className="h-[70px] w-auto shrink-0 text-foreground" aria-hidden="true" />
          <h1 className="m-0 text-[28px] font-semibold leading-none text-foreground sm:text-[36px]">
            {greeting}
          </h1>
        </div>

        <div className="mx-auto w-full max-w-2xl">
          <ChatInput
            value={draft}
            onChange={setDraft}
            onSubmit={handleSend}
            disabled={!ready || creating}
            autoFocus
            slashFlows={slashFlows}
            // Enable attachments on the landing: pass the pre-generated id so the
            // paperclip shows and uploads target the conversation that `handleSend`
            // eager-creates with this same id (the BE lazy-creates on upload too).
            conversationId={pendingConvId}
            placeholder={
              ready ? `Ask ${APP_NAME} anything…` : 'Connect a model to start chatting…'
            }
            banner={
              gating ? (
                <SetupBanner />
              ) : sendError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                  Could not start chat: {sendError}. Press send to retry.
                </div>
              ) : undefined
            }
            controls={
              ready ? (
                <>
                  <ModelPicker userModelId={userModelId} onModelChange={setUserModelId} />
                  <ThinkingToggle enabled={thinkingEnabled} onChange={setThinkingEnabled} />
                </>
              ) : null
            }
          />
        </div>
      </div>
    </div>
  );
}
