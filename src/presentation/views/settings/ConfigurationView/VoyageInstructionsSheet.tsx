/**
 * "How to get a free Voyage API key" instructions flyout.
 *
 * Opened by the Instructions button in the EmbeddingKeySection header.
 * A right-anchored Sheet (same side as the flow YAML editor) with a
 * step-by-step walkthrough — no interactive state, read-only.
 */

import { BookOpen, ExternalLink } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Step number badge used in the numbered list. */
function Step({ n }: { n: number }) {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {n}
    </span>
  );
}

/** Callout box for tips / notes. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
      {children}
    </div>
  );
}

/** Read-only sheet explaining how to obtain and configure a free Voyage API key. */
export function VoyageInstructionsSheet({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="z-[400] w-full overflow-y-auto sm:max-w-md" overlayClassName="z-[399]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen size={18} aria-hidden="true" />
            Get a free Voyage API key
          </SheetTitle>
          <SheetDescription>
            Voyage AI provides a free tier that covers embedding and re-ranking —
            no credit card required. Follow the steps below to get your key.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-6 text-sm">

          {/* Step 1 */}
          <div className="flex gap-3">
            <Step n={1} />
            <div className="min-w-0">
              <p className="font-semibold">Create a free Voyage AI account</p>
              <p className="mt-1 text-muted-foreground">
                Go to{' '}
                <a
                  href="https://dash.voyageai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
                >
                  dash.voyageai.com
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
                {' '}and sign up with your Google or GitHub account (or email).
                No credit card is asked during sign-up.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <Step n={2} />
            <div className="min-w-0">
              <p className="font-semibold">Open the API Keys page</p>
              <p className="mt-1 text-muted-foreground">
                After signing in, click <strong>API Keys</strong> in the left
                sidebar (or navigate to{' '}
                <span className="font-mono text-xs">
                  dash.voyageai.com/api-keys
                </span>
                ).
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <Step n={3} />
            <div className="min-w-0">
              <p className="font-semibold">Create a new key</p>
              <p className="mt-1 text-muted-foreground">
                Click <strong>Create new secret key</strong>, give it a name
                (e.g. <em>Nexus Kit</em>), then click <strong>Create</strong>.
                The key starts with <span className="font-mono text-xs">pa-</span>.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-3">
            <Step n={4} />
            <div className="min-w-0">
              <p className="font-semibold">Copy the key immediately</p>
              <p className="mt-1 text-muted-foreground">
                The full key is shown only once. Copy it now — you will not be
                able to view it again after closing the dialog.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-3">
            <Step n={5} />
            <div className="min-w-0">
              <p className="font-semibold">Paste it here</p>
              <p className="mt-1 text-muted-foreground">
                Close this panel, expand the <strong>Embeddings — Voyage</strong>{' '}
                card, paste your key into the <strong>API key</strong> field, and
                click <strong>Save key</strong>. The key is validated with a live
                test call, then encrypted at rest — it is never shown again.
              </p>
            </div>
          </div>

          <Note>
            <p>
              <strong>Free tier limits</strong> — Voyage AI's free plan includes
              200 M embedding tokens and 1 M re-ranking tokens per month. For
              typical Knowledge-library usage this is more than enough to get
              started. Upgrade at any time from the Voyage AI dashboard if you
              need higher limits.
            </p>
          </Note>

          <Note>
            <p>
              <strong>Which model is used?</strong> — Nexus Kit defaults to{' '}
              <span className="font-mono">voyage-3</span> for embeddings and{' '}
              <span className="font-mono">rerank-2</span> for re-ranking. Both
              are covered by the free tier. You can change the model in the
              Knowledge &amp; retrieval settings inside this same card after
              your key is saved.
            </p>
          </Note>

        </div>
      </SheetContent>
    </Sheet>
  );
}
