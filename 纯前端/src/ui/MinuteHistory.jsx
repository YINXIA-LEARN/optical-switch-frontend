import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { MINUTE_SECONDS, SECOND_MS, summarizeMinute } from '../analytics/aggregate.mjs';
import { dateText, numberText, secondText, shareText } from './history-format.mjs';
import ModuleHelp from './ModuleHelp.jsx';

const CHART_HEIGHT = 230;
const chartPadding = { left: 47, right: 32, top: 25, bottom: 32 };

function chartScale(points) {
  const peak = Math.max(1, ...points.flatMap(point => [point.optical, point.electric]));
  const target = peak / 4;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  return magnitude * [1, 2, 2.5, 5, 10].find(value => value * magnitude >= target);
}

function ThroughputChart({ summary }) {
  const chart = useRef(null);
  const [width, setWidth] = useState(700);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.floor(entry.contentRect.width))));
    observer.observe(chart.current);
    return () => observer.disconnect();
  }, []);
  const { left, right, top, bottom } = chartPadding;
  const plotHeight = CHART_HEIGHT - top - bottom;
  const plotWidth = width - left - right;
  const step = chartScale(summary.points);
  const x = seconds => left + seconds * plotWidth / MINUTE_SECONDS;
  const y = rate => top + (1 - rate / (step * 4)) * plotHeight;
  const path = medium => summary.points.map((point, index) =>
    `${index ? 'L' : 'M'}${x(index).toFixed(2)} ${y(point[medium]).toFixed(2)}`,
  ).join(' ');
  const axisSeconds = width < 430 ? [0, 30, 60] : [0, 15, 30, 45, 60];
  const last = summary.points.at(-1);

  return (
    <div class="throughput-chart" ref={chart}>
      <svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} role="img"
        aria-label="最近 60 秒的总吞吐，光为实线，电为虚线，单位 Gbit/s">
        <text class="chart-axis-unit" x="8" y="14">Gbit/s</text>
        {[0, 1, 2, 3, 4].map(index => {
          const value = index * step;
          return (
            <g key={index}>
              <line class="chart-gridline" x1={left} x2={width - right} y1={y(value)} y2={y(value)} />
              <text class="chart-axis-text" text-anchor="end" x={left - 8} y={y(value) + 4}>{numberText(value)}</text>
            </g>
          );
        })}
        {axisSeconds.map(second => (
          <text class="chart-axis-text" key={second} text-anchor="middle" x={x(second)} y={CHART_HEIGHT - 13}>
            {secondText(summary.startMs + second * SECOND_MS)}
          </text>
        ))}
        {summary.segments.slice(1).map(segment => {
          const cut = x((segment.startMs - summary.startMs) / SECOND_MS);
          const labelX = Math.min(Math.max(cut, left + 18), width - right - 18);
          return (
            <g key={segment.startMs} data-strategy-cut={segment.startMs}>
              <line class="chart-cut" x1={cut} x2={cut} y1={top} y2={y(0)} />
              <rect class="chart-cut-label" x={labelX - 17} y="3" width="34" height="17" rx="5" />
              <text class="chart-cut-text" text-anchor="middle" x={labelX} y="15">{`→ ${segment.strategyId}`}</text>
            </g>
          );
        })}
        <path class="chart-line chart-optical" data-trend="optical" d={path('optical')} />
        <path class="chart-line chart-electric" data-trend="electric" d={path('electric')} />
        <circle class="chart-optical-dot" cx={x(MINUTE_SECONDS - 1)} cy={y(last.optical)} r="3.7" />
        <circle class="chart-electric-dot" cx={x(MINUTE_SECONDS - 1)} cy={y(last.electric)} r="3.5" />
      </svg>
    </div>
  );
}

function Shares({ shares }) {
  return shares ? (
    <span class="history-shares">
      <span class="share-optical">光 {shareText(shares.optical)}</span>
      <span class="share-electric">电 {shareText(shares.electric)}</span>
    </span>
  ) : <span class="history-empty">无流量</span>;
}

