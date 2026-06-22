import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * CF-033 regression: a shared Dialog opened from inside the full-page flow
 * editor (`fixed z-[300]`) must render on the top-modal layer, not the old
 * z-50 (which put it BEHIND the editor — invisible, "dead" buttons). jsdom has
 * no stacking, so we assert the z-index classes directly.
 */
describe('Dialog stacking (CF-033)', () => {
  it('renders overlay + content above the z-[300] editor layer', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(document.querySelector('[data-slot="dialog-content"]')).toHaveClass('z-[400]');
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass('z-[399]');
  });
});
