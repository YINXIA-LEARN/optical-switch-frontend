import { useLayoutEffect, useRef } from 'preact/hooks';
import ModuleHelp from './ModuleHelp.jsx';
import { electricPoints, opticalPath, placeTopology, roundedPath, WIDTH } from './layout.mjs';

const FLOW_SPEED = 122;

function FlowDot({ path }) {
  const motion = useRef(null);
  useLayoutEffect(() => {
    const element = motion.current;
    const geometry = document.createElementNS(element.namespaceURI, 'path');
    geometry.setAttribute('d', path);
    element.setAttribute('dur', `${geometry.getTotalLength() / FLOW_SPEED}s`);
    element.beginElement();
  }, [path]);

  // The same perpendicular offset from two reversed routes puts their dots on opposite sides.
  return (
    <circle class="flow-dot" cy="4.7" r="3.7" aria-hidden="true">
      <animateMotion ref={motion} path={path} begin="indefinite" repeatCount="indefinite"
        calcMode="paced" rotate="auto" />
    </circle>
  );
}

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
        <FlowDot path={path} />
        <Arrow x={anchor[0] + direction * 18} y={anchor[1]} direction={direction} />
      </>}
    </g>
  );
}

function electricalRoute(link, racks, height) {
  const points = electricPoints(link, racks, height);
  const reverse = [...points].reverse();
  return [points, reverse].map(route => ({
    path: roundedPath(route),
    anchor: route[0],
    direction: Math.sign(route[1][0] - route[0][0]),
  }));
}

function opticalRoute(pair, racks, lane) {
  const { a, b } = pair;
  const source = racks.get(a);
  const target = racks.get(b);
  return [[source, target], [target, source]].map(([from, to]) => ({
    path: opticalPath(from, to, lane),
    anchor: from.core,
    direction: from.west ? 1 : -1,
  }));
}

function Directions({ routes, medium, rates }) {
  return routes.flatMap(({ a, b, geometry }) => {
    const forward = `${medium}-${a}-${b}`;
    const reverse = `${medium}-${b}-${a}`;
    return [
      <Direction key={forward} {...geometry[0]} flow={rates.get(forward)} />,
      <Direction key={reverse} {...geometry[1]} flow={rates.get(reverse)} />,
    ];
  });
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
  const electricRoutes = electricLinks.map(link => ({ ...link, geometry: electricalRoute(link, racks, height) }));
  const opticalRoutes = opticalPairs.map((pair, lane) => ({ ...pair, geometry: opticalRoute(pair, racks, lane) }));
  return (
    <section class="panel topology" aria-labelledby="topology-heading" data-view="topology" data-tick={tick}>
      <div class="panel-heading">
        <div class="help-heading"><h2 id="topology-heading">网络拓扑</h2>
          <ModuleHelp id="help-topology" label="网络拓扑">沿 E1～E3 查看固定电链路，沿 O 查看 MEMS 当前配对。箭头和移动光点表示有流量的方向；每 3 秒重新判定活跃状态。</ModuleHelp>
        </div>
        <span class="panel-meta">{electricLinks.length} 条电链路 <span aria-hidden="true">·</span> {opticalPairs.length} 对光路</span>
      </div>
      <div class="diagram-scroll" tabIndex={0} role="region" aria-label="拓扑画布，可横向滚动">
        <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-labelledby="diagram-title diagram-desc">
          <title id="diagram-title">ToR 与 MEMS 光电网络连接图</title>
          <desc id="diagram-desc">灰蓝实线为电链路，蓝色虚线为光路。活跃方向用源端箭头和移动光点标记。</desc>
          {electricRoutes.map(({ a, b, geometry: [{ path }] }) => (
            <g key={`${a}-${b}`} data-electric-edge={`${a}-${b}`}>
              <path class="crossing-gap" d={path} />
              <path class="electric-base" d={path} />
            </g>
          ))}
          <Directions routes={electricRoutes} medium="electric" rates={rates} />
          {tors.map(({ id }) => {
            const { optical: [aX, aY], core: [bX, bY] } = racks.get(id);
            return <path key={id} data-optical-drop={id} class="optical-base optical-drop"
              d={`M ${aX} ${aY} C ${(aX + bX) / 2} ${aY}, ${(aX + bX) / 2} ${bY}, ${bX} ${bY}`} />;
          })}
          <rect class="core-body" {...core} rx="15" />
          <g class="core-routing" data-mems="">
            {opticalRoutes.map(({ a, b, geometry: [{ path }] }) => (
              <g key={`${a}-${b}`} class="optical-pair" data-optical-pair={`${a}-${b}`}>
                <path class="crossing-gap" d={path} />
                <path class="optical-base" d={path} />
              </g>
            ))}
            <Directions routes={opticalRoutes} medium="optical" rates={rates} />
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
