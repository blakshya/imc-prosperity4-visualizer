import { ColorScheme } from '@mantine/core';

export type Theme = ColorScheme | 'system';

// ── Raw file types (kept for parser use) ────────────────────────────────────

export interface TimestampLogRow {
  sandboxLog: string;
  lambdaLog: string;
  timestamp: number;
}

export interface P4TRADE {
  timestamp: number;
  buyer: string;
  seller: string;
  symbol: string;
  currency: string;
  price: number;
  quantity: number;
}

// ── P4 domain types (mirror datamodel.py) ───────────────────────────────────

export interface P4ConversionObservation {
  bidPrice: number;
  askPrice: number;
  transportFees: number;
  exportTariff: number;
  importTariff: number;
  sugarPrice: number;
  sunlightIndex: number;
}

export interface P4Observation {
  plain: Record<string, number>;
  conversions: Record<string, P4ConversionObservation>;
}

export interface P4Listing {
  symbol: string;
  product: string;
  denomination: string;
}

export interface P4Order {
  symbol: string;
  price: number;
  quantity: number;
}

export interface P4OrderDepth {
  buy_orders: Record<number, number>;
  sell_orders: Record<number, number>;
}

export interface P4InTickTrade {
  symbol: string;
  price: number;
  quantity: number;
  buyer: string;
  seller: string;
  timestamp: number;
}

export interface P4TradingState {
  timestamp: number;
  listings: Record<string, P4Listing>;
  order_depths: Record<string, P4OrderDepth>;
  own_trades: Record<string, P4InTickTrade[]>;
  market_trades: Record<string, P4InTickTrade[]>;
  position: Record<string, number>;
  observations: P4Observation;
}

export interface P4Tick {
  state: P4TradingState;
  orders: Record<string, P4Order[]>;
  conversions: number;
  logs: string;
}

export interface P4ActivityRow {
  day: number;
  timestamp: number;
  product: string;
  bidPrices: number[];
  bidVolumes: number[];
  askPrices: number[];
  askVolumes: number[];
  midPrice: number;
  profitLoss: number;
}

export interface P4ScatterPoint {
  x: number;
  y: number;
  custom?: Record<string, any>;
}

export interface P4PnlFit {
  slope: number;
  rSquared: number;
}

export interface P4PrecomputedSeries {
  // PriceChart scatter
  bidData: P4ScatterPoint[];
  askData: P4ScatterPoint[];
  // PriceChart lines
  midData: [number, number][];
  vwapData: [number, number][];
  microData: [number, number][];
  // PriceChart overlays
  ourOrderData: P4ScatterPoint[];
  ourFillData: P4ScatterPoint[];
  mktBuyData: P4ScatterPoint[];
  mktSellData: P4ScatterPoint[];
  // VolumeChart — indices 0/1/2 = levels 1/2/3
  bidVolumeSeries: [[number, number][], [number, number][], [number, number][]];
  askVolumeSeries: [[number, number][], [number, number][], [number, number][]];
  // OBIChart
  obiData: [number, number][];
  volData: [number, number][];
  // PositionPnLChart
  positionRawData: [number, number][];
  pnlData: [number, number][];
  pnlFit: P4PnlFit;
  // PositionChart (% of max observed)
  positionPctData: [number, number][];
}

export interface P4Algorithm {
  submissionId: string;
  ticks: P4Tick[];
  activityRows: P4ActivityRow[];
  tradeHistory: P4TRADE[];
  /** Pre-built O(1) lookup: ts → product → activity row */
  activityByTsAndProduct: Record<number, Record<string, P4ActivityRow>>;
  /** Sorted unique symbol list derived from ticks[0].state.listings */
  symbols: string[];
  /** Pre-computed series data per symbol */
  precomputed: Record<string, P4PrecomputedSeries>;
  /** Total PnL across all symbols per timestamp */
  totalPnlData: [number, number][];
  /** O(1) tick lookup by timestamp */
  tickByTimestamp: Map<number, P4Tick>;
}
