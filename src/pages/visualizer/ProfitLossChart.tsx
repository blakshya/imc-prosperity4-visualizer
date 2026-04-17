import Highcharts from 'highcharts';
import { useStore } from '../../store';
import { Chart } from './Chart';

export function ProfitLossChart(): JSX.Element {
  const algorithm = useStore(state => state.algorithm)!;

  const dataByTimestamp = new Map<number, number>();
  for (const row of algorithm.activityRows) {
    if (!dataByTimestamp.has(row.timestamp)) {
      dataByTimestamp.set(row.timestamp, row.profitLoss);
    } else {
      dataByTimestamp.set(row.timestamp, dataByTimestamp.get(row.timestamp)! + row.profitLoss);
    }
  }

  const series: Highcharts.SeriesOptionsType[] = [
    {
      type: 'line',
      name: 'Total',
      data: [...dataByTimestamp.keys()].map(ts => [ts, dataByTimestamp.get(ts)]),
    },
  ];

  for (const sym of algorithm.symbols) {
    const data: [number, number][] = [];
    for (const row of algorithm.activityRows) {
      if (row.product === sym) {
        data.push([row.timestamp, row.profitLoss]);
      }
    }
    series.push({ type: 'line', name: sym, data, dashStyle: 'Dash' });
  }

  return <Chart title="Profit / Loss" series={series} />;
}
