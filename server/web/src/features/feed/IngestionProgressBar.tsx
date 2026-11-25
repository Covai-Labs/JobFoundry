import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';
import type { ExtensionScanState } from './useExtensionBridge';

interface IngestionProgressBarProps {
  scanState: ExtensionScanState | null;
  bannerDismissed: boolean;
  onDismiss: () => void;
  onRefreshFeed?: () => void;
}

export const IngestionProgressBar: React.FC<IngestionProgressBarProps> = ({
  scanState,
  bannerDismissed,
  onDismiss,
  onRefreshFeed,
}) => {
  if (!scanState || bannerDismissed) return null;

  const isRecent =
    scanState.inProgress || (scanState.completedAt && Date.now() - scanState.completedAt < 300_000);

  if (!isRecent || scanState.statusMessage === 'Ready') return null;

  const isError =
    !scanState.inProgress &&
    ((scanState.errors && scanState.errors.length > 0 && !scanState.newIngested) ||
      scanState.statusMessage.toLowerCase().includes('failed') ||
      scanState.statusMessage.toLowerCase().includes('error'));

  const isSuccess =
    !scanState.inProgress &&
    !isError &&
    (scanState.newIngested !== undefined ? scanState.newIngested > 0 : true);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: scanState.inProgress
          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)'
          : isError
            ? 'rgba(239, 68, 68, 0.12)'
            : 'rgba(16, 185, 129, 0.12)',
        border: `1px solid ${
          scanState.inProgress
            ? 'rgba(99, 102, 241, 0.3)'
            : isError
              ? 'rgba(239, 68, 68, 0.3)'
              : 'rgba(16, 185, 129, 0.3)'
        }`,
        borderRadius: 'var(--radius-md)',
        padding: '0.65rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        animation: 'fadeIn 0.2s ease-in-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
        {scanState.inProgress ? (
          <Loader2
            size={16}
            style={{
              color: 'var(--accent-primary)',
              animation: 'spin 1s linear infinite',
              flexShrink: 0,
            }}
          />
        ) : isError ? (
          <AlertTriangle size={16} style={{ color: 'var(--color-red, #ef4444)', flexShrink: 0 }} />
        ) : (
          <CheckCircle2 size={16} style={{ color: 'var(--color-green, #10b981)', flexShrink: 0 }} />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: scanState.inProgress
                ? 'var(--text-primary)'
                : isError
                  ? 'var(--color-red, #ef4444)'
                  : 'var(--color-green, #10b981)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {scanState.statusMessage}
          </span>
          {scanState.inProgress && scanState.currentTerm && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Active search keyword: <strong>{scanState.currentTerm}</strong>
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {!scanState.inProgress && isSuccess && onRefreshFeed && (
          <button
            type="button"
            onClick={onRefreshFeed}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
            }}
          >
            <RefreshCw size={12} /> Refresh Feed
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss scan status"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.2rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
