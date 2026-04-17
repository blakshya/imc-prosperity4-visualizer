import Highcharts from 'highcharts';
import { useStore } from '../../store';
import { Chart } from './Chart';

export interface ObservationChartProps {
  product: string;
}

export function ObservationChart({ product }: ObservationChartProps): JSX.Element {
  const algorithm = useStore(state => state.algorithm)!;

  const series: Highcharts.SeriesOptionsType[] = [
    {
      type: 'line',
      name: 'Value',
      data: algorithm.ticks.map(t => [t.state.timestamp, t.state.observations.plain[product] ?? null]),
    },
  ];

  return <Chart title={product} series={series} />;
}
