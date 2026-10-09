'use client';

import { useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn, dayLabel } from '@/lib/utils';

/* Chart chrome follows the data-viz reference: recessive grid/axes, text in ink tokens, series in categorical slots. */
const axisProps = {
  tick: { fill: 'var(--chart-label)', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: 'var(--chart-axis)' },
} as const;

export interface Series {
  key: string;
  label: string;
  color: string; // CSS var, e.g. var(--chart-1)
  format?: (v: number) => string;
}

interface TooltipContentProps {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | null }[];
  label?: string | number;
  series: Series[];
  labelFormat: (l: string) => string;
}

function ChartTooltip({ active, payload, label, series, labelFormat }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-fg">{labelFormat(String(label))}</p>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        if (!s) return null;
        const v = p.value as number | null;
        return (
          <p key={s.key} className="flex items-center gap-2 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}: <span className="font-semibold text-fg tabular">{v === null || v === undefined ? '—' : s.format ? s.format(v) : v}</span>
          </p>
        );
      })}
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Wraps a chart with an optional table view (accessibility & exact values). */
export function ChartFrame({
  children,
  rows,
  series,
  height = 240,
  labelFormat = (l) => dayLabel(l),
  caption,
}: {
  children: ReactNode;
  rows: Record<string, unknown>[];
  series: Series[];
  height?: number;
  labelFormat?: (l: string) => string;
  caption: string;
}) {
  const [table, setTable] = useState(false);
  return (
    <figure className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Legend series={series} />
        <button onClick={() => setTable(!table)} className="ml-auto text-xs font-medium text-muted hover:text-fg" aria-pressed={table}>
          {table ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {table ? (
        <div className="max-h-64 overflow-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 bg-surface-2 text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 text-fg">{labelFormat(String(r.date))}</td>
                  {series.map((s) => {
                    const v = r[s.key] as number | null;
                    return (
                      <td key={s.key} className="px-3 py-1.5 text-right text-fg">
                        {v === null || v === undefined ? '—' : s.format ? s.format(v) : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} role="img" aria-label={caption}>
          {children}
        </div>
      )}
    </figure>
  );
}

export function DailyBarChart({
  data,
  series,
  height,
  caption,
  weekday,
  stacked,
}: {
  data: Record<string, unknown>[];
  series: Series[];
  height?: number;
  caption: string;
  weekday?: boolean;
  stacked?: boolean;
}) {
  const fmt = (l: string) => dayLabel(l, weekday ? 'weekday' : 'short');
  return (
    <ChartFrame rows={data} series={series} height={height} labelFormat={(l) => dayLabel(l)} caption={caption}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={data.length > 20 ? 2 : '25%'} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="date" tickFormatter={fmt} {...axisProps} interval="preserveStartEnd" minTickGap={12} />
          <YAxis allowDecimals={false} {...axisProps} axisLine={false} width={40} />
          <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTooltip series={series} labelFormat={(l) => dayLabel(l)} />} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={s.color}
              stackId={stacked ? 'a' : undefined}
              radius={stacked && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
              stroke={stacked ? 'var(--surface)' : undefined}
              strokeWidth={stacked ? 2 : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function DailyLineChart({
  data,
  series,
  height,
  caption,
  yDomain,
  yTicks,
  yTickFormat,
}: {
  data: Record<string, unknown>[];
  series: Series[];
  height?: number;
  caption: string;
  yDomain?: [number, number];
  yTicks?: number[];
  yTickFormat?: (v: number) => string;
}) {
  return (
    <ChartFrame rows={data} series={series} height={height} caption={caption}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="date" tickFormatter={(l) => dayLabel(l)} {...axisProps} interval="preserveStartEnd" minTickGap={16} />
          <YAxis domain={yDomain} ticks={yTicks} tickFormatter={yTickFormat} allowDecimals={false} {...axisProps} axisLine={false} width={yTickFormat ? 72 : 40} />
          <Tooltip cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} content={<ChartTooltip series={series} labelFormat={(l) => dayLabel(l)} />} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="linear"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Horizontal magnitude bars in HTML — label + value always visible, so color never carries meaning alone. */
export function BreakdownBars({ items, emptyLabel = 'No data yet' }: { items: { label: string; value: number; color?: string; icon?: ReactNode }[]; emptyLabel?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-subtle">{emptyLabel}</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="group" title={`${i.label}: ${i.value} (${Math.round((i.value / total) * 100)}%)`}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-fg">
              {i.icon}
              {i.label}
            </span>
            <span className="text-muted tabular">
              {i.value} <span className="text-subtle">· {Math.round((i.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-all group-hover:opacity-80" style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? 'var(--chart-1)' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 8-week activity heatmap — sequential single-hue blue ramp, weeks as columns. */
export function ActivityHeatmap({ days }: { days: { date: string; count: number; tasks: number; focusSessions: number }[] }) {
  const [hover, setHover] = useState<(typeof days)[number] | null>(null);
  const max = Math.max(1, ...days.map((d) => d.count));
  const level = (c: number) => (c === 0 ? 0 : Math.min(5, Math.ceil((c / max) * 5)));
  // Pad the start so columns align to weeks (Mon-first)
  const first = new Date(`${days[0]?.date}T12:00:00`);
  const pad = days.length ? (first.getDay() + 6) % 7 : 0;
  const cells: ((typeof days)[number] | null)[] = [...Array(pad).fill(null), ...days];
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div>
      <div className="flex gap-3">
        <div className="grid grid-rows-7 gap-1 pt-0 text-[10px] text-[var(--chart-label)]" aria-hidden>
          {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
            <span key={i} className="flex h-4 items-center sm:h-5">
              {d}
            </span>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1" role="grid" aria-label="Activity over the last 8 weeks">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-rows-7 gap-1" role="row">
              {Array.from({ length: 7 }).map((_, di) => {
                const d = week[di];
                if (!d) return <span key={di} className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />;
                return (
                  <span
                    key={di}
                    role="gridcell"
                    tabIndex={0}
                    aria-label={`${dayLabel(d.date)}: ${d.tasks} tasks completed, ${d.focusSessions} focus sessions`}
                    onMouseEnter={() => setHover(d)}
                    onFocus={() => setHover(d)}
                    onMouseLeave={() => setHover(null)}
                    onBlur={() => setHover(null)}
                    className={cn('h-4 w-4 rounded-[3px] sm:h-5 sm:w-5 outline-offset-1 transition-transform hover:scale-110', hover?.date === d.date && 'ring-2 ring-[var(--fg)]')}
                    style={{ background: `var(--seq-${level(d.count)})` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="min-h-4" aria-live="polite">
          {hover ? (
            <>
              <span className="font-medium text-fg">{dayLabel(hover.date)}</span> · {hover.tasks} tasks · {hover.focusSessions} focus sessions
            </>
          ) : (
            'Hover a day for details'
          )}
        </span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4, 5].map((l) => (
            <span key={l} className="h-3 w-3 rounded-[2px]" style={{ background: `var(--seq-${l})` }} aria-hidden />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

export function StatTile({ label, value, sub, icon, tone = 'default' }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: 'default' | 'danger' | 'success' }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && <span className="text-subtle">{icon}</span>}
      </div>
      <p className={cn('mt-2 text-2xl font-bold', tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-fg')}>{value}</p>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
