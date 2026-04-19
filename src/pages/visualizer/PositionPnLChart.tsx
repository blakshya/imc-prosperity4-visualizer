import { useMantineTheme } from '@mantine/core';
import Highcharts from 'highcharts/highstock';
import HighchartsHighContrastDarkTheme from 'highcharts/themes/high-contrast-dark';
import HighchartsReact from 'highcharts-react-official';
import merge from 'lodash/merge';
import { useMemo } from 'react';
import { useStore } from '../../store';
import { formatNumber } from '../../utils/format';
import { onChartLoad } from './chartHelpers';
import { VisualizerCard } from './VisualizerCard';

function getThemeOptions(theme: (highcharts: typeof Highcharts) => void): Highcharts.Options {
  const highchartsMock = {
    _modules: {
      'Core/Globals.js': {
        theme: null,
      },
      'Core/Defaults.js': {
        setOptions: () => {
          // Do nothing
        },
      },
    },
  };

  theme(highchartsMock as any);

  return highchartsMock._modules['Core/Globals.js'].theme! as Highcharts.Options;
}

export function PositionPnLChart({ symbol }: { symbol: string }): JSX.Element {
  const algorithm = useStore(state => state.algorithm)!;
  const theme = useMantineTheme();

  const options = useMemo((): Highcharts.Options => {
    const { positionRawData, pnlData } = algorithm.precomputed[symbol];
    const themeOptions = theme.colorScheme === 'light' ? {} : getThemeOptions(HighchartsHighContrastDarkTheme);
    const chartOptions: Highcharts.Options = {
      chart: {
        animation: false,
        height: 400,
        zooming: { type: 'x' },
        panning: { enabled: true, type: 'x' },
        panKey: 'shift',
        numberFormatter: formatNumber,
        events: { load: onChartLoad },
      },
      title: { text: `${symbol} (position + PnL)` },
      xAxis: {
        type: 'datetime',
        title: { text: 'Timestamp' },
        crosshair: { width: 1 },
        labels: { formatter: params => formatNumber(params.value as number) },
      },
      yAxis: [
        {
          title: { text: 'Position (raw)' },
          opposite: false,
          plotLines: [{ value: 0, color: '#888888', dashStyle: 'Dash', width: 1 }],
        },
        { title: { text: 'PnL' }, opposite: true },
      ],
      tooltip: { split: false, shared: false, outside: true },
      legend: { enabled: true },
      rangeSelector: { enabled: false },
      navigator: { enabled: false },
      scrollbar: { enabled: false },
      series: [
        {
          type: 'line',
          name: 'Position',
          yAxis: 0,
          data: positionRawData,
          color: '#3498db',
          dataGrouping: { enabled: false },
        } as any,
        {
          type: 'line',
          name: 'PnL',
          yAxis: 1,
          data: pnlData,
          color: '#2ecc71',
          dashStyle: 'Dash',
          dataGrouping: { enabled: false },
        } as any,
      ],
    };
    return merge(themeOptions, chartOptions);
  }, [algorithm, symbol, theme]);

  return (
    <VisualizerCard p={0}>
      <HighchartsReact highcharts={Highcharts} constructorType={'stockChart'} options={options} />
    </VisualizerCard>
  );
}
