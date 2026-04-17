import Highcharts from 'highcharts';
import { useStore } from '../../store';
import { getAskColor, getBidColor } from '../../utils/colors';
import { Chart } from './Chart';

export interface PriceChartProps {
  symbol: string;
}

export function PriceChart({ symbol }: PriceChartProps): JSX.Element {
  const algorithm = useStore(state => state.algorithm)!;

  // series indices: 0=bids, 1=asks, 2=mid, 3=our orders, 4=our fills, 5=mkt buys, 6=mkt sells
  const bidData: any[] = [];
  const askData: any[] = [];
  const midData: any[] = [];
  const ourOrderData: any[] = [];
  const ourFillData: any[] = [];
  const mktBuyData: any[] = [];
  const mktSellData: any[] = [];

  for (const tick of algorithm.ticks) {
    const ts = tick.state.timestamp;
    const od = tick.state.order_depths[symbol];
    const actRow = algorithm.activityByTsAndProduct[ts]?.[symbol];
    const midPrice = actRow?.midPrice ?? null;

    // order book levels
    if (od) {
      for (const [priceStr, vol] of Object.entries(od.buy_orders)) {
        const price = Number(priceStr);
        const r = 3 + Math.min(Math.sqrt(Math.abs(vol as number)), 8);
        bidData.push({ x: ts, y: price, marker: { radius: r }, custom: { vol } });
      }
      for (const [priceStr, vol] of Object.entries(od.sell_orders)) {
        const price = Number(priceStr);
        const r = 3 + Math.min(Math.sqrt(Math.abs(vol as number)), 8);
        askData.push({ x: ts, y: price, marker: { radius: r }, custom: { vol } });
      }
    }

    // mid price line
    if (midPrice !== null) {
      midData.push([ts, midPrice]);
    }

    // our submitted orders
    const ourOrders = tick.orders[symbol] ?? [];
    for (const ord of ourOrders) {
      ourOrderData.push({
        x: ts,
        y: ord.price,
        custom: { qty: ord.quantity, side: ord.quantity > 0 ? 'BUY' : 'SELL' },
      });
    }

    // our fills (own_trades)
    const ownTrades = tick.state.own_trades[symbol] ?? [];
    for (const t of ownTrades) {
      ourFillData.push({
        x: ts,
        y: t.price,
        custom: { qty: t.quantity, buyer: t.buyer, seller: t.seller },
      });
    }

    // market trades — split buy/sell by relation to mid price
    const mktTrades = tick.state.market_trades[symbol] ?? [];
    for (const t of mktTrades) {
      const point = {
        x: ts,
        y: t.price,
        custom: { qty: t.quantity, buyer: t.buyer, seller: t.seller },
      };
      if (midPrice === null || t.price >= midPrice) {
        mktBuyData.push(point);
      } else {
        mktSellData.push(point);
      }
    }
  }

  const scatterBase: Partial<Highcharts.SeriesScatterOptions> = {
    type: 'scatter',
    turboThreshold: 0,
    dataGrouping: { enabled: false },
  } as any;

  const series: Highcharts.SeriesOptionsType[] = [
    {
      ...scatterBase,
      name: 'Bid levels',
      color: getBidColor(0.7),
      data: bidData,
      marker: { symbol: 'circle' },
      tooltip: {
        pointFormatter() {
          return `<b>Bid</b> price: ${this.y} vol: ${(this as any).custom?.vol}<br/>`;
        },
      },
    } as any,
    {
      ...scatterBase,
      name: 'Ask levels',
      color: getAskColor(0.7),
      data: askData,
      marker: { symbol: 'circle' },
      tooltip: {
        pointFormatter() {
          return `<b>Ask</b> price: ${this.y} vol: ${Math.abs((this as any).custom?.vol)}<br/>`;
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
    } as any,
    {
      ...scatterBase,
      name: 'Our orders',
      color: '#f5a623',
      data: ourOrderData,
      marker: { symbol: 'star', radius: 7 },
      tooltip: {
        pointFormatter() {
          const c = (this as any).custom;
          return `<b>${c?.side}</b> price: ${this.y} qty: ${Math.abs(c?.qty)}<br/>`;
        },
      },
    } as any,
    {
      ...scatterBase,
      name: 'Our fills',
      color: '#ff8c00',
      data: ourFillData,
      marker: { symbol: 'cross', radius: 7, lineWidth: 2, lineColor: '#ff8c00' },
      tooltip: {
        pointFormatter() {
          const c = (this as any).custom;
          return `<b>Fill</b> price: ${this.y} qty: ${c?.qty} B:${c?.buyer} S:${c?.seller}<br/>`;
        },
      },
    } as any,
    {
      ...scatterBase,
      name: 'Mkt buy',
      color: '#2ecc71',
      data: mktBuyData,
      marker: { symbol: 'triangle', radius: 5 },
      tooltip: {
        pointFormatter() {
          const c = (this as any).custom;
          return `<b>Mkt buy</b> price: ${this.y} qty: ${c?.qty} B:${c?.buyer} S:${c?.seller}<br/>`;
        },
      },
    } as any,
    {
      ...scatterBase,
      name: 'Mkt sell',
      color: '#e84393',
      data: mktSellData,
      marker: { symbol: 'triangle-down', radius: 5 },
      tooltip: {
        pointFormatter() {
          const c = (this as any).custom;
          return `<b>Mkt sell</b> price: ${this.y} qty: ${c?.qty} B:${c?.buyer} S:${c?.seller}<br/>`;
        },
      },
    } as any,
  ];

  return <Chart title={`${symbol} (price)`} series={series} />;
}
