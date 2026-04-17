import {
  P4ActivityRow,
  P4Algorithm,
  P4ConversionObservation,
  P4InTickTrade,
  P4Listing,
  P4Observation,
  P4Order,
  P4OrderDepth,
  P4Tick,
  P4TradingState,
  P4TRADE,
} from '../models';

function getColumnValues(columns: string[], indices: number[]): number[] {
  const values: number[] = [];
  for (const index of indices) {
    const value = columns[index];
    if (value !== '') {
      values.push(Number(value));
    }
  }
  return values;
}

function remapTrades(rawTrades: any[][]): Record<string, P4InTickTrade[]> {
  // Wire format: [symbol, price, qty, buyer, seller, ts]
  const result: Record<string, P4InTickTrade[]> = {};
  for (const t of rawTrades) {
    const sym: string = t[0];
    if (!result[sym]) result[sym] = [];
    result[sym].push({
      symbol: sym,
      price: t[1],
      quantity: t[2],
      buyer: t[3],
      seller: t[4],
      timestamp: t[5],
    });
  }
  return result;
}

function remapOrders(rawOrders: any[][]): Record<string, P4Order[]> {
  // Wire format: [symbol, price, qty]
  const result: Record<string, P4Order[]> = {};
  for (const o of rawOrders) {
    const sym: string = o[0];
    if (!result[sym]) result[sym] = [];
    result[sym].push({ symbol: sym, price: o[1], quantity: o[2] });
  }
  return result;
}

function parseObservations(rawObs: any): P4Observation {
  if (!Array.isArray(rawObs) || rawObs.length < 2) {
    return { plain: {}, conversions: {} };
  }
  const plain: Record<string, number> = typeof rawObs[0] === 'object' && rawObs[0] !== null ? rawObs[0] : {};
  const conversions: Record<string, P4ConversionObservation> = {};
  const rawConv = rawObs[1];
  if (typeof rawConv === 'object' && rawConv !== null) {
    for (const [sym, arr] of Object.entries(rawConv as Record<string, any>)) {
      if (Array.isArray(arr) && arr.length >= 7) {
        conversions[sym] = {
          bidPrice: arr[0],
          askPrice: arr[1],
          transportFees: arr[2],
          exportTariff: arr[3],
          importTariff: arr[4],
          sugarPrice: arr[5],
          sunlightIndex: arr[6],
        };
      }
    }
  }
  return { plain, conversions };
}

export function parseYear4AlgorithmLogs(raw: string): P4Algorithm {
  const data = JSON.parse(raw);

  // ── activityRows ──────────────────────────────────────────────────────────
  const activityRows: P4ActivityRow[] = (data.activitiesLog as string)
    .split('\n')
    .filter((l: string) => l.trim() !== '' && l.split(';').length >= 17)
    .slice(1) // skip header
    .map((line: string) => {
      const cols = line.split(';');
      return {
        day: Number(cols[0]),
        timestamp: Number(cols[1]),
        product: cols[2],
        bidPrices: getColumnValues(cols, [3, 5, 7]),
        bidVolumes: getColumnValues(cols, [4, 6, 8]),
        askPrices: getColumnValues(cols, [9, 11, 13]),
        askVolumes: getColumnValues(cols, [10, 12, 14]),
        midPrice: Number(cols[15]),
        profitLoss: Number(cols[16]),
      };
    });

  // ── activityByTsAndProduct lookup ─────────────────────────────────────────
  const activityByTsAndProduct: Record<number, Record<string, P4ActivityRow>> = {};
  for (const row of activityRows) {
    if (!activityByTsAndProduct[row.timestamp]) {
      activityByTsAndProduct[row.timestamp] = {};
    }
    activityByTsAndProduct[row.timestamp][row.product] = row;
  }

  // ── ticks ─────────────────────────────────────────────────────────────────
  const ticks: P4Tick[] = [];
  for (let i = 0; i < data.logs.length; i++) {
    const tick = data.logs[i];
    let parsed: any;
    try {
      parsed = JSON.parse(tick.lambdaLog);
    } catch (e) {
      console.warn(`Skipped malformed lambdaLog at tick index ${i} (ts=${tick.timestamp}):`, e);
      continue;
    }

    const stateArr = parsed[0];
    const ordersArr = parsed[1];
    const conversions: number = parsed[2] ?? 0;
    const logsStr: string = parsed[4] ?? '';

    // listings
    const listings: Record<string, P4Listing> = {};
    for (const l of stateArr[2] ?? []) {
      listings[l[0]] = { symbol: l[0], product: l[1], denomination: l[2] };
    }

    // order_depths
    const rawOd = stateArr[3];
    if (typeof rawOd !== 'object' || rawOd === null) {
      throw new Error(`Tick ${i}: order_depths is not an object`);
    }
    const order_depths: Record<string, P4OrderDepth> = {};
    for (const [sym, sides] of Object.entries(rawOd as Record<string, any[]>)) {
      if (!Array.isArray(sides) || sides.length !== 2) {
        throw new Error(`Tick ${i}: order_depths[${sym}] malformed`);
      }
      order_depths[sym] = { buy_orders: sides[0], sell_orders: sides[1] };
    }

    const state: P4TradingState = {
      timestamp: stateArr[0],
      listings,
      order_depths,
      own_trades: remapTrades(stateArr[4] ?? []),
      market_trades: remapTrades(stateArr[5] ?? []),
      position: stateArr[6] ?? {},
      observations: parseObservations(stateArr[7] ?? [{}, {}]),
    };

    ticks.push({
      state,
      orders: remapOrders(ordersArr ?? []),
      conversions,
      logs: logsStr,
    });
  }

  if (activityRows.length === 0 || ticks.length === 0) {
    throw new Error('Year 4 log parsed to empty — check file format.');
  }

  // ── symbols ───────────────────────────────────────────────────────────────
  const symbols = Object.keys(ticks[0].state.listings).sort();

  // ── tradeHistory ──────────────────────────────────────────────────────────
  const tradeHistory: P4TRADE[] = (data.tradeHistory ?? []).map((t: any) => ({
    timestamp: t.timestamp,
    buyer: t.buyer,
    seller: t.seller,
    symbol: t.symbol,
    currency: t.currency,
    price: t.price,
    quantity: t.quantity,
  }));

  return {
    submissionId: data.submissionId ?? '',
    ticks,
    activityRows,
    tradeHistory,
    activityByTsAndProduct,
    symbols,
  };
}
