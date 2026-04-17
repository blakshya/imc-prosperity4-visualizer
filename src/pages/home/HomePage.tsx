import { Container, Stack, Text } from '@mantine/core';
import { HomeCard } from './HomeCard';
import { LoadFromElsewhere } from './LoadFromElsewhere';
import { LoadFromFile } from './LoadFromFile';

export function HomePage(): JSX.Element {
  return (
    <Container>
      <Stack mb="md">
        <HomeCard title="IMC Prosperity 4 Visualizer">
          {/* prettier-ignore */}
          <Text>
            Visualizer for <a href={`https://prosperity.imc.com/`} target="_blank" rel="noreferrer">IMC Prosperity 4</a> algorithms.
            Load a <code>.log</code> file (JSON format) below to get started.
          </Text>
        </HomeCard>

        <LoadFromFile />
        {/* <LoadFromElsewhere /> */}
      </Stack>
    </Container>
  );
}
