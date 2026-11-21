import { useState } from 'preact/hooks';
import { dateText, minuteText, numberText, shareText } from './history-format.mjs';
import ModuleHelp from './ModuleHelp.jsx';

function StrategyTimeline({ matrices, selected, select }) {
  const boundaryTimes = [...matrices.map(matrix => matrix.startMs), matrices.at(-1).endMs];
  return (
    <div class="history-timeline">
      <div class="timeline-nodes" aria-label="策略边界，上海时间">
        {boundaryTimes.map((time, index) => (
          <div key={time} class="timeline-node" style={{ left: `${index * 100 / matrices.length}%` }}>
            <time dateTime={new Date(time).toISOString()}>{minuteText(time)}</time>
          </div>
        ))}
      </div>
      <div class="timeline-intervals" role="group" aria-label="选择一小时策略区段">
        {matrices.map(({ strategyId, startMs, endMs }, index) => (
          <button type="button" key={startMs} data-history-interval={strategyId} aria-pressed={selected === index}
            aria-label={`策略 ${strategyId}，${minuteText(startMs)}–${minuteText(endMs)}`} onClick={() => select(index)}>
            <span>策略 {strategyId}</span>
          </button>
        ))}
      </div>
      <span class="trim-key"><i aria-hidden="true" /> 每段首尾各扣除 5 分钟</span>
    </div>
  );
}

const bands = [
  { id: 'zero', label: '0%', max: 0 },
  { id: 'low', label: '0–5%', max: 0.05 },
  { id: 'mid', label: '5–10%', max: 0.10 },
  { id: 'high', label: '10–20%', max: 0.20 },
  { id: 'peak', label: '>20%', max: 1 },
];

function Scale() {
  return (
    <div class="matrix-legend" aria-label="各时段统一占比色标">
      <h4>全段流量占比</h4>
      <ul>{bands.map(band => <li key={band.id}>
        <i data-band={band.id} aria-hidden="true" />{band.label}
      </li>)}</ul>
    </div>
  );
}

function cellDescription(cell, names) {
  return `${names.get(cell.src)} 发送至 ${names.get(cell.dst)} · ${numberText(cell.gbit / 8)} GB · ${shareText(cell.share)}`;
}

