import { type ReactNode } from 'react';
import { Info, Wrench } from 'lucide-react';
import type {
  ChatMessage as ChatMessageModel,
  ChatToolCall,
} from '@/presentation/views/chat/hooks/useChatSession';
import { NO_REPLY_NOTICE } from '@/constants/chat';
import { ActivityDisclosure } from './ActivityDisclosure';
import { answerMessageId, isOutputToolName } from '../utils/assistantTurns';
import { toolArgSummary, toolDisplayLabel } from '../utils/toolDisplay';

interface AssistantTurnProps {
  /** The assistant messages of one turn, in order. */
  messages: ChatMessageModel[];
  /**
   * Render an "outside" message (the final answer, a generated document, a flow
   * proposal) via the full `ChatMessage` — the caller wires every per-message
   * prop. `hideReasoning` is always set: the turn's reasoning is folded into the
   * umbrella, so the message must not show its own reasoning strip.
   */
  renderMessage: (message: ChatMessageModel, opts: { hideReasoning: boolean }) => ReactNode;
  /** Whether a message id carries generated-document attachments (→ render outside). */
  hasAttachment: (messageId: string) => boolean;
  /** True for the in-flight turn — the umbrella opens live and shows "Working…". */
  streaming: boolean;
  /** Live progress label for the streaming turn's umbrella header. */
  progressLabel?: string | null;
  /**
   * True when THIS turn's run FAILED (the conversation is in an error state and
   * the global error banner explains why). Suppresses the benign "no reply"
   * notice so a failed run — e.g. a flow that aborted on the step limit — is not
   * mistaken for the assistant simply choosing not to answer (pragna2-tracker
   * #191). Only the last/current turn is ever marked failed.
   */
  runFailed?: boolean;
}

type ActivityStep =
  | { kind: 'reasoning'; content: string }
  | { kind: 'text'; content: string }
  | { kind: 'tool'; call: ChatToolCall };

/**
 * One assistant turn rendered the claude.ai way: all intermediate work —
 * reasoning, interim narration, and every plain tool call — folded into a single
 * collapsible **activity umbrella**, with only the final answer (and any
 * outputs/interactive cards: documents, flow proposals) left in the transcript.
 *
 * The umbrella is open + live while the turn streams, then collapses to "Done".
 * Plain chat turns (no tools, no reasoning) render no umbrella — just the answer.
 */
export function AssistantTurn({
  messages,
  renderMessage,
  hasAttachment,
  streaming,
  progressLabel,
  runFailed,
}: AssistantTurnProps) {
  const answerId = answerMessageId(messages);

  /** Outputs/interactive messages stay in the transcript (own cards), not the umbrella. */
  const isOutput = (m: ChatMessageModel): boolean =>
    m.id === answerId ||
    hasAttachment(m.id) ||
    (m.toolCalls?.some((c) => isOutputToolName(c.name)) ?? false);

  const steps: ActivityStep[] = [];
  const outside: ChatMessageModel[] = [];

  for (const m of messages) {
    // Reasoning always folds into the umbrella, even for an output message.
    if (m.reasoning) steps.push({ kind: 'reasoning', content: m.reasoning });

    const out = isOutput(m);
    // An output message's text is its own answer/caption (rendered outside);
    // only an intermediate message's narration folds into the umbrella.
    if (!out && m.content && m.content.trim()) {
      steps.push({ kind: 'text', content: m.content });
    }
    // EVERY tool call folds into the umbrella as an activity step — plain tools,
    // document tools (e.g. create_pdf), AND propose-flow. The umbrella is the
    // complete record of the work the agent did, so no tool is hidden from it.
    // Output/interactive tools ALSO keep their own card outside (the document /
    // flow-proposal card is the deliverable; the umbrella row is the audit log).
    for (const call of m.toolCalls ?? []) {
      steps.push({ kind: 'tool', call });
    }

    // Output/interactive messages (the answer, a generated document, a flow
    // proposal) keep their own card in the transcript.
    if (out) outside.push(m);
  }

  const toolLabels = [
    ...new Set(
      steps.flatMap((s) => (s.kind === 'tool' ? [toolDisplayLabel(s.call.name)] : [])),
    ),
  ];
  const summary = streaming
    ? progressLabel || 'Working…'
    : toolLabels.length > 0
      ? toolLabels.join(' · ')
      : 'Reasoning';

  // A COMPLETED turn with activity (umbrella shown) but nothing left in the
  // transcript — `answerMessageId` was null (empty final message) and there's no
  // output card. Without a fallback the body is blank, so the user has no signal
  // the tool ran (#156; the empty reply itself is the BE bug #155). Render a
  // subtle notice. Suppressed while streaming (the answer may still be arriving),
  // AND when the run FAILED (#191) — a failed run is an error, not an empty
  // answer, so the benign "no reply" wording would mislead; the global error
  // banner is the correct signal there.
  const showNoReplyNotice =
    !streaming && !runFailed && outside.length === 0 && steps.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      {steps.length > 0 && (
        <ActivityDisclosure
          summary={summary}
          // While streaming the umbrella is open and live — keep the progress
          // label in the header; once done, a static "Activity" label.
          openLabel={streaming ? summary : 'Activity'}
          status={streaming ? 'running' : 'done'}
          defaultOpen={streaming}
        >
          <div className="space-y-2">
            {steps.map((step, i) => (
              <ActivityStepRow key={`step-${i}`} step={step} />
            ))}
          </div>
        </ActivityDisclosure>
      )}
      {showNoReplyNotice && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground/70">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="italic">{NO_REPLY_NOTICE}</span>
        </div>
      )}
      {outside.map((m) => (
        <div key={m.id}>{renderMessage(m, { hideReasoning: true })}</div>
      ))}
    </div>
  );
}

/** One row inside the activity umbrella — reasoning/narration text or a tool. */
function ActivityStepRow({ step }: { step: ActivityStep }) {
  if (step.kind === 'tool') {
    const label = toolDisplayLabel(step.call.name);
    const argSummary = toolArgSummary(step.call.args);
    return (
      <div className="flex items-start gap-2">
        <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        <span className="min-w-0 break-words">
          <span className="text-foreground/90">{label}</span>
          {argSummary && (
            <>
              <span className="text-muted-foreground/50"> · </span>
              <span className="text-muted-foreground">{argSummary}</span>
            </>
          )}
        </span>
      </div>
    );
  }
  return (
    <p className="whitespace-pre-wrap break-words text-muted-foreground">{step.content}</p>
  );
}
