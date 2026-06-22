/**
 * Collapsible validation-errors block for a flow YAML document.
 *
 * Renders the structured `YamlError[]` returned by `/api/flows/validate-yaml`
 * as a disclosure: a summary header (issue count) that toggles the per-error
 * list (path — message) open/closed. Defaults open when errors are present so
 * the author sees them immediately, but stays collapsible so a long list does
 * not crowd out the editor/canvas. Returns null when there are no errors.
 *
 * Shared by the editor's Save banner ({@link FlowEditor}) and the editable YAML
 * sheet ({@link FlowYamlEditorSheet}).
 */

import { useState } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { YamlError } from '@/domain/types/flowYaml.types';

interface Props {
  /** Structured validation errors to display; an empty array renders nothing. */
  errors: YamlError[];
  /** Optional wrapper class (e.g. spacing in a banner row). */
  className?: string;
}

/** A collapsible block listing flow-YAML validation errors by path. */
export function FlowYamlErrors({ errors, className }: Props) {
  const [open, setOpen] = useState(true);
  if (errors.length === 0) return null;

  const summary =
    errors.length === 1 ? '1 issue blocking save' : `${errors.length} issues blocking save`;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('overflow-hidden rounded-md bg-red-900 text-white', className)}
    >
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <AlertCircle size={16} aria-hidden="true" />
        <span className="font-medium">{summary}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn('ml-auto shrink-0 transition-transform', open && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="max-h-48 space-y-1 overflow-y-auto border-t border-white/15 px-3 py-2 font-mono text-xs">
          {errors.map((e, i) => (
            <li key={i}>
              <span className="text-white/70">{e.path || '(document)'}</span>
              {' — '}
              {e.message}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