function MatrixTable({ matrix, sample, names, selected, inspect, compact }) {
  return (
    <div class="matrix-scroll" role="region" aria-label="流量矩阵，可横向滚动" tabIndex={0}>
      <table class="matrix-table" aria-label="按行查发送端，按列查接收端">
        <thead>
          {compact && <tr class="matrix-axis"><td /><th colSpan={sample.tors.length}>接收端（列）→</th></tr>}
          <tr>
            <th scope="col">{compact ? '发送端 ↓' : '源 → 目的'}</th>
            {sample.tors.map(tor => <th scope="col" key={tor.id} class={compact && selected?.dst === tor.id ? 'matrix-axis-active' : ''}>{tor.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map(({ src, cells }) => (
            <tr key={src}>
              <th scope="row" class={compact && selected?.src === src ? 'matrix-axis-active' : ''}>{names.get(src)}</th>
              {cells.map(cell => {
                const diagonal = cell.src === cell.dst;
                if (diagonal) return <td key={cell.dst}><span class="matrix-diagonal" aria-label="同一机架">—</span></td>;
                const band = bands.find(item => cell.share <= item.max);
                const heat = 100 * cell.share / sample.colorMax;
                const isSelected = selected?.src === src && selected?.dst === cell.dst;
                const label = cellDescription(cell, names);
                return (
                  <td key={cell.dst}>
                    <button type="button" class={`matrix-cell${isSelected ? ' matrix-cell-selected' : ''}`}
                      data-band={compact ? band.id : undefined}
                      style={compact ? undefined : { '--heat-level': `${heat}%`, color: heat > 58 ? 'white' : '#142a49' }}
                      data-matrix-cell={`${src}-${cell.dst}`} data-share={cell.share}
                      data-gbit={cell.gbit} aria-label={label} title={label}
                      onPointerEnter={event => { if (event.pointerType !== 'touch') inspect(cell); }}
                      onFocus={() => inspect(cell)} onClick={() => inspect(cell)}>
                      {shareText(cell.share)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StrategyMatrix({ sample }) {
  const [section, setSection] = useState(1);
  const [inspected, setInspected] = useState(null);
  const [compact, setCompact] = useState(false);
  const matrix = sample.matrices[section];
  const names = new Map(sample.tors.map(({ id, label }) => [id, label]));
  const selected = inspected ?? matrix.rows.flatMap(row => row.cells).find(cell => cell.share === matrix.maxShare);
  const changeSection = index => {
    setSection(index);
    setInspected(null);
  };
  return (
    <section class={`panel history-panel matrix-panel${compact ? '' : ' matrix-classic'}`} style={{ '--rack-count': sample.tors.length }} aria-labelledby="matrix-title" data-history-matrix=""
      data-strategy={matrix.strategyId} data-section-start={matrix.startMs} data-section-end={matrix.endMs}
      data-effective-start={matrix.effectiveStartMs} data-effective-end={matrix.effectiveEndMs} data-total-gbit={matrix.totalGbit}>
      <div class="history-heading">
        <div>
          <div class="history-title"><h2 id="matrix-title">策略时段流量矩阵</h2>
            <ModuleHelp id="help-matrix" label="策略时段流量矩阵">点击小时区段，按行查发送端、按列查接收端。每格显示该方向占有效时段流量的比例；点选可看传输量，两种样式使用同一份数据。</ModuleHelp>
            <span class="history-badge">历史样例</span></div>
          <p>{dateText(matrix.startMs)} · 上海时间</p>
        </div>
        <div class="matrix-style-switch" role="group" aria-label="矩阵样式">
          <button type="button" aria-pressed={!compact} onClick={() => setCompact(false)}>经典渐变</button>
          <button type="button" aria-pressed={compact} onClick={() => setCompact(true)}>紧凑分档</button>
        </div>
      </div>

      <StrategyTimeline matrices={sample.matrices} selected={section} select={changeSection} />
      <div class="matrix-content">
        <div class="matrix-toolbar">
          <div>
            <h3>策略 {matrix.strategyId} · {minuteText(matrix.startMs)}–{minuteText(matrix.endMs)}</h3>
            <p>有效区间 <time>{minuteText(matrix.effectiveStartMs)}</time> ≤ t &lt; <time>{minuteText(matrix.effectiveEndMs)}</time></p>
          </div>
          {!compact && <div class="matrix-gradient-scale"><span>全段占比</span>0%<i aria-hidden="true" />{shareText(sample.colorMax)}</div>}
        </div>
        {matrix.totalGbit === 0 ? <p class="history-empty matrix-empty">该时段无流量</p> : <div class="matrix-layout">
          <MatrixTable matrix={matrix} sample={sample} names={names} selected={selected} inspect={setInspected} compact={compact} />
          {compact ? <aside class="matrix-key">
            <Scale />
            <dl class="matrix-detail" data-matrix-detail={`${selected.src}-${selected.dst}`}>
              <div><dt>发送端</dt><dd>{names.get(selected.src)}</dd></div>
              <div><dt>接收端</dt><dd>{names.get(selected.dst)}</dd></div>
              <div><dt>传输量</dt><dd>{numberText(selected.gbit / 8)} GB</dd></div>
              <div><dt>占全段</dt><dd>{shareText(selected.share)}</dd></div>
            </dl>
          </aside> : <div class="matrix-path-summary" data-matrix-detail={`${selected.src}-${selected.dst}`}>
            <b>{names.get(selected.src)} → {names.get(selected.dst)}</b>
            <span>{numberText(selected.gbit / 8)} GB</span>
            <span>占全段 {shareText(selected.share)}</span>
          </div>}
        </div>}
      </div>
    </section>
  );
}
