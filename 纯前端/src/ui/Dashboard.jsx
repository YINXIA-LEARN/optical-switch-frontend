import Topology from './Topology.jsx';
import './dashboard.css';

const clock = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function rankFlows(flows) {
  return [...flows].sort((a, b) => b.rate - a.rate || a.id.localeCompare(b.id, 'en'));
}

function Clock({ timeMs }) {
  const time = new Date(timeMs);
  return <time dateTime={time.toISOString()}>{clock.format(time)}</time>;
}

function Header({ tick, strategyId, timeMs }) {
  return (
    <header class="dashboard-header" data-view="header" data-tick={tick}>
      <div class="dashboard-brand">
        <span class="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 28 28" fill="none">
            <path d="M7 7h14v14H7zM7 7l14 14M21 7 7 21" stroke="currentColor" stroke-width="1.55" />
            <circle cx="7" cy="7" r="2.25" /><circle cx="21" cy="7" r="2.25" />
            <circle cx="7" cy="21" r="2.25" /><circle cx="21" cy="21" r="2.25" />
          </svg>
        </span>
        <div>
          <div class="title-line">
            <h1>光电网络总览</h1>
            <span class="simulation-tag"><i aria-hidden="true" />本地仿真</span>
          </div>
          <p>MEMS 每 10 秒切换光路</p>
        </div>
      </div>
      <dl class="telemetry">
        <div class="telemetry-strategy">
          <dt>当前策略</dt>
          <dd><span data-strategy={strategyId}>{strategyId}</span></dd>
        </div>
        <div class="telemetry-time">
          <dt>采样时间</dt>
          <dd><Clock timeMs={timeMs} /><span class="sample-index">第 {String(tick).padStart(2, '0')} 秒</span></dd>
        </div>
      </dl>
    </header>
  );
}

function Rates({ tick, flows, names }) {
  const ordered = rankFlows(flows);
  const active = ordered.filter(({ rate }) => rate > 0).length;
  const maxRate = ordered[0]?.rate || 1;
  return (
    <section class="panel rates" aria-labelledby="rates-heading" data-view="rates" data-tick={tick}>
      <div class="panel-heading">
        <h2 id="rates-heading">实时流量</h2>
        <span class="panel-meta"><b>{active}</b> 活跃 <span aria-hidden="true">/</span> {ordered.length} 条路径</span>
      </div>
      <div class="table-scroll" role="region" aria-label="有向路径速率，可纵向滚动" tabIndex={0}>
        <table>
          <thead>
            <tr><th scope="col">介质</th><th scope="col">源 → 目的</th><th scope="col">速率 <span>(Gbit/s)</span></th></tr>
          </thead>
          <tbody>
            {ordered.map(({ id, medium, src, dst, rate }) => (
              <tr key={id} data-path={id} data-rate={rate} class={rate === 0 ? 'idle-row' : ''}>
                <td><span class={`medium-tag ${medium}`}>{medium === 'optical' ? '光' : '电'}</span></td>
                <td class="flow-endpoints">{names.get(src)} <span>→</span> {names.get(dst)}</td>
                <td>
                  <span class="rate-cell">
                    <span class="rate-track" aria-hidden="true"><i style={{ width: `${rate / maxRate * 100}%` }} /></span>
                    <span>{rate}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Events({ tick, events, names }) {
  return (
    <section class="panel events" aria-labelledby="events-heading" data-view="events" data-tick={tick}>
      <div class="panel-heading">
        <h2 id="events-heading">策略事件</h2>
        <span class="panel-meta">已切换 {events.length} 次</span>
      </div>
      {events.length === 0
        ? <p class="events-empty">等待首次策略切换</p>
        : <ol class="event-list">
          {events.map(({ tick: eventTick, timeMs, from, to, pairs }) => (
            <li key={eventTick} data-event-tick={eventTick} data-from={from} data-to={to}>
              <span class="event-dot" aria-hidden="true" />
              <Clock timeMs={timeMs} />
              <strong>{from} → {to}</strong>
              <ul aria-label="新光路配对" class="event-pairs">
                {pairs.map(({ a, b }) => <li key={`${a}-${b}`} data-event-pair={`${a}-${b}`}>{names.get(a)} ↔ {names.get(b)}</li>)}
              </ul>
            </li>
          ))}
        </ol>}
    </section>
  );
}

export default function Dashboard({ snapshot }) {
  const { tick, strategyId, timeMs, tors, flows, events } = snapshot;
  const names = new Map(tors.map(({ id, label }) => [id, label]));
  return (
    <main class="dashboard">
      <Header tick={tick} strategyId={strategyId} timeMs={timeMs} />
      <div class="dashboard-grid">
        <Topology snapshot={snapshot} />
        <Rates tick={tick} flows={flows} names={names} />
        <Events tick={tick} events={events} names={names} />
      </div>
    </main>
  );
}
