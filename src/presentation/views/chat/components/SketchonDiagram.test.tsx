import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const renderDiagram = vi.fn();
const validateSpec = vi.fn();
vi.mock('@sgummalla-works/sketchon', () => ({
  renderDiagram: (...a: unknown[]) => renderDiagram(...a),
  validateSpec: (...a: unknown[]) => validateSpec(...a),
}));
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }));

const copyImagePng = vi.fn().mockResolvedValue(undefined);
const copyText = vi.fn().mockResolvedValue(undefined);
vi.mock('@/infrastructure/platform', () => ({
  copyImagePng: (...a: unknown[]) => copyImagePng(...a),
  copyText: (...a: unknown[]) => copyText(...a),
}));

import { SketchonDiagram } from './SketchonDiagram';

const VALID_SPEC = '{"kind":"flow","nodes":[{"id":"a","label":"A"}]}';

beforeEach(() => {
  renderDiagram.mockReset();
  validateSpec.mockReset();
  copyImagePng.mockClear();
  copyText.mockClear();
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

  it('synthesizes a missing top-level id before validating', async () => {
    // The model commonly omits `spec.id`; we must inject one BEFORE validateSpec
    // runs so the (required-but-unused) id never blocks a renderable diagram.
    render(<SketchonDiagram spec={'{"kind":"flow","nodes":[{"id":"a","label":"A"}]}'} />);
    await waitFor(() => expect(validateSpec).toHaveBeenCalled());
    const validated = validateSpec.mock.calls[0][0] as { id?: string };
    expect(validated.id).toBeTruthy();
  });

  it('renders an id-less spec against the REAL validator (regression: spec.id is required)', async () => {
    // Exercise the genuine library validator — not the mock — so this test
    // actually covers the failure mode (model omits id → "spec.id is required").
    // Pre-fix this rendered the error card; post-fix the synthesized id renders.
    const actual = await vi.importActual<typeof import('@sgummalla-works/sketchon')>(
      '@sgummalla-works/sketchon',
    );
    validateSpec.mockImplementation(actual.validateSpec);
    render(<SketchonDiagram spec={'{"kind":"flow","nodes":[{"id":"a","label":"A"}],"edges":[]}'} />);
    await waitFor(() => expect(renderDiagram).toHaveBeenCalled());
    expect(screen.queryByText(/Couldn’t render diagram/)).toBeNull();
  });
});

describe('SketchonDiagram — copy/download menus', () => {
  beforeEach(() => {
    // The PNG path rasterises via <img> → <canvas>, which jsdom can't run.
    // Stub the object-URL + Image so svgToRasterBlob's promise stays pending
    // (never rejects) — copyImagePng is mocked, so the blob itself is unused
    // here; we only assert the routing.
    URL.createObjectURL = vi.fn(() => 'blob:stub');
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_v: string) {
          /* never fires onload/onerror → promise stays pending */
        }
      },
    );
  });

  /** Render a valid diagram and wait for the toolbar (svg present) to appear. */
  async function renderReady() {
    render(<SketchonDiagram spec={VALID_SPEC} />);
    await waitFor(() => expect(screen.getByLabelText('Copy diagram')).toBeInTheDocument());
  }

  it('opens the Copy menu with PNG + SVG options', async () => {
    await renderReady();
    await userEvent.click(screen.getByLabelText('Copy diagram'));
    expect(screen.getByRole('menuitem', { name: 'Copy as PNG' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy as SVG' })).toBeInTheDocument();
  });

  it('Copy as SVG copies the SVG markup as text (clipboard text path)', async () => {
    await renderReady();
    await userEvent.click(screen.getByLabelText('Copy diagram'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy as SVG' }));
    await waitFor(() => expect(copyText).toHaveBeenCalledTimes(1));
    // Gesture-safe contract: copyText is handed a PENDING promise, not a string.
    expect(copyText.mock.calls[0][0]).toBeInstanceOf(Promise);
    await expect(copyText.mock.calls[0][0]).resolves.toContain('<svg');
  });

  it('Copy as PNG routes to the image-clipboard path with a pending blob promise', async () => {
    await renderReady();
    await userEvent.click(screen.getByLabelText('Copy diagram'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy as PNG' }));
    await waitFor(() => expect(copyImagePng).toHaveBeenCalledTimes(1));
    expect(copyImagePng.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it('opens the Download menu with PNG, SVG and JPG options', async () => {
    await renderReady();
    await userEvent.click(screen.getByLabelText('Download diagram'));
    expect(screen.getByRole('menuitem', { name: 'PNG image' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'SVG vector' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'JPG image' })).toBeInTheDocument();
  });

  it('closes the open menu on Escape', async () => {
    await renderReady();
    await userEvent.click(screen.getByLabelText('Copy diagram'));
    expect(screen.getByRole('menuitem', { name: 'Copy as PNG' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('menuitem', { name: 'Copy as PNG' })).toBeNull(),
    );
  });
});
