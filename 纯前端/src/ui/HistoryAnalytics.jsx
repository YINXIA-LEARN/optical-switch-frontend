import { memo } from 'preact/compat';
import { useMemo } from 'preact/hooks';
import { createHistorySample } from '../analytics/sample.mjs';
import cluster8 from '../sim/cluster8.mjs';
import { defaultConfig } from '../sim/config.mjs';
import MinuteHistory from './MinuteHistory.jsx';
import StrategyMatrix from './StrategyMatrix.jsx';
import './history.css';

function HistoryAnalytics({ rackCount }) {
  const sample = useMemo(() => createHistorySample(rackCount === 8 ? cluster8 : defaultConfig), [rackCount]);
  return (
    <div class="history-analytics" key={rackCount}>
      <MinuteHistory sample={sample} />
      <StrategyMatrix sample={sample} />
    </div>
  );
}

export default memo(HistoryAnalytics);
