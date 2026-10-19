/**
 * Thins a sparkline's month labels to at most `max`, always keeping the
 * first and the last (current) one and spacing the rest evenly. Display
 * only — labels are not data points.
 */
export function pickSparklineLabels<T>(labels: readonly T[], max = 4): T[] {
  if (labels.length <= max) return [...labels];
  if (max < 2) return max === 1 ? [labels[labels.length - 1]] : [];
  const picked = new Set<number>();
  for (let i = 0; i < max; i++) picked.add(Math.round((i * (labels.length - 1)) / (max - 1)));
  return [...picked].sort((a, b) => a - b).map((index) => labels[index]);
}
