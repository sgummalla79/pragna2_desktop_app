import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const renderDiagram = vi.fn();
const validateSpec = vi.fn();
vi.mock('@sgummalla-works/sketchon', () => ({
  renderDiagram: (...a: unknown[]) => renderDiagram(...a),
  validateSpec: (...a: unknown[]) => validateSpec(...a),
}));
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }));

import { SketchonDiagram } from './SketchonDiagram';

beforeEach(() => {
  renderDiagram.mockReset();
  validateSpec.mockReset();
  validateSpec.mockReturnValue([]);
  renderDiagram.mockResolvedValue({ svg: '<svg data-testid="svg"></svg>' });
});

describe('SketchonDiagram', () => {
  it('stays in the loading state for an incomplete (streaming) spec', () => {
    render(<SketchonDiagram spec={'{"kind":"flow"'} />);
    expect(screen.getByText(/Rendering diagram/)).toBeInTheDocument();
    expect(renderDiagram).not.toHaveBeenCalled();
  });

  it('renders the sanitized SVG for a complete, valid spec', async () => {
    render(<SketchonDiagram spec={'{"kind":"flow","nodes":[]}'} />);
    await waitFor(() => expect(renderDiagram).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('svg')).toBeTruthy());
  });

  it('shows a friendly error when a COMPLETE spec is invalid', async () => {
    validateSpec.mockReturnValue([{ message: 'missing kind' }]);
    render(<SketchonDiagram spec={'{"bad":true}'} />);
    await waitFor(() => expect(screen.getByText(/Couldn’t render diagram/)).toBeInTheDocument());
    expect(renderDiagram).not.toHaveBeenCalled();
  });

  it('shows an error for complete-but-unparseable JSON', async () => {
    render(<SketchonDiagram spec={'{not json}'} />);
    await waitFor(() => expect(screen.getByText(/Couldn’t render diagram/)).toBeInTheDocument());
  });
});
