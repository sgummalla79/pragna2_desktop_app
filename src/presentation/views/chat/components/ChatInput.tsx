import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SLASH_MAX_ITEMS } from '@/constants/slashCommands';
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_BYTES, isImageType } from '@/constants/attachments';
import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';
import type { Attachment } from '@/domain/types/attachment.types';
import { useUploadAttachment } from '@/presentation/hooks/attachments/useUploadAttachment';
import { logger } from '@/infrastructure/logging/logger';
import { SlashCommandPopover } from './SlashCommandPopover';
import { AttachmentChip } from './AttachmentChip';

/** A file staged in the composer, before/while/after its upload completes. */
interface PendingAttachment {
  clientKey: string;
  filename: string;
  contentType: string;
  /** Object URL for an image preview; revoked on remove/clear. */
  previewUrl?: string;
  /** Set once the upload succeeds; `id` is sent in `attachment_ids`. */
  attachment: Attachment | null;
  uploading: boolean;
  errored?: boolean;
}

interface ChatInputProps {
  /** Controlled draft text. */
  value: string;
  onChange: (value: string) => void;
  /** Submit the current draft + the ids of any ready attachments. */
  onSubmit: (attachmentIds: string[]) => void;
  /** Abort the in-flight run; only shown while `running`. */
  onStop?: () => void;
  /** A run is in flight — the action button becomes Stop. */
  running?: boolean;
  /** Hard-disable sending (e.g. no chat-eligible model). */
  disabled?: boolean;
  placeholder?: string;
  /** Controls below the textarea (model picker, thinking toggle). */
  controls?: ReactNode;
  /** Banner above the input (setup gating). */
  banner?: ReactNode;
  autoFocus?: boolean;
  /**
   * Flows exposed as `/slash` commands. When provided, typing `/` at the start
   * of a word opens a suggestion popover; accepting one rewrites the draft to
   * `/{slashApiName} `. Dispatch routing is handled by the parent's session hook.
   */
  slashFlows?: PragnaSlashFlow[];
  /**
   * The active conversation id. When set, the composer shows an attach button
   * and uploads picked files to this conversation. Omit (e.g. on the landing,
   * before a conversation row exists) to hide attachments.
   */
  conversationId?: string;
}

