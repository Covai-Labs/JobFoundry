// Adapted from Dossier (https://github.com/AienTech/dossier)
// Copyright (c) AienTech. Licensed under GNU AGPL v3.0.
// Reimplemented for JobFoundry pipeline conversion analysis (Issue #152).
// Extended with furthest_stage Sankey breakdown (feat/furthest-stage-sankey-funnel).

import React, { useState, useRef, useEffect, type PointerEvent } from 'react';
import { api, type FunnelData, type FunnelStageData } from '../../api/client';
import { Filter, CheckCircle2 } from 'lucide-react';

export type { FunnelData, FunnelStageData } from '../../api/client';

export interface PipelineFunnelProps {
  data?: FunnelData;
  loading?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  onStageClick?: (stageId: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Geometry constants (SVG units; width stretches to card, y is pixels)
// ---------------------------------------------------------------------------
const WIDTH = 1000;
const NODE = 14; // width of each stage bar
const DROP = 18; // gap between the onward band and the first stopped node
const SLOT = 22; // minimum vertical space for a stopped node's label
const SPACE = 5; // gap between consecutive stopped nodes
const MAX_HEIGHT = 150; // tallest the first (Captured) bar can be
const MAX_UNIT = 18; // max pixels per application

// ---------------------------------------------------------------------------
// Colour palette — mirrors the existing STAGE_COLORS map
// ---------------------------------------------------------------------------
const STAGE_BAR_COLOR: Record<string, string> = {
  captured: 'var(--color-blue,  #3b82f6)',
  tailored: 'var(--color-purple,#8b5cf6)',
  applied: 'var(--color-cyan,  #06b6d4)',
  interview: 'var(--color-amber, #f59e0b)',
  offer: 'var(--color-green, #10b981)',
};

const STOPPED_COLOR: Record<string, string> = {
  open: 'inherit', // resolved at render time from stage colour
  auto_rejected: '#ef4444',
  invalid: '#6b7280',
  error: '#f97316',
  rejected: '#ef4444',
  archived: '#9ca3af',
};

function stageColor(id: string) {
  return STAGE_BAR_COLOR[id] ?? '#3b82f6';
}

function stoppedColor(stageId: string, outcome: string) {
  if (outcome === 'open') return stageColor(stageId);
  return STOPPED_COLOR[outcome] ?? '#6b7280';
}

const STOPPED_LABEL: Record<string, string> = {
  open: 'pending',
  auto_rejected: 'auto-rejected',
  invalid: 'invalid/noise',
  error: 'error',
  rejected: 'rejected',
  archived: 'archived',
};

// ---------------------------------------------------------------------------
// SVG path helpers (from Dossier)
// ---------------------------------------------------------------------------
function band(x0: number, y0: number, x1: number, y1: number, size: number): string {
  const mid = (x0 + x1) / 2;
  return `M${x0},${y0} C${mid},${y0} ${mid},${y1} ${x1},${y1} V${y1 + size} C${mid},${y1 + size} ${mid},${y0 + size} ${x0},${y0 + size} Z`;
}

function spine(x0: number, y0: number, x1: number, y1: number): string {
  const mid = (x0 + x1) / 2;
  return `M${x0},${y0} C${mid},${y0} ${mid},${y1} ${x1},${y1}`;
}

const col = (index: number, last: number) => (index * (WIDTH - NODE)) / last;
const pct = (x: number) => `${(x / WIDTH) * 100}%`;

// ---------------------------------------------------------------------------
// Layout engine — adapted from Dossier's layout()
// ---------------------------------------------------------------------------
interface StopNode {
  key: string;
  stageId: string;
  outcome: string;
  count: number;
  bandPath: string;
  spinePath: string;
  x: number;
  y: number;
  height: number;
  labelMid: number; // vertical centre of the slot for the label
}

function layout(stages: FunnelStageData[], unit: number) {
  const last = stages.length - 1;
  let svgHeight = stages[0].count * unit;
  const stops: StopNode[] = [];

  for (let i = 0; i < last; i++) {
    const stage = stages[i];
    const nextCount = stages[i + 1].count;
    const fromX = col(i, last) + NODE;
    const toX = (col(i, last) + col(i + 1, last)) / 2; // midpoint — where stopped nodes land

    let source = nextCount * unit; // top of the first stopped node
    let top = source + DROP;

    const stoppedEntries = Object.entries(stage.stopped ?? {}).filter(([, v]) => v > 0);
    for (const [outcome, count] of stoppedEntries) {
      const size = Math.max(2, count * unit);
      const slot = Math.max(size, SLOT);
      const y = top + (slot - size) / 2;

      stops.push({
        key: `${stage.id}-${outcome}`,
        stageId: stage.id,
        outcome,
        count,
        bandPath: band(fromX, source, toX, y, size),
        spinePath: spine(fromX, source + size / 2, toX, y + size / 2),
        x: toX,
        y,
        height: size,
        labelMid: top + slot / 2,
      });

      source += size;
      top += slot + SPACE;
      svgHeight = Math.max(svgHeight, top - SPACE);
    }
  }

  return { stops, svgHeight };
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------
interface TooltipData {
  color: string;
  value: number;
  text: string;
  detail: string;
}

const TOOLTIP_ROOM = 240;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const PipelineFunnel: React.FC<PipelineFunnelProps> = ({
  data: initialData,
  loading: initialLoading = false,
  onStageClick,
  className = '',
}) => {
  const [data, setData] = useState<FunnelData | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(initialLoading);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0, left: false });
  const pictureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      setError(null);
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
      .catch((err: unknown) => {
        if (isMounted) setError(err instanceof Error ? err.message : 'Failed to load funnel stats');
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
      <div className={`funnel-card ${className}`} style={cardStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--text-muted)',
          }}
        >
          <Filter size={18} className="animate-spin" />
          <span>Loading funnel metrics…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`funnel-card ${className}`}
        style={{ ...cardStyle, color: 'var(--color-red,#ef4444)' }}
      >
        <span>Error loading conversion funnel: {error}</span>
      </div>
    );
  }

  const funnelData = data ?? {
    total: 0,
    stages: [
      { id: 'captured', label: 'Captured', count: 0, conversionRate: 0, stopped: {} },
      { id: 'tailored', label: 'Tailored', count: 0, conversionRate: 0, stopped: {} },
      { id: 'applied', label: 'Applied', count: 0, conversionRate: 0, stopped: {} },
      { id: 'interview', label: 'Interview', count: 0, conversionRate: 0, stopped: {} },
      { id: 'offer', label: 'Offer', count: 0, conversionRate: 0, stopped: {} },
    ] as FunnelStageData[],
    by_status: {},
  };

  const stages = funnelData.stages;
  const total = funnelData.total;
  const last = stages.length - 1;

  const unit = total > 0 ? Math.min(MAX_UNIT, MAX_HEIGHT / total) : MAX_UNIT;
  const { stops, svgHeight } = total > 0 ? layout(stages, unit) : { stops: [], svgHeight: 60 };

  // Pointer tracking for tooltip
  const follow = (e: PointerEvent) => {
    const box = pictureRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = e.clientX - box.left;
    setPointer({ x, y: e.clientY - box.top, left: x > box.width - TOOLTIP_ROOM });
  };
  const hoverHandlers = (key: string) => ({
    onPointerEnter: (e: PointerEvent) => {
      setHovered(key);
      follow(e);
    },
    onPointerMove: follow,
    onPointerLeave: () => setHovered((c) => (c === key ? null : c)),
  });

  const bandOpacity = (key: string) => (hovered === null ? 0.32 : hovered === key ? 0.6 : 0.1);
  const nodeOpacity = (key: string) => (hovered === null || hovered === key ? 1 : 0.3);

  // Tooltip content
  const tooltip = ((): TooltipData | null => {
    if (hovered === null) return null;
    const stop = stops.find((s) => s.key === hovered);
    if (stop) {
      const stageLabel = stages.find((s) => s.id === stop.stageId)?.label ?? stop.stageId;
      return {
        color: stoppedColor(stop.stageId, stop.outcome),
        value: stop.count,
        text: STOPPED_LABEL[stop.outcome] ?? stop.outcome,
        detail: `at ${stageLabel.toLowerCase()}`,
      };
    }
    const idx = stages.findIndex((s) => `stage-${s.id}` === hovered);
    if (idx < 0) return null;
    const stage = stages[idx];
    const next = stages[idx + 1];
    return {
      color: stageColor(stage.id),
      value: stage.count,
      text: idx === 0 ? 'captured' : `reached ${stage.label.toLowerCase()}`,
      detail: next
        ? `${next.count} continued to ${next.label.toLowerCase()}`
        : `${stage.conversionRate}% conversion`,
    };
  })();

  return (
    <div className={`funnel-container ${className}`} style={cardStyle}>
      {/* Header */}
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
              color: 'var(--text-primary)',
            }}
          >
            <Filter size={18} style={{ color: 'var(--color-blue,#3b82f6)' }} />
            Application Conversion Funnel
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Track candidate pipeline throughput and identify where applications stall.
          </p>
        </div>
        {total > 0 && (
          <div
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <CheckCircle2 size={14} style={{ color: 'var(--color-green,#10b981)' }} />
            <span>{total} total applications</span>
          </div>
        )}
      </div>

      {total === 0 ? (
        <div
          style={{
            padding: '2.5rem 1rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            borderRadius: '8px',
            border: '1px dashed var(--border-subtle)',
            background: 'var(--bg-secondary)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            No applications recorded yet. Browse job listings with the extension or click{' '}
            <strong>Add Job</strong> to start building your pipeline.
          </p>
        </div>
      ) : (
        <>
          {/* Outer relative wrapper so tooltips are never clipped by overflowX: 'auto' */}
          <div ref={pictureRef} style={{ position: 'relative', marginBottom: '1.25rem' }}>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <div style={{ minWidth: 600 }}>
                {/* Stage labels row (scrolls together with chart) */}
                <div style={{ position: 'relative', height: 72 }}>
                  {stages.map((stage, i) => (
                    <div
                      key={stage.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        ...(i === last
                          ? { right: 0, textAlign: 'right' }
                          : { left: pct(col(i, last)) }),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {stage.label}
                      </span>
                      <span
                        style={{
                          fontSize: '1.4rem',
                          fontWeight: 700,
                          lineHeight: 1,
                          color: 'var(--text-primary)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {stage.count}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {i === 0 ? 'everything captured' : `${stage.conversionRate}% of prev.`}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Sankey SVG */}
                <div aria-hidden="true" style={{ position: 'relative' }}>
                  <svg
                    viewBox={`0 0 ${WIDTH} ${svgHeight}`}
                    preserveAspectRatio="none"
                    style={{
                      width: '100%',
                      height: svgHeight,
                      display: 'block',
                      overflow: 'visible',
                    }}
                  >
                    {/* Stage bars + onward bands */}
                    {stages.map((stage, i) => {
                      const key = `stage-${stage.id}`;
                      const size = Math.max(2, stage.count * unit);
                      const x = col(i, last);
                      const color = stageColor(stage.id);
                      return (
                        <g
                          key={stage.id}
                          style={{ cursor: onStageClick ? 'pointer' : 'default' }}
                          {...hoverHandlers(key)}
                          onClick={() => onStageClick?.(stage.id)}
                        >
                          {/* Onward band from previous stage to this one */}
                          {i > 0 && stage.count > 0 && (
                            <rect
                              x={col(i - 1, last) + NODE}
                              width={x - col(i - 1, last) - NODE}
                              height={size}
                              style={{
                                fill: color,
                                opacity: bandOpacity(key),
                                transition: 'opacity 0.2s',
                              }}
                            />
                          )}
                          {/* Stage node bar */}
                          {stage.count > 0 ? (
                            <rect
                              x={x}
                              width={NODE}
                              height={size}
                              rx={3}
                              style={{
                                fill: color,
                                opacity: nodeOpacity(key),
                                transition: 'opacity 0.2s',
                              }}
                            />
                          ) : (
                            <rect
                              x={x}
                              width={NODE}
                              height={2}
                              rx={1}
                              style={{ fill: 'var(--border-subtle,#e5e7eb)' }}
                            />
                          )}
                          {/* Wider invisible hit target */}
                          <rect
                            x={x - NODE / 2}
                            width={NODE * 2}
                            height={Math.max(size, 14)}
                            fill="transparent"
                          />
                        </g>
                      );
                    })}

                    {/* Stopped sub-bands */}
                    {stops.map((stop) => {
                      const color = stoppedColor(stop.stageId, stop.outcome);
                      return (
                        <g key={stop.key} {...hoverHandlers(stop.key)}>
                          <path
                            d={stop.bandPath}
                            style={{
                              fill: color,
                              opacity: bandOpacity(stop.key),
                              transition: 'opacity 0.2s',
                            }}
                          />
                          {/* Invisible thick spine for easy hover */}
                          <path
                            d={stop.spinePath}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={14}
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="stroke"
                          />
                          <rect
                            x={stop.x}
                            y={stop.y}
                            width={NODE}
                            height={Math.max(stop.height, 2)}
                            rx={2}
                            style={{
                              fill: color,
                              opacity: nodeOpacity(stop.key),
                              transition: 'opacity 0.2s',
                            }}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Stopped node labels */}
                  {stops.map((stop) => (
                    <span
                      key={stop.key}
                      {...hoverHandlers(stop.key)}
                      style={{
                        position: 'absolute',
                        left: `calc(${pct(stop.x + NODE)} + 6px)`,
                        top: stop.labelMid,
                        transform: 'translateY(-50%)',
                        fontSize: '0.72rem',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-muted)',
                        opacity: hovered !== null && hovered !== stop.key ? 0.4 : 1,
                        transition: 'opacity 0.2s',
                        pointerEvents: 'none',
                      }}
                    >
                      <span
                        style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {stop.count}
                      </span>{' '}
                      {STOPPED_LABEL[stop.outcome] ?? stop.outcome}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Tooltip rendered outside scroll container so vertical overflow is never clipped */}
            {tooltip && (
              <span
                style={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  zIndex: 10,
                  left: pointer.x,
                  top: pointer.y,
                  marginTop: -12,
                  transform: `translateY(-100%)${pointer.left ? ' translateX(-100%)' : ''}`,
                  marginLeft: pointer.left ? -12 : 12,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.78rem',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 2,
                      borderRadius: 2,
                      background: tooltip.color,
                    }}
                  />
                  <strong
                    style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}
                  >
                    {tooltip.value}
                  </strong>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{tooltip.text}</span>
                </span>
                <span style={{ display: 'block', color: 'var(--text-muted)', marginTop: 2 }}>
                  {tooltip.detail}
                </span>
              </span>
            )}
          </div>

          {/* Summary cards row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${stages.length}, 1fr)`,
              gap: '0.75rem',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '1rem',
            }}
          >
            {stages.map((stage, idx) => (
              <button
                type="button"
                key={stage.id}
                data-testid={`funnel-stage-${stage.id}`}
                onClick={() => onStageClick?.(stage.id)}
                disabled={!onStageClick}
                aria-label={`${stage.label}: ${stage.count} jobs, ${stage.conversionRate}% conversion rate`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  textAlign: 'left',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md,8px)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  cursor: onStageClick ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.25rem',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {stage.label}
                  </span>
                  <span
                    data-testid={`funnel-count-${stage.id}`}
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {stage.count}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {idx === 0 ? '100%' : `→ ${stage.conversionRate}% conv.`}
                </div>
              </button>
            ))}
          </div>

          {/* Accessible table (screen readers) */}
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
                <th scope="col">Stopped Outcomes</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => {
                const stoppedSummary = Object.entries(stage.stopped ?? {})
                  .filter(([, count]) => count > 0)
                  .map(([outcome, count]) => `${count} ${STOPPED_LABEL[outcome] ?? outcome}`)
                  .join(', ');
                return (
                  <tr key={stage.id}>
                    <td>{stage.label}</td>
                    <td>{stage.count}</td>
                    <td>{stage.conversionRate}%</td>
                    <td>{stoppedSummary || 'None'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  padding: '1.5rem',
  borderRadius: 'var(--radius-md,12px)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  marginBottom: '1.5rem',
};
