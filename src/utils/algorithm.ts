import {
  ActivityLogRow,
  Algorithm,
  AlgorithmSummary,
  CompressedOrder,
  CompressedSandboxLogRow,
  CompressedTrade,
  CompressedTradingState,
  Listing,
  Order,
  OrderDepth,
  ProsperitySymbol,
  SandboxLogRow,
  Trade,
  TradingState,
} from '../models';
import { createAxios } from './axios';

export async function downloadAlgorithmResults(algorithmId: string): Promise<void> {
  const axios = createAxios();

  const detailsResponse = await axios.get(
    `https://bz97lt8b1e.execute-api.eu-west-1.amazonaws.com/prod/results/tutorial/${algorithmId}`,
  );

  const resultsUrl = JSON.parse(detailsResponse.data).algo.summary.activitiesLog;

  const link = document.createElement('a');
  link.href = resultsUrl;
  link.download = 'results.csv';
  link.target = '_blank';
  link.rel = 'noreferrer';

  document.body.appendChild(link);
  link.click();
  link.remove();
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

function getActivityLogs(logLines: string[]): ActivityLogRow[] {
  const headerIndex = logLines.indexOf('Activities log:');
  if (headerIndex === -1) {
    return [];
  }

  const rows: ActivityLogRow[] = [];

  for (let i = headerIndex + 2; i < logLines.length; i++) {
    const columns = logLines[i].split(';');
    rows.push({
      day: Number(columns[0]),
      timestamp: Number(columns[1]),
      product: columns[2],
      bidPrices: getColumnValues(columns, [3, 5, 7]),
      bidVolumes: getColumnValues(columns, [4, 6, 8]),
      askPrices: getColumnValues(columns, [9, 11, 13]),
      askVolumes: getColumnValues(columns, [10, 12, 14]),
      midPrice: Number(columns[15]),
      profitLoss: Number(columns[16]),
    });
  }

  return rows;
}

function decompressTrades(compressed: CompressedTrade[]): Record<ProsperitySymbol, Trade[]> {
  const trades: Record<ProsperitySymbol, Trade[]> = {};

  for (const trade of compressed) {
    if (trades[trade[0]] === undefined) {
      trades[trade[0]] = [];
    }

    trades[trade[0]].push({
      symbol: trade[0],
      buyer: trade[1],
      seller: trade[2],
      price: trade[3],
      quantity: trade[4],
      timestamp: trade[5],
    });
  }

  return trades;
}

function decompressState(compressed: CompressedTradingState): TradingState {
  const listings: Record<ProsperitySymbol, Listing> = {};
  for (const listing of compressed.l) {
    listings[listing[0]] = {
      symbol: listing[0],
      product: listing[1],
      denomination: listing[2],
    };
  }

  const order_depths: Record<ProsperitySymbol, OrderDepth> = {};
  for (const symbol of Object.keys(compressed.od)) {
    order_depths[symbol] = {
      buy_orders: compressed.od[symbol][0],
      sell_orders: compressed.od[symbol][1],
    };
  }

  return {
    timestamp: compressed.t,
    listings,
    order_depths,
    own_trades: decompressTrades(compressed.ot),
    market_trades: decompressTrades(compressed.mt),
    position: compressed.p,
    observations: compressed.o,
  };
}

function decompressOrders(compressed: CompressedOrder[]): Record<ProsperitySymbol, Order[]> {
  const orders: Record<ProsperitySymbol, Order[]> = {};

  for (const order of compressed) {
    if (orders[order[0]] === undefined) {
      orders[order[0]] = [];
    }

    orders[order[0]].push({
      symbol: order[0],
      price: order[1],
      quantity: order[2],
    });
  }

  return orders;
}

function decompressSandboxLogRow(compressed: CompressedSandboxLogRow): SandboxLogRow {
  return {
    state: decompressState(compressed.state),
    orders: decompressOrders(compressed.orders),
    logs: compressed.logs,
  };
}

function getSandboxLogs(logLines: string[]): SandboxLogRow[] {
  const headerIndex = logLines.indexOf('Sandbox logs:');
  if (headerIndex === -1) {
    return [];
  }

  const rows: SandboxLogRow[] = [];
  for (let i = headerIndex + 1; i < logLines.length; i++) {
    const line = logLines[i];
    if (line.endsWith(':')) {
      break;
    }

    let unparsed: string;
    if (line.startsWith('{')) {
      unparsed = line;
    } else {
      if (line.length === 0 || line.endsWith(' ') || !/\d/.test(line[0])) {
        continue;
      }

      unparsed = line.substring(line.indexOf(' ') + 1);
    }

    if (!unparsed.startsWith('{"logs":"')) {
      continue;
    }

    try {
      const parsed = JSON.parse(unparsed);

      let row: SandboxLogRow;
      if (parsed.state.t !== undefined) {
        row = decompressSandboxLogRow(parsed);
      } else {
        row = parsed;
      }

      rows.push(row);
    } catch (err) {
      console.error(err);
      throw new Error('Sandbox logs are in invalid format, please see the prerequisites section above.');
    }
  }

  return rows;
}

function getSubmissionLogs(logLines: string[]): string {
  const headerIndex = logLines.indexOf('Submission logs:');
  if (headerIndex === -1) {
    return '';
  }

  const lines = [];
  for (let i = headerIndex + 1; i < logLines.length; i++) {
    if (logLines[i].endsWith(':')) {
      break;
    }

    lines.push(logLines[i]);
  }

  return lines.join('\n').trimEnd();
}

export function parseYear4AlgorithmLogs(raw: string): Algorithm {
  const data = JSON.parse(raw);

  const activityLogs: ActivityLogRow[] = data.activitiesLog
    .split('\n')
    .filter((l: string) => l.trim() !== '' && l.split(';').length >= 17)
    .slice(1)
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

  function remapTrades(rawTrades: any[][]): Record<ProsperitySymbol, Trade[]> {
    const result: Record<ProsperitySymbol, Trade[]> = {};
    for (const t of rawTrades) {
      if (!result[t[0]]) result[t[0]] = [];
      result[t[0]].push({ symbol: t[0], price: t[1], quantity: t[2], buyer: t[3], seller: t[4], timestamp: t[5] });
    }
    return result;
  }

  const sandboxLogs: SandboxLogRow[] = [];
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
    const logsStr = parsed[4] ?? '';

    const listings: Record<ProsperitySymbol, Listing> = {};
    for (const l of stateArr[2]) {
      listings[l[0]] = { symbol: l[0], product: l[1], denomination: l[2] };
    }

    const rawOd = stateArr[3];
    if (typeof rawOd !== 'object' || rawOd === null) {
      throw new Error(`Tick ${i}: order_depths is not an object`);
    }
    const order_depths: Record<ProsperitySymbol, OrderDepth> = {};
    for (const [sym, sides] of Object.entries(rawOd as Record<string, any[]>)) {
      if (!Array.isArray(sides) || sides.length !== 2) {
        throw new Error(`Tick ${i}: order_depths[${sym}] malformed`);
      }
      order_depths[sym] = { buy_orders: sides[0], sell_orders: sides[1] };
    }

    const state: TradingState = {
      timestamp: stateArr[0],
      listings,
      order_depths,
      own_trades: remapTrades(stateArr[4] ?? []),
      market_trades: remapTrades(stateArr[5] ?? []),
      position: stateArr[6] ?? {},
      observations: {},
    };

    sandboxLogs.push({
      state,
      orders: decompressOrders(ordersArr),
      logs: logsStr,
    });
  }

  if (activityLogs.length === 0 || sandboxLogs.length === 0) {
    throw new Error('Year 4 log parsed to empty — check file format.');
  }

  return { activityLogs, sandboxLogs, submissionLogs: '' };
}

export function parseAlgorithmLogs(logs: string, summary?: AlgorithmSummary): Algorithm {
  const logLines = logs.trim().split('\n');

  const activityLogs = getActivityLogs(logLines);
  const sandboxLogs = getSandboxLogs(logLines);
  const submissionLogs = getSubmissionLogs(logLines);

  if (activityLogs.length === 0 || sandboxLogs.length === 0) {
    throw new Error('Sandbox logs are in invalid format, please see the prerequisites section above.');
  }

  return {
    summary,
    activityLogs,
    sandboxLogs,
    submissionLogs,
  };
}
