import {
  P4ActivityRow,
  P4Algorithm,
  P4ConversionObservation,
  P4InTickTrade,
  P4Listing,
  P4Observation,
  P4Order,
  P4OrderDepth,
  P4PrecomputedSeries,
  P4ScatterPoint,
  P4Tick,
  P4TradingState,
  P4TRADE,
} from '../models';

function computePnlFit(points: [number, number][]): { slope: number; rSquared: number } {
  const n = points.length;

  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of points) {
    sumX += x;
    sumY += y;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0;
  let denominator = 0;
  for (const [x, y] of points) {
    const dx = x - meanX;
    numerator += dx * (y - meanY);
    denominator += dx * dx;
  }

  const slope = numerator / denominator;

  let ssRes = 0;
  let ssTot = 0;
  for (const [x, y] of points) {
    const yHat = meanY + slope * (x - meanX);
    ssRes += (y - yHat) ** 2;
    ssTot += (y - meanY) ** 2;
  }

  const rSquared = 1 - ssRes / ssTot;
  return { slope, rSquared };
}

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

function remapTrades(rawTrades: any[][], timestamp: number): Record<string, P4InTickTrade[]> {
  // Wire format: [symbol, price, qty, buyer, seller, ts]
  const result: Record<string, P4InTickTrade[]> = {};
  for (const t of rawTrades) {
    const sym: string = t[0];
    if (!result[sym]) result[sym] = [];
    if (t[5] < timestamp - 200) continue; // Filter trades to only include those in the current tick
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

    const stateArr = parsed[0]; // TradingState
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
    const timestamp = stateArr[0];
    const state: P4TradingState = {
      timestamp,
      listings,
      order_depths,
      own_trades: remapTrades(stateArr[4] ?? [], timestamp),
      market_trades: remapTrades(stateArr[5] ?? [], timestamp),
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

  // ── PRECOMPUTE ────────────────────────────────────────────────────────────

  // 1. Rolling volatility (N=20) per symbol from activityRows
  const N_VOL = 20;
  const symRowsMap: Record<string, P4ActivityRow[]> = {};
  for (const row of activityRows) {
    if (!symRowsMap[row.product]) symRowsMap[row.product] = [];
    symRowsMap[row.product].push(row);
  }
  const volDataBySym: Record<string, [number, number][]> = {};
  for (const [sym, rows] of Object.entries(symRowsMap)) {
    const vol: [number, number][] = [];
    for (let i = N_VOL - 1; i < rows.length; i++) {
      const window = rows.slice(i - N_VOL + 1, i + 1).map(r => r.midPrice);
      const mean = window.reduce((a, b) => a + b, 0) / N_VOL;
      const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / N_VOL;
      vol.push([rows[i].timestamp, Math.sqrt(variance)]);
    }
    volDataBySym[sym] = vol;
  }

  // 2. PnL per symbol + total from activityRows
  const pnlBySym: Record<string, [number, number][]> = {};
  const totalPnlMap = new Map<number, number>();
  for (const row of activityRows) {
    if (!pnlBySym[row.product]) pnlBySym[row.product] = [];
    pnlBySym[row.product].push([row.timestamp, row.profitLoss]);
    totalPnlMap.set(row.timestamp, (totalPnlMap.get(row.timestamp) ?? 0) + row.profitLoss);
  }
  const totalPnlData: [number, number][] = [...totalPnlMap.entries()].map(([ts, v]) => [ts, v]);

  // 3. Position limits for % normalization
  const posLimits: Record<string, number> = {};
  for (const sym of symbols) {
    const positions = ticks.map(t => Math.abs(t.state.position[sym] ?? 0));
    posLimits[sym] = Math.max(...positions, 1);
  }

  // 4. Init precomputed per symbol
  const precomputed: Record<string, P4PrecomputedSeries> = {};
  const cumulPV: Record<string, number> = {};
  const cumulV: Record<string, number> = {};
  for (const sym of symbols) {
    const pnlData = pnlBySym[sym] ?? [];
    precomputed[sym] = {
      bidData: [],
      askData: [],
      midData: [],
      vwapData: [],
      microData: [],
      ourOrderData: [],
      ourFillData: [],
      mktBuyData: [],
      mktSellData: [],
      bidVolumeSeries: [[], [], []],
      askVolumeSeries: [[], [], []],
      obiData: [],
      volData: volDataBySym[sym] ?? [],
      positionRawData: [],
      positionPctData: [],
      pnlData,
      pnlFit: computePnlFit(pnlData),
    };
    cumulPV[sym] = 0;
    cumulV[sym] = 0;
  }

  // 5. Single pass over ticks
  for (const tick of ticks) {
    const ts = tick.state.timestamp;
    for (const sym of symbols) {
      const pc = precomputed[sym];
      const od = tick.state.order_depths[sym];
      const act = activityByTsAndProduct[ts]?.[sym];
      const midPrice = act?.midPrice ?? null;

      // order book scatter (all levels)
      if (od) {
        for (const [priceStr, vol] of Object.entries(od.buy_orders)) {
          pc.bidData.push({ x: ts, y: Number(priceStr), custom: { vol } });
        }
        for (const [priceStr, vol] of Object.entries(od.sell_orders)) {
          pc.askData.push({ x: ts, y: Number(priceStr), custom: { vol } });
        }
      }

      if (midPrice !== null) pc.midData.push([ts, midPrice]);

      // VWAP (running cumulative)
      for (const t of tick.state.market_trades[sym] ?? []) {
        cumulPV[sym] += t.price * Math.abs(t.quantity);
        cumulV[sym] += Math.abs(t.quantity);
      }
      if (cumulV[sym] > 0) pc.vwapData.push([ts, cumulPV[sym] / cumulV[sym]]);

      // micro-price
      if (act && act.bidPrices.length > 0 && act.askPrices.length > 0) {
        const pBid = act.bidPrices[0],
          vBid = act.bidVolumes[0];
        const pAsk = act.askPrices[0],
          vAsk = Math.abs(act.askVolumes[0]);
        const denom = vBid + vAsk;
        if (denom > 0) pc.microData.push([ts, (vAsk * pBid + vBid * pAsk) / denom]);
      }

      // OBI
      if (act) {
        const vBid = act.bidVolumes[0] ?? 0;
        const vAsk = Math.abs(act.askVolumes[0] ?? 0);
        const denom = vBid + vAsk;
        if (denom > 0) pc.obiData.push([ts, (vBid - vAsk) / denom]);
      }

      // volume chart (3 levels)
      if (act) {
        for (let i = 0; i < 3; i++) {
          if (i < act.bidVolumes.length) pc.bidVolumeSeries[i].push([ts, act.bidVolumes[i]]);
          if (i < act.askVolumes.length) pc.askVolumeSeries[i].push([ts, act.askVolumes[i]]);
        }
      }

      // our orders
      for (const ord of tick.orders[sym] ?? []) {
        pc.ourOrderData.push({
          x: ts,
          y: ord.price,
          custom: { qty: ord.quantity, side: ord.quantity > 0 ? 'BUY' : 'SELL' },
        });
      }

      // our fills
      for (const t of tick.state.own_trades[sym] ?? []) {
        pc.ourFillData.push({ x: ts, y: t.price, custom: { qty: t.quantity, buyer: t.buyer, seller: t.seller } });
      }

      // market trades
      for (const t of tick.state.market_trades[sym] ?? []) {
        const pt: P4ScatterPoint = { x: ts, y: t.price, custom: { qty: t.quantity, buyer: t.buyer, seller: t.seller } };
        if (midPrice === null || t.price >= midPrice) pc.mktBuyData.push(pt);
        else pc.mktSellData.push(pt);
      }

      // position
      const pos = tick.state.position[sym] ?? 0;
      pc.positionRawData.push([ts, pos]);
      pc.positionPctData.push([ts, (pos / posLimits[sym]) * 100]);
    }
  }

  const tickByTimestamp = new Map(ticks.map(t => [t.state.timestamp, t]));

  return {
    submissionId: data.submissionId ?? '',
    ticks,
    activityRows,
    tradeHistory,
    activityByTsAndProduct,
    symbols,
    precomputed,
    totalPnlData,
    tickByTimestamp,
  };
}
