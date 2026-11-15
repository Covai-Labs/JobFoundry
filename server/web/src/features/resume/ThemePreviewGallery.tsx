import React, { useState } from 'react';
import { THEME_CATALOG, ThemeMetadata, findThemeMetadata } from './themeCatalog';
import { Check, Download, Star, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export interface ThemePreviewGalleryProps {
  activeTheme: string;
  selectedTheme: string;
  onSelectTheme: (slug: string) => void;
  onSetDefaultTheme: (slug: string) => void;
  previewPdfUrl: string;
  onDownloadPdf?: (slug: string) => void;
  isSavingDefault?: boolean;
}

export const ThemePreviewGallery: React.FC<ThemePreviewGalleryProps> = ({
  activeTheme,
  selectedTheme,
  onSelectTheme,
  onSetDefaultTheme,
  previewPdfUrl,
  onDownloadPdf,
  isSavingDefault = false,
}) => {
  const [iframeLoading, setIframeLoading] = useState<boolean>(true);
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(THEME_CATALOG.map((t) => t.category)))];

  const filteredThemes = filterCategory === 'All'
    ? THEME_CATALOG
    : THEME_CATALOG.filter((t) => t.category === filterCategory);

  const currentMeta = findThemeMetadata(selectedTheme) || THEME_CATALOG[0];
  const isDefault = selectedTheme === activeTheme;

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full h-full min-h-[750px]">
      {/* Left / Sidebar: Themes list */}
      <div className="w-full lg:w-80 flex flex-col shrink-0 border border-border rounded-xl bg-card p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-base text-foreground">Resume Themes</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {THEME_CATALOG.length} Curated
          </span>
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
                filterCategory === cat
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Theme Cards List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[600px] lg:max-h-none scrollbar-thin">
          {filteredThemes.map((theme: ThemeMetadata) => {
            const isSelected = theme.slug === selectedTheme;
            const isThemeDefault = theme.slug === activeTheme;

            return (
              <div
                key={theme.slug}
                onClick={() => {
                  if (theme.slug !== selectedTheme) {
                    setIframeLoading(true);
                    onSelectTheme(theme.slug);
                  }
                }}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-border/80 hover:bg-muted/30 bg-background'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-foreground">{theme.name}</span>
                  {isThemeDefault && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded">
                      <Star className="w-3 h-3 fill-emerald-500" /> Active Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {theme.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {theme.badges.map((b) => (
                    <span
                      key={b}
                      className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.2 rounded"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right / Main: Preview Panel */}
      <div className="flex-1 flex flex-col border border-border rounded-xl bg-card overflow-hidden">
        {/* Header toolbar */}
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-base text-foreground">{currentMeta.name}</h4>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                {currentMeta.category}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{currentMeta.description}</p>
          </div>

          <div className="flex items-center gap-2">
            {!isDefault ? (
              <button
                type="button"
                onClick={() => onSetDefaultTheme(selectedTheme)}
                disabled={isSavingDefault}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSavingDefault ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Star className="w-3.5 h-3.5" />
                )}
                Set as Default Theme
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Check className="w-3.5 h-3.5" />
                Current Default
              </span>
            )}

            {onDownloadPdf && (
              <button
                type="button"
                onClick={() => onDownloadPdf(selectedTheme)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors"
                title="Download preview PDF"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            )}
          </div>
        </div>

        {/* PDF Preview Frame with loader */}
        <div className="relative flex-1 bg-muted/40 min-h-[600px] flex items-center justify-center">
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">
                Rendering {currentMeta.name} preview...
              </p>
            </div>
          )}

          <iframe
            key={previewPdfUrl}
            src={previewPdfUrl}
            title={`${currentMeta.name} Resume Preview`}
            className="w-full h-full min-h-[650px] border-none"
            onLoad={() => setIframeLoading(false)}
          />
        </div>
      </div>
    </div>
  );
};
