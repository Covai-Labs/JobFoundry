// Adapted from Dossier (https://github.com/AienTech/dossier)
// Copyright (c) AienTech. Licensed under GNU AGPL v3.0.
// Reimplemented for JobFoundry pipeline conversion analysis (Issue #152).

import React, { useState, useEffect } from 'react';
import { api, FunnelData, FunnelStageData } from '../../api/client';
import { Filter, ArrowRight, CheckCircle2 } from 'lucide-react';

export type { FunnelData, FunnelStageData };

export interface PipelineFunnelProps {
  data?: FunnelData;
  loading?: boolean;
  onStageClick?: (stageId: string) => void;
  className?: string;
}

const STAGE_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  captured: { bar: 'var(--color-blue, #3b82f6)', text: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  tailored: {
    bar: 'var(--color-purple, #8b5cf6)',
    text: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.12)',
  },
  applied: { bar: 'var(--color-cyan, #06b6d4)', text: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
  interview: {
    bar: 'var(--color-amber, #f59e0b)',
    text: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
  },
  offer: { bar: 'var(--color-green, #10b981)', text: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
};

/**
 * Generates an SVG path for a cubic-bezier connecting ribbon between two stage bars.
 */
function ribbonPath(
  x0: number,
  y0: number,
  h0: number,
  x1: number,
  y1: number,
  h1: number
): string {
  const mid = (x0 + x1) / 2;
  return `M ${x0} ${y0} C ${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1} L ${x1} ${y1 + h1} C ${mid} ${y1 + h1}, ${mid} ${y0 + h0}, ${x0} ${y0 + h0} Z`;
}

export const PipelineFunnel: React.FC<PipelineFunnelProps> = ({
  data: initialData,
  loading: initialLoading = false,
  onStageClick,
  className = '',
}) => {
  const [data, setData] = useState<FunnelData | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(initialLoading);
  const [error, setError] = useState<string | null>(null);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    api
      .getFunnelStats()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load funnel stats');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialData]);

  if (loading) {
    return (
      <div
        className={`funnel-card ${className}`}
        style={{
          padding: '1.5rem',
          borderRadius: '12px',
          background: 'var(--bg-card, #18181b)',
          border: '1px solid var(--border-color, #27272a)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--text-muted, #a1a1aa)',
          }}
        >
          <Filter size={18} className="animate-spin" />
          <span>Loading funnel metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`funnel-card ${className}`}
        style={{
          padding: '1.5rem',
          borderRadius: '12px',
          background: 'var(--bg-card, #18181b)',
          border: '1px solid var(--border-color, #27272a)',
          color: 'var(--color-red, #ef4444)',
        }}
      >
        <span>Error loading conversion funnel: {error}</span>
      </div>
    );
  }

  const funnelData = data || {
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

  const stages = funnelData.stages;
  const total = funnelData.total;

  // Geometry for SVG layout
  const SVG_WIDTH = 900;
  const SVG_HEIGHT = 140;
  const BAR_WIDTH = 14;
  const STAGE_COUNT = stages.length;
  const PADDING_X = 50;
  const AVAILABLE_WIDTH = SVG_WIDTH - PADDING_X * 2;
  const STEP_X = AVAILABLE_WIDTH / (STAGE_COUNT - 1);
  const BASE_Y = 20;
  const MAX_BAR_HEIGHT = 90;
  const MIN_BAR_HEIGHT = 8;

  // Calculate coordinates for each stage bar
  const stageCoords = stages.map((stage, idx) => {
    const x = PADDING_X + idx * STEP_X;
    const fraction = total > 0 ? stage.count / total : 0;
    const height =
      stage.count === 0 ? MIN_BAR_HEIGHT : Math.max(MIN_BAR_HEIGHT, fraction * MAX_BAR_HEIGHT);
    const y = BASE_Y + (MAX_BAR_HEIGHT - height) / 2;
    return { x, y, height, stage };
  });

  return (
    <div
      className={`funnel-container ${className}`}
      style={{
        padding: '1.5rem',
        borderRadius: '12px',
        background: 'var(--bg-card, #18181b)',
        border: '1px solid var(--border-color, #27272a)',
        marginBottom: '1.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-primary, #f4f4f5)',
            }}
          >
            <Filter size={18} style={{ color: 'var(--color-blue, #3b82f6)' }} />
            Application Conversion Funnel
          </h3>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-muted, #a1a1aa)',
              margin: '0.25rem 0 0 0',
            }}
          >
            Track candidate pipeline throughput and identify where applications stall.
          </p>
        </div>
        {total > 0 && (
          <div
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted, #a1a1aa)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <CheckCircle2 size={14} style={{ color: 'var(--color-green, #10b981)' }} />
            <span>{total} total applications</span>
          </div>
        )}
      </div>

      {total === 0 ? (
        <div
          style={{
            padding: '2.5rem 1rem',
            textAlign: 'center',
            color: 'var(--text-muted, #a1a1aa)',
            borderRadius: '8px',
            border: '1px dashed var(--border-color, #27272a)',
            background: 'rgba(255, 255, 255, 0.01)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            No applications recorded yet. Browse job listings with the extension or click{' '}
            <strong>Add Job</strong> to start building your pipeline.
          </p>
        </div>
      ) : (
        <>
          {/* SVG Stream / Funnel Visualization */}
          <div style={{ width: '100%', overflowX: 'auto', marginBottom: '1.25rem' }}>
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              style={{ width: '100%', minWidth: '600px', height: 'auto', display: 'block' }}
              aria-hidden="true"
            >
              <defs>
                {stages.map((stage, idx) => {
                  if (idx === stages.length - 1) return null;
                  const nextStage = stages[idx + 1];
                  const c0 = STAGE_COLORS[stage.id]?.text || '#3b82f6';
                  const c1 = STAGE_COLORS[nextStage.id]?.text || '#10b981';
                  return (
                    <linearGradient
                      key={`grad-${stage.id}`}
                      id={`funnel-grad-${stage.id}`}
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor={c0} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={c1} stopOpacity={0.25} />
                    </linearGradient>
                  );
                })}
              </defs>

              {/* Connecting Ribbons between stages */}
              {stageCoords.map((coord, idx) => {
                if (idx === stageCoords.length - 1) return null;
                const nextCoord = stageCoords[idx + 1];
                const d = ribbonPath(
                  coord.x + BAR_WIDTH,
                  coord.y,
                  coord.height,
                  nextCoord.x,
                  nextCoord.y,
                  nextCoord.height
                );
                return (
                  <path
                    key={`ribbon-${coord.stage.id}`}
                    d={d}
                    fill={`url(#funnel-grad-${coord.stage.id})`}
                    style={{ transition: 'opacity 0.2s ease' }}
                  />
                );
              })}

              {/* Stage Nodes & Labels */}
              {stageCoords.map((coord) => {
                const colors = STAGE_COLORS[coord.stage.id] || STAGE_COLORS.captured;
                const isHovered = hoveredStage === coord.stage.id;
                return (
                  <g
                    key={`node-${coord.stage.id}`}
                    style={{ cursor: onStageClick ? 'pointer' : 'default' }}
                    onMouseEnter={() => setHoveredStage(coord.stage.id)}
                    onMouseLeave={() => setHoveredStage(null)}
                    onClick={() => onStageClick?.(coord.stage.id)}
                  >
                    {/* Node Bar */}
                    <rect
                      x={coord.x}
                      y={coord.y}
                      width={BAR_WIDTH}
                      height={coord.height}
                      rx={4}
                      fill={colors.bar}
                      opacity={isHovered ? 1 : 0.85}
                      style={{ transition: 'opacity 0.15s, transform 0.15s' }}
                    />

                    {/* Stage Name above bar */}
                    <text
                      x={coord.x + BAR_WIDTH / 2}
                      y={BASE_Y - 6}
                      textAnchor="middle"
                      fill="var(--text-muted, #a1a1aa)"
                      fontSize="12"
                      fontWeight="500"
                    >
                      {coord.stage.label}
                    </text>

                    {/* Count below bar */}
                    <text
                      x={coord.x + BAR_WIDTH / 2}
                      y={BASE_Y + MAX_BAR_HEIGHT + 18}
                      textAnchor="middle"
                      fill="var(--text-primary, #f4f4f5)"
                      fontSize="13"
                      fontWeight="600"
                    >
                      {coord.stage.count}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Stepped Conversion Summary Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${stages.length}, 1fr)`,
              gap: '0.75rem',
              borderTop: '1px solid var(--border-color, #27272a)',
              paddingTop: '1rem',
            }}
          >
            {stages.map((stage, idx) => {
              const colors = STAGE_COLORS[stage.id] || STAGE_COLORS.captured;
              const isFirst = idx === 0;
              return (
                <div
                  key={stage.id}
                  data-testid={`funnel-stage-${stage.id}`}
                  onClick={() => onStageClick?.(stage.id)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: 'var(--bg-subtle, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                    cursor: onStageClick ? 'pointer' : 'default',
                    transition: 'border-color 0.15s, transform 0.15s',
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
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: colors.text,
                      }}
                    >
                      {stage.label}
                    </span>
                    <span
                      data-testid={`funnel-count-${stage.id}`}
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: 'var(--text-primary, #f4f4f5)',
                      }}
                    >
                      {stage.count}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted, #a1a1aa)',
                    }}
                  >
                    {!isFirst && <ArrowRight size={12} />}
                    <span>{stage.conversionRate}%</span>
                    {!isFirst && <span style={{ opacity: 0.65 }}>conv.</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Accessible Table for Screen Readers & Tabular Scanning */}
          <table
            className="sr-only"
            aria-label="Conversion funnel breakdown"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
            }}
          >
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col">Count</th>
                <th scope="col">Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <tr key={stage.id}>
                  <td>{stage.label}</td>
                  <td>{stage.count}</td>
                  <td>{stage.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};
