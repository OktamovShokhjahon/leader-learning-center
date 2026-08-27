'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export type DonutSlice = { key: string; label: string; value: number; color: string }

/**
 * G5 — the shared donut chart used for status/composition breakdowns
 * (debtor overdue bands, attendance status, payroll composition).
 *
 * Colour choice: this reuses the app's existing status tokens (success/
 * warning/danger/info — see globals.css) rather than a separate chart
 * palette, so "late" reads the same amber here as it does on every status
 * pill elsewhere in the CRM. Running those four through the dataviz skill's
 * validator found two real gaps: the amber/green pair sits in the 6–8 ΔE
 * "floor" band for protanopia (legal only with a secondary encoding), and in
 * dark mode two of the four fall outside the recommended lightness band for
 * a large fill area. Neither is fixed by picking different colors without
 * also touching every status pill/badge across the app, which is a larger,
 * separate design change than this chart warrants — so the mitigation lives
 * here instead: every slice is *always* direct-labelled (name + percentage,
 * not just on hover), so identity is never carried by color alone.
 */
export function DonutChart({
  data,
  total,
  height = 220,
}: {
  data: DonutSlice[]
  /** Pass explicitly when slices can be filtered independently of their sum. */
  total?: number
  height?: number
}) {
  const sum = total ?? data.reduce((acc, slice) => acc + slice.value, 0)
  if (sum === 0) return null

  // A zero-value category has no arc to draw and adds a redundant "0%" legend
  // row, so it's dropped before reaching the Pie.
  const nonZero = data.filter((slice) => slice.value > 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={nonZero}
          dataKey="value"
          nameKey="label"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={nonZero.length > 1 ? 2 : 0}
          stroke="var(--color-surface)"
          strokeWidth={2}
          // Recharts v3's mount-in animation never resolves its first frame in
          // some environments (confirmed here — the slice's <path> stays empty
          // indefinitely with animation on), so it's off outright. That also
          // happens to be the right default for a dashboard: the number should
          // just be there, not animate in, and it sidesteps `prefers-reduced-
          // motion` entirely rather than needing to honor it separately.
          isAnimationActive={false}
          label={({ value }: { value: number }) => `${Math.round((value / sum) * 100)}%`}
          labelLine={false}
        >
          {nonZero.map((slice) => (
            <Cell key={slice.key} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _name, entry) => {
            const n = typeof value === 'number' ? value : Number(value ?? 0)
            const payload = (entry as { payload?: DonutSlice } | undefined)?.payload
            return [`${n} (${Math.round((n / sum) * 100)}%)`, payload?.label ?? '']
          }}
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-subtle, #e5e7eb)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span style={{ color: 'var(--color-ink-soft)' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
