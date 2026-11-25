import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IngestionProgressBar } from '../IngestionProgressBar';
import { useExtensionBridge } from '../useExtensionBridge';

describe('IngestionProgressBar', () => {
  it('renders nothing when scanState is null or bannerDismissed is true', () => {
    const { container: c1 } = render(
      <IngestionProgressBar scanState={null} bannerDismissed={false} onDismiss={vi.fn()} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <IngestionProgressBar
        scanState={{
          inProgress: true,
          type: 'search',
          statusMessage: 'Searching...',
        }}
        bannerDismissed={true}
        onDismiss={vi.fn()}
      />
    );
    expect(c2.firstChild).toBeNull();
  });

  it('renders in-progress status with active keyword and spinner', () => {
    render(
      <IngestionProgressBar
        scanState={{
          inProgress: true,
          type: 'search',
          statusMessage: 'Searching "Healthcare Data Analyst" (2/18)...',
          currentTerm: 'Healthcare Data Analyst',
        }}
        bannerDismissed={false}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Searching "Healthcare Data Analyst" (2/18)...')).toBeInTheDocument();
    expect(screen.getByText('Healthcare Data Analyst')).toBeInTheDocument();
  });

  it('renders completed success state with refresh feed button', () => {
    const onRefresh = vi.fn();
    const onDismiss = vi.fn();

    render(
      <IngestionProgressBar
        scanState={{
          inProgress: false,
          type: 'search',
          statusMessage: '✓ Ingestion complete: 5 new job(s) ingested',
          newIngested: 5,
          completedAt: Date.now(),
        }}
        bannerDismissed={false}
        onDismiss={onDismiss}
        onRefreshFeed={onRefresh}
      />
    );

    expect(screen.getByText('✓ Ingestion complete: 5 new job(s) ingested')).toBeInTheDocument();

    const refreshBtn = screen.getByRole('button', { name: /Refresh Feed/i });
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalled();

    const dismissBtn = screen.getByRole('button', { name: /Dismiss scan status/i });
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('useExtensionBridge', () => {
  it('reports extension not detected if triggered when unavailable', () => {
    localStorage.clear();
    sessionStorage.clear();
    const { result } = renderHook(() => useExtensionBridge());

    act(() => {
      result.current.triggerSearchBoards();
    });

    expect(result.current.scanState?.inProgress).toBe(false);
    expect(result.current.scanState?.statusMessage).toContain('not detected');
  });

  it('posts search and scan messages to window when triggered', () => {
    localStorage.setItem('jf_extension_paired', 'true');
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    const onRefresh = vi.fn();

    const { result } = renderHook(() => useExtensionBridge(onRefresh));

    act(() => {
      result.current.triggerSearchBoards();
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'JOBFOUNDRY_SEARCH_BOARDS_REQUEST' }),
      window.location.origin
    );
    expect(result.current.scanState?.inProgress).toBe(true);
    expect(result.current.scanState?.type).toBe('search');

    act(() => {
      result.current.triggerScanPortals();
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'JOBFOUNDRY_SCAN_PORTALS_REQUEST' }),
      window.location.origin
    );
    expect(result.current.scanState?.inProgress).toBe(true);
    expect(result.current.scanState?.type).toBe('scan');

    postMessageSpy.mockRestore();
  });

  it('ignores messages from untrusted origins', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => useExtensionBridge(onRefresh));

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.example.com',
          data: {
            type: 'JOBFOUNDRY_SCAN_STATE_UPDATE',
            state: { inProgress: true, type: 'search', statusMessage: 'Compromised' },
          },
        })
      );
    });

    expect(result.current.scanState?.statusMessage).not.toBe('Compromised');
  });
});
