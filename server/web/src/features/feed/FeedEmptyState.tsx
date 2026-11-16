import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface FeedEmptyStateProps {
  /** True when the status filter is the default "Needs Action" queue. */
  isQueueView: boolean;
  /** True when search/source/score filters are narrowing the list. */
  hasActiveFilters: boolean;
  /** Total jobs before filtering, used to tell "no jobs yet" from "queue drained". */
  totalJobs: number;
  hasActiveResume: boolean | null;
  isExtensionPaired: boolean;
  onShowAll: () => void;
  onResetFilters: () => void;
}

/**
 * Everything the feed shows when the filtered list is empty. A drained queue,
 * a filter that matched nothing and a fresh account are different situations
 * with different next steps, so they never share a message.
 */
export const FeedEmptyState: React.FC<FeedEmptyStateProps> = ({
  isQueueView,
  hasActiveFilters,
  totalJobs,
  hasActiveResume,
  isExtensionPaired,
  onShowAll,
  onResetFilters,
}) => {
  if (isQueueView && !hasActiveFilters && totalJobs > 0) {
    return (
      <div className="empty-state">
        <CheckCircle2 size={34} style={{ color: 'var(--color-green)', marginBottom: '0.75rem' }} />
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          You&apos;re all caught up
        </h3>
        <p style={{ fontSize: '0.875rem' }}>
          Nothing needs action right now. Applied and closed jobs live in the Tracker.
        </p>
        <button
          onClick={onShowAll}
          className="btn btn-secondary btn-sm"
          style={{ marginTop: '1rem' }}
        >
          View applied &amp; closed
        </button>
      </div>
    );
  }

  if (hasActiveFilters) {
    return (
      <div className="empty-state">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          No jobs match your filters
        </h3>
        <p style={{ fontSize: '0.875rem' }}>
          Try broadening your search query or reset the status and source filters.
        </p>
        <button
          onClick={onResetFilters}
          className="btn btn-primary btn-sm"
          style={{ marginTop: '1rem' }}
        >
          Reset Filters
        </button>
      </div>
    );
  }

  if (hasActiveResume === null) {
    return (
      <div
        className="onboarding-hero"
        style={{
          opacity: 0.6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Loading setup status...
        </span>
      </div>
    );
  }

  if (hasActiveResume === false) {
    return (
      /* Step 1: AI Model -> Step 2: Master Resume -> Step 3: Ingestion */
      <div className="onboarding-hero">
        <div className="onboarding-hero-header">
          <div className="onboarding-hero-title">
            <span>🚀</span> Welcome to JobFoundry!
          </div>
          <p className="onboarding-hero-subtitle">
            Set up your career command center in 3 steps to unlock automated AI scoring, match
            evaluation, and tailored resumes.
          </p>
        </div>

        <div className="onboarding-steps">
          <div className="onboarding-step-card">
            <div>
              <span className="onboarding-step-badge">Step 1 • AI Settings</span>
              <div className="onboarding-step-title">Configure AI Model & Key</div>
              <div className="onboarding-step-desc">
                Verify your LLM model (OpenRouter, OpenAI, or Anthropic) used to screen jobs and
                tailor applications.
              </div>
            </div>
            <a
              href="/settings?tab=gateway"
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              Configure AI Gateway →
            </a>
          </div>

          <div className="onboarding-step-card">
            <div>
              <span className="onboarding-step-badge">Step 2 • Master Profile</span>
              <div className="onboarding-step-title">Upload Master Resume</div>
              <div className="onboarding-step-desc">
                Add your master JSON Resume to anchor job evaluations and experience bullet
                tailoring.
              </div>
            </div>
            <a
              href="/settings?tab=profile"
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              Set Up Resume →
            </a>
          </div>

          <div className="onboarding-step-card">
            <div>
              <span className="onboarding-step-badge">Step 3 • Ingestion</span>
              <div className="onboarding-step-title">Connect Job Sources</div>
              <div className="onboarding-step-desc">
                Pair the browser extension for 1-click capture or configure automated portal
                scrapers.
              </div>
            </div>
            <a
              href="/settings?tab=sync"
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              Connect Sources →
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* Resume is present, waiting for first job scan/capture */
  return (
    <div className="onboarding-hero">
      <div className="onboarding-hero-header">
        <div className="onboarding-hero-title">
          <span>⚡</span> Master Profile Ready — Let&apos;s Ingest Jobs!
        </div>
        <p className="onboarding-hero-subtitle">
          Your Master Resume and AI Fit Scorer are ready. Ingest your first listings to start seeing
          match scores and tailored resumes.
        </p>
      </div>

      <div className="onboarding-steps">
        {isExtensionPaired ? (
          <div
            className="onboarding-step-card"
            style={{
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div>
              <span
                className="onboarding-step-badge"
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--color-green, #10b981)',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                }}
              >
                ✓ Extension Paired & Ready
              </span>
              <div className="onboarding-step-title">Capture Jobs as You Browse</div>
              <div className="onboarding-step-desc">
                Your extension is paired. Browse LinkedIn, Indeed, Greenhouse, or Lever and click
                the JobFoundry extension icon to capture jobs. Or add a listing manually via + Add
                Job above.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <a
                href="/settings?tab=sync"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none', textAlign: 'center' }}
              >
                Extension Settings →
              </a>
            </div>
          </div>
        ) : (
          <div className="onboarding-step-card">
            <div>
              <span className="onboarding-step-badge">Browser Extension</span>
              <div className="onboarding-step-title">1-Click Live Capture</div>
              <div className="onboarding-step-desc">
                Browse jobs naturally on LinkedIn, Indeed, Greenhouse, or Lever and capture in 1
                click.
              </div>
            </div>
            <a
              href="/settings?tab=sync"
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              Pair Extension →
            </a>
          </div>
        )}

        <div className="onboarding-step-card">
          <div>
            <span className="onboarding-step-badge">Portal Catalog</span>
            <div className="onboarding-step-title">Automated Feeds</div>
            <div className="onboarding-step-desc">
              Activate automated scrapers from Himalayas, RemoteOK, Arbeitnow, and 30+ boards.
            </div>
          </div>
          <a
            href="/settings?tab=scrapers"
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            Configure Portals →
          </a>
        </div>
      </div>
    </div>
  );
};