function StrategyBreakdown({ segments }) {
  return (
    <div class="minute-strategies">
      <div class="help-heading"><h3>策略分段</h3>
        <ModuleHelp id="help-segments" label="策略分段">色带宽度表示策略在这 60 秒内持续的时间。每段的光、电百分比按该段累计传输量计算。</ModuleHelp>
      </div>
      <div class="strategy-strip" aria-label="策略段宽度代表持续秒数">
        {segments.map(({ startMs, strategyId, seconds }) => (
          <span key={startMs} style={{ flexGrow: seconds }} class={`strategy-band strategy-${strategyId}`}>
            {seconds >= 6 && strategyId}
          </span>
        ))}
      </div>
      <ul class="strategy-summary">
        {segments.map(({ strategyId, startMs, endMs, seconds, shares }) => (
          <li key={startMs} data-minute-segment={strategyId} data-seconds={seconds}
            data-start-ms={startMs} data-end-ms={endMs} data-optical-share={shares?.optical} data-electric-share={shares?.electric}>
            <div><b class={`strategy-token strategy-${strategyId}`}>{strategyId}</b><span>{secondText(startMs)}–{secondText(endMs)}</span><span>{seconds} 秒</span></div>
            <Shares shares={shares} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RackBar({ label, total, media, scale }) {
  const description = `${label} ${numberText(total)} Gbit/s，光路 ${numberText(media.optical)}，电路 ${numberText(media.electric)}`;
  return (
    <div class="rack-bar" role="img" aria-label={description} title={description}>
      <span class="rack-direction">{label}</span>
      <div class="rack-track">
        <i class="rack-optical" style={{ width: `${100 * media.optical / scale}%` }} />
        <i class="rack-electric" style={{ width: `${100 * media.electric / scale}%` }} />
      </div>
      <strong>{numberText(total)}</strong>
    </div>
  );
}

function RackRates({ summary, tors }) {
  const timeMs = summary.points.at(-1).timeMs;
  const names = new Map(tors.map(tor => [tor.id, tor.label]));
  const scale = Math.max(1, ...summary.rackRates.flatMap(rack => [rack.sent, rack.received]));
  return (
    <aside class="history-racks" aria-labelledby="history-rack-heading" data-sample-ms={timeMs}>
      <div class="history-subheading">
        <div class="help-heading"><h3 id="history-rack-heading">ToR 收发速率</h3>
          <ModuleHelp id="help-racks" label="ToR 收发速率">比较窗口最后一秒各机架的发送与接收。两根横条共用全图刻度，深蓝段为光路、青绿段为电路，右侧数字为合计速率。</ModuleHelp>
        </div>
        <time dateTime={new Date(timeMs).toISOString()}>{secondText(timeMs)}</time>
      </div>
      <div class="rack-legend">
        <span><i class="rack-optical" />光路</span><span><i class="rack-electric" />电路</span>
        <span class="rack-unit">Gbit/s</span>
      </div>
      <ul class="rack-groups">
        {summary.rackRates.map(({ id, sent, received, sentByMedium, receivedByMedium }) => (
          <li key={id} data-history-rack={id} data-sent={sent} data-received={received}>
            <b class="rack-name">{names.get(id)}</b>
            <div class="rack-bars">
              <RackBar label="发送" total={sent} media={sentByMedium} scale={scale} />
              <RackBar label="接收" total={received} media={receivedByMedium} scale={scale} />
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default function MinuteHistory({ sample }) {
  const lastOffset = sample.samples.length - MINUTE_SECONDS;
  const [{ offset, playing }, setPlayback] = useState({ offset: 0, playing: false });
  const summary = useMemo(() => summarizeMinute(sample.samples.slice(offset, offset + MINUTE_SECONDS), sample.rackIds), [sample, offset]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPlayback(current => {
        if (!current.playing) return current;
        const nextOffset = Math.min(current.offset + 1, lastOffset);
        return { offset: nextOffset, playing: nextOffset < lastOffset };
      });
    }, SECOND_MS);
    return () => window.clearInterval(timer);
  }, [playing, lastOffset]);

  function togglePlayback() {
    setPlayback(current => ({
      offset: !current.playing && current.offset === lastOffset ? 0 : current.offset,
      playing: !current.playing,
    }));
  }

  return (
    <section class="panel history-panel" aria-labelledby="minute-title" data-history-minute=""
      data-start-ms={summary.startMs} data-end-ms={summary.endMs} data-points={summary.points.length}
      data-optical-share={summary.shares?.optical} data-electric-share={summary.shares?.electric}>
      <div class="history-heading">
        <div>
          <div class="history-title"><h2 id="minute-title">分钟吞吐与 ToR 收发</h2>
            <ModuleHelp id="help-minute" label="分钟吞吐">实线和虚线分别显示最近 60 秒的光、电总速率。点击“播放样例”可每秒推进一次窗口，观察换路前后的变化。</ModuleHelp>
            <span class="history-badge">历史样例</span></div>
          <p>{dateText(summary.startMs)} · 上海时间 · <time>{secondText(summary.startMs)}</time>–<time>{secondText(summary.endMs)}</time></p>
        </div>
        <button type="button" class="history-button" onClick={togglePlayback}>
          <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span> {playing ? '暂停样例' : offset === lastOffset ? '重新播放' : '播放样例'}
        </button>
      </div>
      <div class="minute-layout">
        <div class="minute-main">
          <div class="chart-toolbar">
            <div class="chart-legend" aria-label="吞吐图例"><span class="optical-key">光吞吐</span><span class="electric-key">电吞吐</span></div>
            <div class="minute-share-line"><span>60 秒累计占比</span><Shares shares={summary.shares} /></div>
          </div>
          <ThroughputChart summary={summary} />
          <StrategyBreakdown segments={summary.segments} />
        </div>
        <RackRates summary={summary} tors={sample.tors} />
      </div>
    </section>
  );
}
