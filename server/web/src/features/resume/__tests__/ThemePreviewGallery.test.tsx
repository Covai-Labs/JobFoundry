import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemePreviewGallery } from '../ThemePreviewGallery';

describe('ThemePreviewGallery', () => {
  it('renders theme cards with active theme indicated', () => {
    const onSelectTheme = vi.fn();
    const onSetDefaultTheme = vi.fn();

    render(
      <ThemePreviewGallery
        activeTheme="jsonresume-theme-folio"
        selectedTheme="jsonresume-theme-folio"
        onSelectTheme={onSelectTheme}
        onSetDefaultTheme={onSetDefaultTheme}
        previewPdfUrl="/api/v1/master-resume/preview-pdf?theme=jsonresume-theme-folio"
      />
    );

    expect(screen.getAllByText('Folio').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Active Default')).toBeInTheDocument();
  });

  it('calls onSelectTheme when clicking another theme', () => {
    const onSelectTheme = vi.fn();
    render(
      <ThemePreviewGallery
        activeTheme="jsonresume-theme-folio"
        selectedTheme="jsonresume-theme-folio"
        onSelectTheme={onSelectTheme}
        onSetDefaultTheme={vi.fn()}
        previewPdfUrl="/api/v1/master-resume/preview-pdf?theme=jsonresume-theme-folio"
      />
    );

    fireEvent.click(screen.getByText('Jake Technical'));
    expect(onSelectTheme).toHaveBeenCalledWith('jsonresume-theme-jake-technical');
  });

  it('calls onSetDefaultTheme when clicking Set as Default button for an inactive theme', () => {
    const onSetDefaultTheme = vi.fn();
    render(
      <ThemePreviewGallery
        activeTheme="jsonresume-theme-folio"
        selectedTheme="jsonresume-theme-jake-technical"
        onSelectTheme={vi.fn()}
        onSetDefaultTheme={onSetDefaultTheme}
        previewPdfUrl="/api/v1/master-resume/preview-pdf?theme=jsonresume-theme-jake-technical"
      />
    );

    const button = screen.getByRole('button', { name: /set as default theme/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onSetDefaultTheme).toHaveBeenCalledWith('jsonresume-theme-jake-technical');
  });

  it('shows a retryable error instead of an empty preview when rendering fails', () => {
    const onRetryPreview = vi.fn();
    render(
      <ThemePreviewGallery
        activeTheme="jsonresume-theme-folio"
        selectedTheme="jsonresume-theme-folio"
        onSelectTheme={vi.fn()}
        onSetDefaultTheme={vi.fn()}
        previewPdfUrl={null}
        previewError="tailor unavailable"
        onRetryPreview={onRetryPreview}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/tailor unavailable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetryPreview).toHaveBeenCalled();
  });

  it('describes a theme that is no longer in the curated catalog', () => {
    render(
      <ThemePreviewGallery
        activeTheme="jsonresume-theme-folio-concise"
        selectedTheme="jsonresume-theme-folio-concise"
        onSelectTheme={vi.fn()}
        onSetDefaultTheme={vi.fn()}
        previewPdfUrl={null}
      />
    );

    expect(screen.getAllByText(/Legacy/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/no longer part of the curated gallery/i)).toBeInTheDocument();
  });
});
