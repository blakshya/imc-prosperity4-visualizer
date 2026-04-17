import Highcharts from 'highcharts';
import { useStore } from '../../store';
import { Chart } from './Chart';

export function PositionChart(): JSX.Element {
  const algorithm = useStore(state => state.algorithm)!;

  const { symbols, ticks } = algorithm;

  // Derive position limit per symbol dynamically from observed positions
  const limits: Record<string, number> = {};
  for (const sym of symbols) {
    const positions = ticks.map(t => t.state.position[sym] ?? 0);
    const max = Math.max(...positions.map(Math.abs));
    limits[sym] = max > 0 ? max : 1;
  }

  const data: Record<string, [number, number][]> = {};
  for (const sym of symbols) {
    data[sym] = [];
  }

  for (const tick of ticks) {
    const ts = tick.state.timestamp;
    for (const sym of symbols) {
      const pos = tick.state.position[sym] ?? 0;
      data[sym].push([ts, (pos / limits[sym]) * 100]);
    }
  }

  const series: Highcharts.SeriesOptionsType[] = symbols.map(sym => ({
    type: 'line',
    name: sym,
    data: data[sym],
  }));

  return <Chart title="Positions (% of max observed)" series={series} min={-100} max={100} />;
}
