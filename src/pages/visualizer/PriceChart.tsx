import { useMantineTheme } from '@mantine/core';
import Highcharts from 'highcharts/highstock';
import HighchartsBoost from 'highcharts/modules/boost';
import HighchartsHighContrastDarkTheme from 'highcharts/themes/high-contrast-dark';
import HighchartsReact from 'highcharts-react-official';
import merge from 'lodash/merge';
import { useMemo } from 'react';
import { useStore } from '../../store';
import { getAskColor, getBidColor } from '../../utils/colors';
import { formatNumber } from '../../utils/format';
import { onChartLoad } from './chartHelpers';
import { VisualizerCard } from './VisualizerCard';

HighchartsBoost(Highcharts);

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

export interface PriceChartProps {
  symbol: string;
}

export function PriceChart({ symbol }: PriceChartProps): JSX.Element {
  const algorithm = useStore(state => state.algorithm)!;
  const theme = useMantineTheme();

  const options = useMemo((): Highcharts.Options => {
    const { bidData, askData, midData, vwapData, microData, ourOrderData, ourFillData, mktBuyData, mktSellData } =
      algorithm.precomputed[symbol];

    const themeOptions = theme.colorScheme === 'light' ? {} : getThemeOptions(HighchartsHighContrastDarkTheme);

    const scatterBase = {
      type: 'scatter' as const,
      turboThreshold: 0,
      dataGrouping: { enabled: false },
      boostThreshold: 1,
    };

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
      boost: { enabled: true },
      title: { text: `${symbol} (price)` },
      credits: { href: 'javascript:window.open("https://www.highcharts.com/?credits", "_blank")' },
      xAxis: {
        type: 'datetime',
        title: { text: 'Timestamp' },
        crosshair: { width: 1 },
        labels: { formatter: params => formatNumber(params.value as number) },
      },
      yAxis: { opposite: false, allowDecimals: false },
      tooltip: { split: false, shared: false, outside: true },
      legend: { enabled: true },
      rangeSelector: { enabled: false },
      navigator: { enabled: false },
      scrollbar: { enabled: false },
      series: [
        {
          ...scatterBase,
          name: 'Bid levels',
          color: getBidColor(0.7),
          data: bidData,
          marker: { symbol: 'circle', radius: 3 },
          tooltip: {
            pointFormatter(): string {
              return `<b>Bid</b> price: ${(this as any).y} vol: ${(this as any).custom?.vol}<br/>`;
            },
          },
        } as any,
        {
          ...scatterBase,
          name: 'Ask levels',
          color: getAskColor(0.7),
          data: askData,
          marker: { symbol: 'circle', radius: 3 },
          tooltip: {
            pointFormatter(): string {
              return `<b>Ask</b> price: ${(this as any).y} vol: ${Math.abs((this as any).custom?.vol)}<br/>`;
            },
          },
        } as any,
        {
          type: 'line',
          name: 'Mid price',
          color: '#888888',
          dashStyle: 'Dash',
          data: midData,
          marker: { enabled: false },
          dataGrouping: { enabled: false },
          boostThreshold: 0,
        } as any,
        {
          type: 'line',
          name: 'VWAP',
          color: '#9b59b6',
          data: vwapData,
          marker: { enabled: false },
          dataGrouping: { enabled: false },
          boostThreshold: 0,
        } as any,
        {
          type: 'line',
          name: 'Micro-price',
          color: '#1abc9c',
          dashStyle: 'Dash',
          data: microData,
          marker: { enabled: false },
          dataGrouping: { enabled: false },
          boostThreshold: 0,
        } as any,
        {
          ...scatterBase,
          name: 'Our orders',
          color: '#f5a623',
          data: ourOrderData,
          marker: { symbol: 'star', radius: 7 },
          boostThreshold: 0,
          tooltip: {
            pointFormatter(): string {
              const c = (this as any).custom;
              return `<b>${c?.side}</b> price: ${(this as any).y} qty: ${Math.abs(c?.qty)}<br/>`;
            },
          },
        } as any,
        {
          ...scatterBase,
          name: 'Our fills',
          color: '#ff8c00',
          data: ourFillData,
          marker: { symbol: 'cross', radius: 7, lineWidth: 2, lineColor: '#ff8c00' },
          boostThreshold: 0,
          tooltip: {
            pointFormatter(): string {
              const c = (this as any).custom;
              return `<b>Fill</b> price: ${(this as any).y} qty: ${c?.qty} B:${c?.buyer} S:${c?.seller}<br/>`;
            },
          },
        } as any,
        {
          ...scatterBase,
          name: 'Mkt buy',
          color: '#2ecc71',
          data: mktBuyData,
          marker: { symbol: 'triangle', radius: 5 },
          boostThreshold: 0,
          tooltip: {
            pointFormatter(): string {
              const c = (this as any).custom;
              return `<b>Mkt buy</b> price: ${(this as any).y} qty: ${c?.qty} B:${c?.buyer} S:${c?.seller}<br/>`;
            },
          },
        } as any,
        {
          ...scatterBase,
          name: 'Mkt sell',
          color: '#e84393',
          data: mktSellData,
          marker: { symbol: 'triangle-down', radius: 5 },
          boostThreshold: 0,
          tooltip: {
            pointFormatter(): string {
              const c = (this as any).custom;
              return `<b>Mkt sell</b> price: ${(this as any).y} qty: ${c?.qty} B:${c?.buyer} S:${c?.seller}<br/>`;
            },
          },
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
