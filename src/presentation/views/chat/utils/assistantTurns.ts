import { DOCUMENT_TOOL_NAMES } from '@/constants/documentTools';
import { PROPOSE_FLOW_PREFIX } from '@/constants/chat';
import type {
  ChatMessage as ChatMessageModel,
  ChatToolCall,
} from '../hooks/useChatSession';

/**
 * Turn-grouping for the chat transcript.
 *
 * A single agent turn can stream as several assistant messages (interim
 * narration, tool calls, then a final answer) plus suppressed tool-result
 * messages. The transcript should show all of that intermediate work folded
 * into ONE collapsible "activity" umbrella, with only the final answer (and any
 * outputs/interactive cards) left in the conversation. These pure helpers
 * compute that structure; {@link AssistantTurn} renders it.
 */

/** A standalone user/system message, or a run of assistant messages (a turn). */
export type RenderGroup =
  | { kind: 'message'; message: ChatMessageModel }
  | { kind: 'assistant-turn'; messages: ChatMessageModel[] };

/**
 * Segment the flat message list into render groups. Consecutive assistant
 * messages collapse into one `assistant-turn`; user/system messages are
 * standalone. Tool-role messages are dropped — their raw result payload is
 * represented by the turn's activity umbrella, never dumped in the transcript.
 *
 * @param messages - The in-order chat messages.
 * @returns Ordered render groups.
 */
export function groupChatMessages(messages: ChatMessageModel[]): RenderGroup[] {
  const groups: RenderGroup[] = [];
  let turn: ChatMessageModel[] = [];

  const flush = (): void => {
    if (turn.length > 0) {
      groups.push({ kind: 'assistant-turn', messages: turn });
      turn = [];
    }
  };

  for (const m of messages) {
    if (m.role === 'assistant') {
      turn.push(m);
    } else if (m.role === 'tool') {
      // Suppressed: represented by the activity umbrella, never rendered raw.
      continue;
    } else {
      flush();
      groups.push({ kind: 'message', message: m });
    }
  }
  flush();
  return groups;
}

/** True when a message has at least one tool call. */
function hasToolCalls(m: ChatMessageModel): boolean {
  return (m.toolCalls?.length ?? 0) > 0;
}

/**
 * The turn's final-answer message id: the LAST message, when it carries text and
 * no tool calls (i.e. the model has stopped acting and is replying). `null` when
 * the turn ends on tool activity (still working / tool-only turn).
 *
 * @param messages - The assistant messages of one turn, in order.
 */
export function answerMessageId(messages: ChatMessageModel[]): string | null {
  const last = messages[messages.length - 1];
  if (!last) return null;
  const hasText = typeof last.content === 'string' && last.content.trim().length > 0;
  return hasText && !hasToolCalls(last) ? last.id : null;
}

/**
 * Whether a tool call is an "output"/interactive tool that must render in the
 * transcript (its own card), NOT be folded into the activity umbrella:
 * document-generation tools (their PDF is the deliverable) and propose-flow
 * tools (an interactive confirmation card).
 *
 * @param name - The tool call name.
 */
export function isOutputToolName(name: string): boolean {
  return DOCUMENT_TOOL_NAMES.has(name) || name.startsWith(PROPOSE_FLOW_PREFIX);
}

/** A plain tool call (folded into the umbrella as a clean row). */
export function isPlainToolCall(call: ChatToolCall): boolean {
  return !isOutputToolName(call.name);
}
