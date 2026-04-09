export function computeChartA11yLabel(
  data: Array<{ value: number }>,
  suffix: string,
  label: string,
): string {
  if (!data.length) return `${label}: no data`;
  const first = data[0].value;
  const last = data[data.length - 1].value;
  const direction = last > first ? 'increasing' : last < first ? 'decreasing' : 'stable';
  return `${label}: ${first}${suffix} to ${last}${suffix}, ${direction}`;
}
