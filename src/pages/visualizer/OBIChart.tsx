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

export function OBIChart({ symbol }: { symbol: string }): JSX.Element {
  const algorithm = useStore(state => state.algorithm)!;
  const theme = useMantineTheme();

  const options = useMemo((): Highcharts.Options => {
    const { obiData, volData } = algorithm.precomputed[symbol];
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
      title: { text: `${symbol} (OBI / volatility)` },
      xAxis: {
        type: 'datetime',
        title: { text: 'Timestamp' },
        crosshair: { width: 1 },
        labels: { formatter: params => formatNumber(params.value as number) },
      },
      yAxis: [
        { title: { text: 'OBI' }, min: -1, max: 1, opposite: false },
        { title: { text: 'Volatility (σ)' }, opposite: true },
      ],
      tooltip: { split: false, shared: false, outside: true },
      legend: { enabled: true },
      rangeSelector: { enabled: false },
      navigator: { enabled: false },
      scrollbar: { enabled: false },
      series: [
        {
          type: 'line',
          name: 'OBI',
          yAxis: 0,
          data: obiData,
          turboThreshold: 0,
          dataGrouping: { enabled: false },
          zones: [{ value: 0, color: '#e84393' }, { color: '#2ecc71' }],
        } as any,
        {
          type: 'line',
          name: 'Volatility',
          yAxis: 1,
          color: '#f39c12',
          data: volData,
          turboThreshold: 0,
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
