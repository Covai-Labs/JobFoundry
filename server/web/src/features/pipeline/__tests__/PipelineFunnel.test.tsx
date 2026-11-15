import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { PipelineFunnel, FunnelData } from '../PipelineFunnel';
import { api } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  api: {
    getFunnelStats: vi.fn(),
  },
}));

describe('PipelineFunnel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockFunnelData: FunnelData = {
    total: 10,
    stages: [
      { id: 'captured', label: 'Captured', count: 10, conversionRate: 100 },
      { id: 'tailored', label: 'Tailored', count: 6, conversionRate: 60 },
      { id: 'applied', label: 'Applied', count: 3, conversionRate: 50 },
      { id: 'interview', label: 'Interview', count: 2, conversionRate: 66.7 },
      { id: 'offer', label: 'Offer', count: 1, conversionRate: 50 },
    ],
    by_status: {
      new: 4,
      tailored: 3,
      applied: 1,
      interview: 1,
      offer: 1,
    },
  };

  it('renders empty state when total is 0', () => {
    const emptyData: FunnelData = {
      total: 0,
      stages: [
        { id: 'captured', label: 'Captured', count: 0, conversionRate: 0 },
        { id: 'tailored', label: 'Tailored', count: 0, conversionRate: 0 },
        { id: 'applied', label: 'Applied', count: 0, conversionRate: 0 },
        { id: 'interview', label: 'Interview', count: 0, conversionRate: 0 },
        { id: 'offer', label: 'Offer', count: 0, conversionRate: 0 },
      ],
      by_status: {},
    };

    render(<PipelineFunnel data={emptyData} />);

    expect(screen.getByText(/Application Conversion Funnel/i)).toBeInTheDocument();
    expect(screen.getByText(/No applications recorded yet/i)).toBeInTheDocument();
  });

  it('renders 1 job properly without errors', () => {
    const singleJobData: FunnelData = {
      total: 1,
      stages: [
        { id: 'captured', label: 'Captured', count: 1, conversionRate: 100 },
        { id: 'tailored', label: 'Tailored', count: 0, conversionRate: 0 },
        { id: 'applied', label: 'Applied', count: 0, conversionRate: 0 },
        { id: 'interview', label: 'Interview', count: 0, conversionRate: 0 },
        { id: 'offer', label: 'Offer', count: 0, conversionRate: 0 },
      ],
      by_status: { new: 1 },
    };

    render(<PipelineFunnel data={singleJobData} />);

    expect(screen.getAllByText('Captured').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });

  it('renders multi-stage funnel with counts and conversion percentages', () => {
    render(<PipelineFunnel data={mockFunnelData} />);

    // Check headings and labels
    expect(screen.getByText('Application Conversion Funnel')).toBeInTheDocument();
    expect(screen.getAllByText('Captured').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tailored').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Applied').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Interview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Offer').length).toBeGreaterThan(0);

    // Check counts
    expect(screen.getByTestId('funnel-count-captured')).toHaveTextContent('10');
    expect(screen.getByTestId('funnel-count-tailored')).toHaveTextContent('6');
    expect(screen.getByTestId('funnel-count-applied')).toHaveTextContent('3');
    expect(screen.getByTestId('funnel-count-interview')).toHaveTextContent('2');
    expect(screen.getByTestId('funnel-count-offer')).toHaveTextContent('1');

    // Check conversion rate labels
    expect(screen.getAllByText('60%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('66.7%').length).toBeGreaterThan(0);

    // Check accessible summary table
    const table = screen.getByRole('table', { name: /conversion funnel breakdown/i });
    expect(table).toBeInTheDocument();
  });

  it('fetches funnel stats via API when data prop is omitted', async () => {
    (api.getFunnelStats as any).mockResolvedValue(mockFunnelData);

    render(<PipelineFunnel />);

    expect(screen.getByText(/Loading funnel metrics/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Application Conversion Funnel')).toBeInTheDocument();
    });

    expect(api.getFunnelStats).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('funnel-count-captured')).toHaveTextContent('10');
  });

  it('calls onStageClick callback when clicking a stage', () => {
    const handleStageClick = vi.fn();
    render(<PipelineFunnel data={mockFunnelData} onStageClick={handleStageClick} />);

    const tailoredStage = screen.getByTestId('funnel-stage-tailored');
    fireEvent.click(tailoredStage);

    expect(handleStageClick).toHaveBeenCalledWith('tailored');
  });
});
