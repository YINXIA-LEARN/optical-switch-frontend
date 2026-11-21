import { electricPoints, opticalPath, placeTopology, roundedPath, WIDTH } from './layout.mjs';

function Arrow({ x, y, direction }) {
  const tip = x + 6 * direction;
  const tail = x - 6 * direction;
  return <path class="flow-arrow" d={`M ${tip} ${y} L ${tail} ${y - 5} L ${tail} ${y + 5} Z`} />;
}

function Direction({ path, anchor, direction, flow }) {
  return (
    <g data-flow={flow.id} data-rate={flow.rate} data-active={flow.rate > 0 ? 'true' : 'false'}>
      <title>{`ToR${flow.src} → ToR${flow.dst} · ${flow.rate} Gbit/s`}</title>
      {flow.rate > 0 && <>
        <path class="flow-highlight" d={path} pathLength={100} />
        <Arrow x={anchor[0] + direction * 18} y={anchor[1]} direction={direction} />
      </>}
    </g>
  );
}

function ElectricalLink({ link, racks, rates, height }) {
  const points = electricPoints(link, racks, height);
  const reverse = [...points].reverse();
  const path = roundedPath(points);
  const direction = Math.sign(points[1][0] - points[0][0]);
  const reverseDirection = Math.sign(reverse[1][0] - reverse[0][0]);
  const { a, b } = link;
  return (
    <g class="electric-link" data-electric-edge={`${a}-${b}`}>
      <path class="crossing-gap" d={path} />
      <path class="electric-base" d={path} />
      <Direction path={path} anchor={points[0]} direction={direction} flow={rates.get(`electric-${a}-${b}`)} />
      <Direction path={roundedPath(reverse)} anchor={reverse[0]} direction={reverseDirection} flow={rates.get(`electric-${b}-${a}`)} />
    </g>
  );
}

function OpticalPair({ pair, racks, rates, lane }) {
  const { a, b } = pair;
  const source = racks.get(a);
  const target = racks.get(b);
  const path = opticalPath(source, target, lane);
  return (
    <g class="optical-pair" data-optical-pair={`${a}-${b}`}>
      <path class="crossing-gap" d={path} />
      <path class="optical-base" d={path} />
      <Direction path={path} anchor={source.core} direction={source.west ? 1 : -1} flow={rates.get(`optical-${a}-${b}`)} />
      <Direction path={opticalPath(target, source, lane)} anchor={target.core} direction={target.west ? 1 : -1} flow={rates.get(`optical-${b}-${a}`)} />
    </g>
  );
}

function Rack({ tor, rack }) {
  const [lightX, lightY] = rack.optical;
  const titleX = rack.x + 63;
  return (
    <g data-tor={tor.id} class="rack">
      <rect class="rack-body" x={rack.x} y={rack.y - 42} width="126" height="84" rx="11" />
      <path class="rack-symbol" d={`M ${titleX - 11} ${rack.y - 22} h 22 v 7 h -22 z m 0 11 h 22 v 7 h -22 z m 4 -15 h 2 m 3 0 h 2 m -7 11 h 2 m 3 0 h 2`} />
      <text class="rack-title" x={titleX} y={rack.y + 22} text-anchor="middle">{tor.label}</text>
      {tor.ports.map(port => {
        const isOptical = port === 'O';
        const [x, y] = isOptical ? [lightX, lightY] : rack.ports[port];
        const offset = isOptical === rack.west ? -1 : 1;
        return (
          <g key={port} data-port={port} class={isOptical ? 'port port-optical' : 'port'}>
            <circle cx={x} cy={y} r="4.5" />
            <text x={x + offset * 10} y={y + 4} text-anchor={offset === 1 ? 'start' : 'end'}>{port}</text>
          </g>
        );
      })}
    </g>
  );
}

function Legend() {
  return (
    <ul class="legend" aria-label="链路图例">
      <li><span class="legend-electric" />电链路</li>
      <li><span class="legend-optical" />光路</li>
      <li><span class="legend-arrow" />有流量的方向</li>
      <li class="diagram-pan-hint">横向滑动查看全图</li>
    </ul>
  );
}

export default function Topology({ snapshot }) {
  const { tors, electricLinks, opticalPairs, flows, tick } = snapshot;
  const { height, racks, core } = placeTopology(tors, electricLinks);
  const rates = new Map(flows.map(flow => [flow.id, flow]));
  return (
    <section class="panel topology" aria-labelledby="topology-heading" data-view="topology" data-tick={tick}>
      <div class="panel-heading">
        <h2 id="topology-heading">网络拓扑</h2>
        <span class="panel-meta">{electricLinks.length} 条电链路 <span aria-hidden="true">·</span> {opticalPairs.length} 对光路</span>
      </div>
      <div class="diagram-scroll" tabIndex={0} role="region" aria-label="拓扑画布，可横向滚动">
        <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-labelledby="diagram-title diagram-desc">
          <title id="diagram-title">ToR 与 MEMS 光电网络连接图</title>
          <desc id="diagram-desc">灰蓝实线为电链路，蓝色虚线为光路。高亮线段上的箭头标出该方向的流量。</desc>
          {electricLinks.map(link => <ElectricalLink key={`${link.a}-${link.b}`} link={link} racks={racks} rates={rates} height={height} />)}
          {tors.map(({ id }) => {
            const { optical: [aX, aY], core: [bX, bY] } = racks.get(id);
            return <path key={id} data-optical-drop={id} class="optical-base optical-drop"
              d={`M ${aX} ${aY} C ${(aX + bX) / 2} ${aY}, ${(aX + bX) / 2} ${bY}, ${bX} ${bY}`} />;
          })}
          <rect class="core-body" {...core} rx="15" />
          <g class="core-routing" data-mems="">
            {opticalPairs.map((pair, lane) => <OpticalPair key={`${pair.a}-${pair.b}`} pair={pair} racks={racks} rates={rates} lane={lane} />)}
          </g>
          <text class="core-title" x="430" y={core.y + 26} text-anchor="middle">MEMS</text>
          {tors.map(({ id }, index) => {
            const { core: [x, y], west, slot } = racks.get(id);
            return (
              <g key={id} class="core-port">
                <circle cx={x} cy={y} r="4" />
                <text x={x + (west ? 9 : -9)} y={y + (slot < 2 ? -9 : 17)} text-anchor={west ? 'start' : 'end'}>{`IN ${index + 1} / OUT ${index + 17}`}</text>
              </g>
            );
          })}
          {tors.map(tor => <Rack key={tor.id} tor={tor} rack={racks.get(tor.id)} />)}
        </svg>
      </div>
      <Legend />
    </section>
  );
}
