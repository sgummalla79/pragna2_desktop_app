/**
 * Lightweight collapsible JSON tree renderer.
 *
 * Renders any JSON value as an interactive tree: objects and arrays are
 * collapsible (click the key/bracket to toggle), primitives render inline.
 * No external dependencies — pure React + Tailwind.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NodeProps {
  /** The key label shown to the left of this node (undefined for root). */
  label?: string;
  value: unknown;
  /** Initial collapsed state for objects/arrays. */
  defaultCollapsed?: boolean;
}

function JsonNode({ label, value, defaultCollapsed = false }: NodeProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const isObject =
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const entries: [string, unknown][] = isObject
    ? Object.entries(value as Record<string, unknown>)
    : isArray
      ? (value as unknown[]).map((v, i) => [String(i), v])
      : [];

  const bracket = isArray ? ['[', ']'] : ['{', '}'];
  const summary = isArray
    ? `${(value as unknown[]).length} item${(value as unknown[]).length === 1 ? '' : 's'}`
    : `${entries.length} key${entries.length === 1 ? '' : 's'}`;

  function keyLabel(k: string): React.ReactNode {
    // Object keys rendered in VS Code Light+ / Dark+ key colour.
    return (
      <>
        <span className="text-[#001080] dark:text-[#9cdcfe]">&quot;{k}&quot;</span>
        <span className="text-foreground">:&thinsp;</span>
      </>
    );
  }

  function primitive(v: unknown): React.ReactNode {
    if (v === null)
      return (
        <span className="italic text-[#0000ff] dark:text-[#569cd6]">null</span>
      );
    if (typeof v === 'boolean')
      return (
        <span className="text-[#0000ff] dark:text-[#569cd6]">{String(v)}</span>
      );
    if (typeof v === 'number')
      return (
        <span className="text-[#098658] dark:text-[#b5cea8]">{String(v)}</span>
      );
    if (typeof v === 'string')
      return (
        <span className="text-[#a31515] dark:text-[#ce9178]">
          &quot;{v}&quot;
        </span>
      );
    return <span className="text-muted-foreground">{String(v)}</span>;
  }

  if (!isExpandable) {
    return (
      <div className="flex items-baseline gap-0.5 py-0.5 font-mono text-xs">
        {label !== undefined && keyLabel(label)}
        {primitive(value)}
      </div>
    );
  }

  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-0.5 rounded font-mono text-xs hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-expanded={!collapsed}
      >
        <span className="shrink-0 text-muted-foreground">
          {collapsed ? (
            <ChevronRight size={12} aria-hidden="true" />
          ) : (
            <ChevronDown size={12} aria-hidden="true" />
          )}
        </span>
        {label !== undefined && keyLabel(label)}
        <span className="text-foreground/70">{bracket[0]}</span>
        {collapsed && (
          <>
            <span className="ml-1 italic text-muted-foreground">{summary}</span>
            <span className="text-foreground/70">{bracket[1]}</span>
          </>
        )}
      </button>

      {!collapsed && (
        <div className="ml-4 border-l border-border pl-2">
          {entries.map(([k, v]) => (
            <JsonNode key={k} label={k} value={v} defaultCollapsed={false} />
          ))}
          <div className="font-mono text-xs text-foreground/70">{bracket[1]}</div>
        </div>
      )}
    </div>
  );
}

interface JsonTreeProps {
  /** The parsed JSON value to render. */
  value: unknown;
  className?: string;
}

/** Collapsible JSON tree. Pass any parsed JSON value. */
export function JsonTree({ value, className }: JsonTreeProps) {
  return (
    <div className={className}>
      <JsonNode value={value} />
    </div>
  );
}
