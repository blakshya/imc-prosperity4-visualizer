import { Slider, SliderProps, Text } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useState } from 'react';
import { useStore } from '../../store';
import { formatNumber } from '../../utils/format';
import { SandboxLogDetail } from './SandboxLogDetail';
import { VisualizerCard } from './VisualizerCard';

export function SandboxLogsCard(): JSX.Element {
  const algorithm = useStore(state => state.algorithm)!;

  const { ticks, tickByTimestamp } = algorithm;

  const timestampMin = ticks[0].state.timestamp;
  const timestampMax = ticks[ticks.length - 1].state.timestamp;
  const timestampStep = ticks.length > 1 ? ticks[1].state.timestamp - ticks[0].state.timestamp : 100;

  const [timestamp, setTimestamp] = useState(timestampMin);

  const marks: SliderProps['marks'] = [];
  for (let i = timestampMin; i < timestampMax; i += (timestampMax + 100) / 4) {
    marks.push({ value: i, label: formatNumber(i) });
  }

  useHotkeys([
    ['ArrowLeft', () => setTimestamp(timestamp === timestampMin ? timestamp : timestamp - timestampStep)],
    ['ArrowRight', () => setTimestamp(timestamp === timestampMax ? timestamp : timestamp + timestampStep)],
  ]);

  const currentTick = tickByTimestamp.get(timestamp);

  return (
    <VisualizerCard title="Sandbox logs">
      <Slider
        min={timestampMin}
        max={timestampMax}
        step={timestampStep}
        marks={marks}
        label={value => `Timestamp ${formatNumber(value)}`}
        value={timestamp}
        onChange={setTimestamp}
        mb="lg"
      />

      {currentTick ? (
        <SandboxLogDetail tick={currentTick} />
      ) : (
        <Text>No logs found for timestamp {formatNumber(timestamp)}</Text>
      )}
    </VisualizerCard>
  );
}
