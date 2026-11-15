/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { THEME_CATALOG, ThemeMetadata, findThemeMetadata } from './themeCatalog';
import { Check, Download, Star, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export interface ThemePreviewGalleryProps {
  activeTheme: string;
  selectedTheme: string;
  onSelectTheme: (_slug: string) => void;
  onSetDefaultTheme: (_slug: string) => void;
  /** Object URL of the rendered preview PDF, or null while unavailable. */
  previewPdfUrl: string | null;
  previewLoading?: boolean;
  previewError?: string | null;
  onRetryPreview?: () => void;
  onDownloadPdf?: (_slug: string) => void;
  isSavingDefault?: boolean;
}

export const ThemePreviewGallery: React.FC<ThemePreviewGalleryProps> = ({
  activeTheme,
  selectedTheme,
  onSelectTheme,
  onSetDefaultTheme,
  previewPdfUrl,
  previewLoading = false,
  previewError,
  onRetryPreview,
  onDownloadPdf,
  isSavingDefault = false,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(THEME_CATALOG.map((t) => t.category)))];

  const filteredThemes =
    filterCategory === 'All'
      ? THEME_CATALOG
      : THEME_CATALOG.filter((t) => t.category === filterCategory);

  // A profile saved before a theme was retired can still point at it; that
  // theme keeps rendering, so describe it instead of silently showing Folio.
  const currentMeta: ThemeMetadata = findThemeMetadata(selectedTheme) ?? {
    slug: selectedTheme,
    name: selectedTheme,
    category: 'Legacy',
    description:
      'This theme is still installed for existing profiles but is no longer part of the curated gallery.',
    badges: ['Legacy'],
    engine: 'resumed',
  };
  const isDefault = selectedTheme === activeTheme;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5rem',
        width: '100%',
        minHeight: '750px',
      }}
    >
      {/* Left / Sidebar: Themes list */}
      <div
        className="settings-card"
        style={{
          width: '320px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          }}
        >
          <h3
            style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}
          >
            Resume Themes
          </h3>
          <span
            className="badge badge-neutral"
            style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
          >
            {THEME_CATALOG.length} Curated
          </span>
        </div>

        {/* Category Pills */}
        <div
          style={{
            display: 'flex',
            gap: '0.375rem',
            overflowX: 'auto',
            paddingBottom: '0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          {categories.map((cat) => {
            const isCatActive = filterCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setFilterCategory(cat);
                }}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-md)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: isCatActive
                    ? '1px solid var(--accent-primary)'
                    : '1px solid var(--border-subtle)',
                  backgroundColor: isCatActive ? 'var(--accent-primary)' : 'var(--bg-primary)',
                  color: isCatActive ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: isCatActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Theme Cards List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxHeight: '620px',
            paddingRight: '0.25rem',
          }}
        >
          {filteredThemes.map((theme: ThemeMetadata) => {
            const isSelected = theme.slug === selectedTheme;
            const isThemeDefault = theme.slug === activeTheme;

            return (
              <button
                key={theme.slug}
                type="button"
                onClick={() => {
                  if (theme.slug !== selectedTheme) {
                    onSelectTheme(theme.slug);
                  }
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected
                    ? '1.5px solid var(--accent-primary)'
                    : '1px solid var(--border-subtle)',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.25rem',
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                    }}
                  >
                    {theme.name}
                  </span>
                  {isThemeDefault && (
                    <span
                      className="badge badge-green"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.4rem',
                      }}
                    >
                      <Star style={{ width: '0.75rem', height: '0.75rem', fill: 'currentColor' }} />{' '}
                      Active Default
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    margin: '0 0 0.5rem 0',
                    lineHeight: '1.25',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {theme.description}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {theme.badges.map((b) => (
                    <span
                      key={b}
                      className="badge badge-neutral"
                      style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right / Main: Preview Panel */}
      <div
        className="settings-card"
        style={{
          flex: 1,
          minWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}
      >
        {/* Header toolbar */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h4
                style={{
                  fontWeight: 600,
                  fontSize: '1rem',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {currentMeta.name}
              </h4>
              <span
                className="badge badge-neutral"
                style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}
              >
                {currentMeta.category}
              </span>
            </div>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                margin: '0.25rem 0 0 0',
              }}
            >
              {currentMeta.description}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!isDefault ? (
              <button
                type="button"
                onClick={() => onSetDefaultTheme(selectedTheme)}
                disabled={isSavingDefault}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {isSavingDefault ? (
                  <Loader2
                    style={{
                      width: '0.875rem',
                      height: '0.875rem',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                ) : (
                  <Star style={{ width: '0.875rem', height: '0.875rem' }} />
                )}
                Set as Default Theme
              </button>
            ) : (
              <span
                className="badge badge-green"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                <Check style={{ width: '0.875rem', height: '0.875rem' }} />
                Current Default
              </span>
            )}

            {onDownloadPdf && (
              <button
                type="button"
                onClick={() => onDownloadPdf(selectedTheme)}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                title="Download preview PDF"
              >
                <Download style={{ width: '0.875rem', height: '0.875rem' }} />
                Download PDF
              </button>
            )}
          </div>
        </div>

        {/* PDF Preview Frame with loader / error state */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            backgroundColor: 'var(--bg-primary)',
            minHeight: '620px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {previewLoading ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(11, 15, 25, 0.75)',
                backdropFilter: 'blur(4px)',
                zIndex: 10,
                gap: '0.75rem',
              }}
            >
              <Loader2
                style={{
                  width: '2rem',
                  height: '2rem',
                  color: 'var(--accent-primary)',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                Rendering {currentMeta.name} preview...
              </p>
            </div>
          ) : previewError ? (
            <div
              role="alert"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '2rem',
                textAlign: 'center',
              }}
            >
              <AlertCircle style={{ width: '2rem', height: '2rem', color: 'var(--danger)' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>
                Could not render the {currentMeta.name} preview.
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                {previewError}
              </p>
              {onRetryPreview && (
                <button
                  type="button"
                  onClick={onRetryPreview}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <RefreshCw style={{ width: '0.875rem', height: '0.875rem' }} />
                  Retry
                </button>
              )}
            </div>
          ) : previewPdfUrl ? (
            <iframe
              key={previewPdfUrl}
              src={previewPdfUrl}
              title={`${currentMeta.name} Resume Preview`}
              style={{
                width: '100%',
                height: '100%',
                minHeight: '650px',
                border: 'none',
                backgroundColor: '#ffffff',
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
