import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regression guard for the Select dropdown-overlap bug (CF-018 /
 * pragna2-tracker #112).
 *
 * `SelectContent` MUST default to Radix `position="popper"` so dropdowns open
 * below/above the trigger; the `item-aligned` default overlays the option list
 * ON TOP of the trigger (the overlap bug). This kept silently regressing — the
 * prior fix was closed but never merged — so we assert the default at the source.
 *
 * A behavioral open-test isn't used: the Radix Select portal can't be opened
 * reliably in jsdom (see `ModelPicker.test.tsx`), which would make it flaky. The
 * default value is exactly what regressed, so guarding it directly is both
 * deterministic and precise.
 */
describe('SelectContent default position (CF-018 regression guard)', () => {
  const src = readFileSync(
    resolve(process.cwd(), 'src/components/ui/select.tsx'),
    'utf8',
  );

  it('defaults to "popper" (opens below the trigger)', () => {
    expect(src).toMatch(/position\s*=\s*"popper"/);
  });

  it('does NOT default to "item-aligned" (which overlaps the trigger)', () => {
    expect(src).not.toMatch(/position\s*=\s*"item-aligned"\s*,/);
  });
});
