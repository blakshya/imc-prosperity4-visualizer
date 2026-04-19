import { useMantineTheme } from '@mantine/core';
import Highcharts from 'highcharts/highstock';
import HighchartsHighContrastDarkTheme from 'highcharts/themes/high-contrast-dark';
import HighchartsReact from 'highcharts-react-official';
import merge from 'lodash/merge';
import { useMemo } from 'react';
import { useStore } from '../../store';
import { getAskColor, getBidColor } from '../../utils/colors';
import { formatNumber } from '../../utils/format';
import { onChartLoad } from './chartHelpers';
import { VisualizerCard } from './VisualizerCard';

function getThemeOptions(theme: (highcharts: typeof Highcharts) => void): Highcharts.Options {
  const highchartsMock = {
    _modules: {
      'Core/Globals.js': { theme: null },
      // 'Core/Defaults.js': { setOptions: () => {} },
    },
  };
  theme(highchartsMock as any);
  return highchartsMock._modules['Core/Globals.js'].theme! as Highcharts.Options;
}

export interface VolumeChartProps {
  symbol: string;
}

export function VolumeChart({ symbol }: VolumeChartProps): JSX.Element {
  const algorithm = useStore(state => state.algorithm)!;
  const theme = useMantineTheme();

  const options = useMemo((): Highcharts.Options => {
    const { bidVolumeSeries, askVolumeSeries } = algorithm.precomputed[symbol];
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
      title: { text: `${symbol} (volume)` },
      credits: { href: 'javascript:window.open("https://www.highcharts.com/?credits", "_blank")' },
      xAxis: {
        type: 'datetime',
        title: { text: 'Timestamp' },
        crosshair: { width: 1 },
        labels: { formatter: params => formatNumber(params.value as number) },
      },
      yAxis: { opposite: false, allowDecimals: false },
      tooltip: { split: false, shared: true, outside: true },
      legend: { enabled: true },
      rangeSelector: { enabled: false },
      navigator: { enabled: false },
      scrollbar: { enabled: false },
      series: [
        { type: 'column', name: 'Bid 3', color: getBidColor(0.5), data: bidVolumeSeries[2] },
        { type: 'column', name: 'Bid 2', color: getBidColor(0.75), data: bidVolumeSeries[1] },
        { type: 'column', name: 'Bid 1', color: getBidColor(1.0), data: bidVolumeSeries[0] },
        { type: 'column', name: 'Ask 1', color: getAskColor(1.0), data: askVolumeSeries[0] },
        { type: 'column', name: 'Ask 2', color: getAskColor(0.75), data: askVolumeSeries[1] },
        { type: 'column', name: 'Ask 3', color: getAskColor(0.5), data: askVolumeSeries[2] },
      ] as any,
    };

    return merge(themeOptions, chartOptions);
  }, [algorithm, symbol, theme]);

  return (
    <VisualizerCard p={0}>
      <HighchartsReact highcharts={Highcharts} constructorType={'stockChart'} options={options} />
    </VisualizerCard>
  );
}