/**
 * Chat composer: an auto-growing textarea with an inline send/stop button, an
 * optional row of controls, optional `/slash` command popover, and — when
 * `conversationId` is set — file attachments (pick → upload → staged chips →
 * sent as `attachment_ids`). Enter submits; Shift+Enter inserts a newline.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  running = false,
  disabled = false,
  placeholder = 'Message the assistant…',
  controls,
  banner,
  autoFocus,
  slashFlows,
  conversationId,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadAttachment();

  // ── Attachment staging ──────────────────────────────────────────────────────
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const attachmentsEnabled = Boolean(conversationId);
  const uploadsInFlight = pending.some((p) => p.uploading);
  const readyAttachmentIds = useMemo(
    () => pending.filter((p) => p.attachment && !p.errored).map((p) => p.attachment!.id),
    [pending],
  );

  const canSend =
    !disabled && !running && !uploadsInFlight && value.trim().length > 0;

  const stageFiles = useCallback(
    (files: FileList) => {
      if (!conversationId) return;
      for (const file of Array.from(files)) {
        if (file.size > ATTACHMENT_MAX_BYTES) {
          setPending((prev) => [
            ...prev,
            {
              clientKey: `${file.name}-${file.size}-${prev.length}`,
              filename: file.name,
              contentType: file.type,
              attachment: null,
              uploading: false,
              errored: true,
            },
          ]);
          continue;
        }
        const clientKey = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
        const previewUrl = isImageType(file.type)
          ? URL.createObjectURL(file)
          : undefined;
        setPending((prev) => [
          ...prev,
          {
            clientKey,
            filename: file.name,
            contentType: file.type,
            previewUrl,
            attachment: null,
            uploading: true,
          },
        ]);
        upload
          .mutateAsync({ conversationId, file })
          .then((attachment) => {
            setPending((prev) =>
              prev.map((p) =>
                p.clientKey === clientKey ? { ...p, attachment, uploading: false } : p,
              ),
            );
          })
          .catch((err: unknown) => {
            logger.fromError(
              'ATT_001:upload',
              err instanceof Error ? err : new Error(String(err)),
            );
            setPending((prev) =>
              prev.map((p) =>
                p.clientKey === clientKey
                  ? { ...p, uploading: false, errored: true }
                  : p,
              ),
            );
          });
      }
    },
    [conversationId, upload],
  );

  const removePending = useCallback((clientKey: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.clientKey === clientKey);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.clientKey !== clientKey);
    });
  }, []);

  const clearPending = useCallback(() => {
    setPending((prev) => {
      for (const p of prev) if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      return [];
    });
  }, []);

  // Revoke any outstanding object URLs on unmount.
  useEffect(() => {
    return () => {
      setPending((prev) => {
        for (const p of prev) if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
        return prev;
      });
    };
  }, []);

  const doSubmit = useCallback(() => {
    if (!canSend) return;
    onSubmit(readyAttachmentIds);
    clearPending();
  }, [canSend, onSubmit, readyAttachmentIds, clearPending]);

  // ── Slash command popover state ─────────────────────────────────────────────
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashStart, setSlashStart] = useState(0);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  const allSlashFlows = slashFlows ?? [];

  // Detect / dismiss the popover on every value change (cursor read off the DOM).
  useEffect(() => {
    if (allSlashFlows.length === 0) {
      setSlashOpen(false);
      return;
    }
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? value.length;
    let i = cursor - 1;
    while (i >= 0 && value[i] !== '/' && !/\s/.test(value[i])) i--;
    if (i >= 0 && value[i] === '/' && (i === 0 || /\s/.test(value[i - 1]))) {
      const q = value.slice(i + 1, cursor);
      if (!/\s/.test(q)) {
        setSlashOpen(true);
        setSlashStart(i);
        setSlashQuery(q);
        setSlashIndex(0);
        return;
      }
    }
    setSlashOpen(false);
  }, [value, allSlashFlows.length]);

  const filteredSlashFlows = useMemo<PragnaSlashFlow[]>(() => {
    if (!slashOpen) return [];
    const q = slashQuery.toLowerCase();
    return allSlashFlows
      .filter((f) => f.slashApiName.toLowerCase().startsWith(q))
      .slice(0, SLASH_MAX_ITEMS);
  }, [allSlashFlows, slashOpen, slashQuery]);

  const slashActive = slashOpen && filteredSlashFlows.length > 0;

  const acceptSlash = useCallback(
    (flow: PragnaSlashFlow) => {
      const before = value.slice(0, slashStart);
      const after = value.slice(slashStart + 1 + slashQuery.length);
      const next = `${before}/${flow.slashApiName} ${after}`;
      onChange(next);
      setSlashOpen(false);
      const caret = before.length + 1 + flow.slashApiName.length + 1;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    },
    [value, slashStart, slashQuery, onChange],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // While the popover is open, these keys drive it instead of the composer.
    if (slashActive) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % filteredSlashFlows.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex(
          (i) => (i - 1 + filteredSlashFlows.length) % filteredSlashFlows.length,
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        acceptSlash(filteredSlashFlows[slashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSubmit();
    }
  };

  return (
    <div className="relative flex flex-col gap-2 rounded-3xl bg-muted p-2.5 shadow-sm transition-colors">
      {slashActive && (
        <SlashCommandPopover
          items={filteredSlashFlows}
          selectedIndex={slashIndex}
          onSelect={acceptSlash}
          onHoverIndex={setSlashIndex}
        />
      )}
      {banner}

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-0.5">
          {pending.map((p) => (
            <AttachmentChip
              key={p.clientKey}
              filename={p.filename}
              contentType={p.contentType}
              previewUrl={p.previewUrl}
              uploading={p.uploading}
              errored={p.errored}
              onRemove={() => removePending(p.clientKey)}
            />
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        autoFocus={autoFocus}
        disabled={disabled}
        className={cn(
          'max-h-48 min-h-16 w-full resize-none overflow-y-auto bg-transparent pl-3 pr-1.5 py-2 text-[15px] leading-relaxed',
          'text-foreground placeholder:text-muted-foreground outline-none',
          'field-sizing-content disabled:opacity-60',
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {attachmentsEnabled && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ATTACHMENT_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) stageFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || running}
                aria-label="Attach file"
                title="Attach a file (images, PDF, text, CSV, docx, xlsx)"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <Paperclip size={16} aria-hidden />
              </button>
            </>
          )}
        </div>
        {/* Right cluster — model/thinking controls blended next to send. */}
        <div className="flex shrink-0 items-center gap-2">
          {controls}
          {running ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90"
          >
            <Square size={14} className="fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={doSubmit}
            disabled={!canSend}
            aria-label="Send message"
            title={uploadsInFlight ? 'Waiting for uploads…' : 'Send message'}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              canSend
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <ArrowUp size={16} aria-hidden />
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
