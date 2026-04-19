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
      'Core/Globals.js': { theme: null },
      // 'Core/Defaults.js': { setOptions: () => {} },
    },
  };
  theme(highchartsMock as any);
  return highchartsMock._modules['Core/Globals.js'].theme! as Highcharts.Options;
}

export function PositionChart(): JSX.Element {
  const algorithm = useStore(state => state.algorithm)!;
  const theme = useMantineTheme();

  const options = useMemo((): Highcharts.Options => {
    const { symbols, precomputed } = algorithm;
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
      title: { text: 'Positions (% of max observed)' },
      credits: { href: 'javascript:window.open("https://www.highcharts.com/?credits", "_blank")' },
      xAxis: {
        type: 'datetime',
        title: { text: 'Timestamp' },
        crosshair: { width: 1 },
        labels: { formatter: params => formatNumber(params.value as number) },
      },
      yAxis: { opposite: false, allowDecimals: false, min: -100, max: 100 },
      tooltip: { split: false, shared: true, outside: true },
      legend: { enabled: true },
      rangeSelector: { enabled: false },
      navigator: { enabled: false },
      scrollbar: { enabled: false },
      series: symbols.map(sym => ({
        type: 'line' as const,
        name: sym,
        data: precomputed[sym].positionPctData,
        dataGrouping: { enabled: false },
      })),
    };

    return merge(themeOptions, chartOptions);
  }, [algorithm, theme]);

  return (
    <VisualizerCard p={0}>
      <HighchartsReact highcharts={Highcharts} constructorType={'stockChart'} options={options} />
    </VisualizerCard>
  );
}
