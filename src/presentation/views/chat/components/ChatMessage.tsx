import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageModel } from '@/presentation/views/chat/hooks/useChatSession';
import { MarkdownMessage } from './MarkdownMessage';
import { ReasoningPanel } from './ReasoningPanel';
import { ToolCallBadge } from './ToolCallBadge';
import { ModelBadge } from './ModelBadge';

interface ChatMessageProps {
  message: ChatMessageModel;
  /** Whether this turn is currently mid-stream (drives live reasoning open). */
  streaming?: boolean;
  /** Producer-model id for the "by <model>" attribution (assistant turns). */
  userModelId?: string | null;
}

/**
 * Renders one chat turn.
 *
 * - **User** turns: a right-aligned rounded bubble in the primary tint.
 * - **Assistant** turns: full-width markdown, with an optional reasoning panel
 *   above, tool-call badges inline, and a quiet model attribution below.
 * - **Tool / system** turns: minimal muted text (rarely surfaced directly).
 */
export function ChatMessage({ message, streaming, userModelId }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary/10 px-4 py-2.5 text-[15px] leading-relaxed text-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'tool' || message.role === 'system') {
    return (
      <div className="text-[13px] text-muted-foreground">{message.content}</div>
    );
  }

  // Assistant turn.
  return (
    <div className="flex flex-col gap-1.5">
      {message.reasoning && (
        <ReasoningPanel reasoning={message.reasoning} defaultOpen={streaming} />
      )}
      {message.content && <MarkdownMessage content={message.content} />}
      {message.toolCalls?.map((call) => (
        <ToolCallBadge key={call.id} call={call} />
      ))}
      {!streaming && (
        <div className={cn('mt-0.5', !message.content && 'mt-0')}>
          <ModelBadge userModelId={userModelId} />
        </div>
      )}
    </div>
  );
}
