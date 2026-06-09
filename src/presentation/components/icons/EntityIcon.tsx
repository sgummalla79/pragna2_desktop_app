/**
 * EntityIcon — the ONE place that defines how a section/entity icon looks.
 *
 * Every recurring app concept (Knowledge, Connectors, Providers, Agents, …)
 * renders as a colored rounded TILE with a white glyph, matching the flow
 * editor's palette-node convention. Defined once here and referenced everywhere
 * (settings sidebar, page headers, agent-editor section headers, …) so changing
 * a color or icon happens in a single spot — no more hunting for missed places.
 *
 * Add a concept = one entry in `ENTITY_ICONS`. Use it = `<EntityIcon entity=…>`.
 */

import type { ComponentType } from 'react';
import { Bot, Library, SlidersHorizontal } from 'lucide-react';

import { ConnectorsIcon } from './ConnectorsIcon';
import { FlowsIcon } from './FlowsIcon';
import { ProvidersIcon } from './ProvidersIcon';

export type EntityKey =
  | 'configuration'
  | 'providers'
  | 'connectors'
  | 'knowledge'
  | 'agents'
  | 'flows'
  | 'appearance'
  | 'profile';

/** A glyph that accepts a numeric `size` (lucide + our custom icons all do). */
type Glyph = ComponentType<{ size?: number; className?: string }>;

interface EntityIconDef {
  Glyph: Glyph;
  /** Tailwind background class for the tile (solid brand color). */
  tile: string;
  /** Per-entity icon-size bump — some glyphs (e.g. the connectors links)
   *  read smaller at the same nominal size, so they get a few extra px. */
  iconBump?: number;
}

export const ENTITY_ICONS: Record<EntityKey, EntityIconDef> = {
  configuration: { Glyph: SlidersHorizontal, tile: 'bg-indigo-500' },
  providers: { Glyph: ProvidersIcon, tile: 'bg-amber-500' },
  connectors: { Glyph: ConnectorsIcon, tile: 'bg-violet-500', iconBump: 3 },
  knowledge: { Glyph: Library, tile: 'bg-teal-500' },
  agents: { Glyph: Bot, tile: 'bg-sky-500' },
  flows: { Glyph: FlowsIcon, tile: 'bg-emerald-500' },
  appearance: { Glyph: AppearanceGlyph, tile: 'bg-rose-500' },
  profile: { Glyph: ProfileGlyph, tile: 'bg-cyan-500' },
};

type EntitySize = 'sm' | 'md' | 'lg';

/** Tile dimensions + base glyph size per visual size. */
const SIZES: Record<EntitySize, { tile: string; icon: number }> = {
  sm: { tile: 'h-6 w-6 rounded-md', icon: 14 }, // section headers
  md: { tile: 'h-7 w-7 rounded-lg', icon: 16 }, // sidebar nav
  lg: { tile: 'h-9 w-9 rounded-lg', icon: 20 }, // page headers
};

interface Props {
  entity: EntityKey;
  size?: EntitySize;
  className?: string;
}

/** A colored icon tile for an app entity. White glyph on the entity's color. */
export function EntityIcon({ entity, size = 'md', className }: Props) {
  const def = ENTITY_ICONS[entity];
  const dims = SIZES[size];
  const Glyph = def.Glyph;
  return (
    <span
      aria-hidden="true"
      className={[
        'inline-flex shrink-0 items-center justify-center text-white',
        dims.tile,
        def.tile,
        className ?? '',
      ].join(' ')}
    >
      <Glyph size={dims.icon + (def.iconBump ?? 0)} aria-hidden="true" />
    </span>
  );
}

// ── Glyphs with no shared component yet ─────────────────────────────────────

function AppearanceGlyph({ size = 16 }: { size?: number }) {
  // Half-moon "theme" glyph.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18 6 6 0 0 0 0-12 6 6 0 0 1 0-6z" fill="currentColor" />
    </svg>
  );
}

function ProfileGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
