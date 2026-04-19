import Highcharts from 'highcharts/highstock';
import { formatNumber } from '../../utils/format';

export function onChartLoad(this: Highcharts.Chart): void {
  Highcharts.addEvent(this.tooltip, 'headerFormatter', (e: any) => {
    if (e.isFooter) {
      return true;
    }

    let timestamp = e.labelConfig.point.x;

    if (e.labelConfig.point.dataGroup) {
      const xData = e.labelConfig.series.xData;
      const lastTimestamp = xData[xData.length - 1];
      if (timestamp + 100 * e.labelConfig.point.dataGroup.length >= lastTimestamp) {
        timestamp = lastTimestamp;
      }
    }

    e.text = `Timestamp ${formatNumber(timestamp)}<br/>`;
    return false;
  });
}
