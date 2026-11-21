export const WIDTH = 860;
const GROUP_HEIGHT = 472;
const CORE_LEFT = 326;
const CORE_RIGHT = 534;

function electricGroups(tors, links) {
  const neighbors = new Map(tors.map(({ id }) => [id, []]));
  for (const { a, b } of links) {
    neighbors.get(a).push(b);
    neighbors.get(b).push(a);
  }
  const remaining = new Set(neighbors.keys());
  const groups = [];
  for (const { id } of tors) {
    if (!remaining.delete(id)) continue;
    const members = [id];
    for (const member of members) {
      for (const peer of neighbors.get(member)) {
        if (remaining.delete(peer)) members.push(peer);
      }
    }
    members.sort((a, b) => a - b);
    for (let index = 0; index < members.length; index += 4) groups.push(members.slice(index, index + 4));
  }
  return groups;
}

const ROUTES = {
  '0-1': { west: 110, east: 750, y: 52, perimeter: 86 },
  '0-2': { west: 92 },
  '0-3': { west: 48, east: 812, y: 450, perimeter: 44 },
  '1-2': { west: 68, east: 790, y: 22, perimeter: 65 },
  '1-3': { east: 768 },
  '2-3': { west: 110, east: 750, y: 420, perimeter: 23 },
};

export function placeTopology(tors, links) {
  const groups = electricGroups(tors, links);
  const height = groups.length * GROUP_HEIGHT;
  const racks = new Map();
  groups.forEach((group, groupIndex) => group.forEach((id, slot) => {
    const west = slot % 2 === 0;
    const upper = slot < 2;
    const offset = groupIndex * GROUP_HEIGHT;
    const y = offset + (upper ? 134 : 338);
    racks.set(id, {
      slot, groupIndex, west, x: west ? 154 : 580, y,
      ports: Object.fromEntries(['E1', 'E2', 'E3'].map((port, index) => [
        port, [west ? 154 : 706, y + (index - 1) * 22],
      ])),
      optical: [west ? 280 : 580, y],
      core: [west ? CORE_LEFT : CORE_RIGHT, offset + (upper ? 185 : 287)],
    });
  }));
  return {
    height, racks,
    core: { x: CORE_LEFT, y: 140, width: CORE_RIGHT - CORE_LEFT, height: height - 280 },
  };
}

function toward([x, y], [otherX, otherY], distance) {
  const fraction = distance / Math.hypot(otherX - x, otherY - y);
  return [x + (otherX - x) * fraction, y + (otherY - y) * fraction];
}

const point = ([x, y]) => `${x} ${y}`;

export function roundedPath(points) {
  const segments = [`M ${point(points[0])}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const [before, turn, after] = points.slice(index - 1, index + 2);
    const entry = toward(turn, before, 8);
    const exit = toward(turn, after, 8);
    segments.push(`L ${point(entry)} Q ${point(turn)} ${point(exit)}`);
  }
  segments.push(`L ${point(points.at(-1))}`);
  return segments.join(' ');
}

export function electricPoints({ a, aPort, b, bPort }, racks, height) {
  const source = racks.get(a);
  const target = racks.get(b);
  const start = source.ports[aPort];
  const end = target.ports[bPort];
  const key = [source.slot, target.slot].sort().join('-');
  const sameGroup = source.groupIndex === target.groupIndex;
  const expanded = height > GROUP_HEIGHT;
  let route = sameGroup ? ROUTES[key] : { west: 30, east: 830, y: 12, perimeter: 12 };
  if (expanded && sameGroup && key === '2-3') route = { ...route, west: 25, east: 835 };
  const sourceLane = source.west ? route.west : route.east;
  const targetLane = target.west ? route.west : route.east;
  if (source.west === target.west) return [start, [sourceLane, start[1]], [sourceLane, end[1]], end];

  // With a tall MEMS, span the canvas outside the optical matrix.
  const fromTop = (source.groupIndex + target.groupIndex) * GROUP_HEIGHT < height;
  const turnY = expanded ? (fromTop ? route.perimeter : height - route.perimeter) : route.y;
  return [start, [sourceLane, start[1]], [sourceLane, turnY], [targetLane, turnY], [targetLane, end[1]], end];
}

export function opticalPath(source, target, lane) {
  const [aX, aY] = source.core;
  const [bX, bY] = target.core;
  const aDirection = source.west ? 1 : -1;
  const bDirection = target.west ? 1 : -1;
  if (source.groupIndex !== target.groupIndex) {
    if (source.west === target.west) {
      const laneX = aX + aDirection * (54 + lane * 12);
      return roundedPath([[aX, aY], [laneX, aY], [laneX, bY], [bX, bY]]);
    }
    const laneX = 382 + lane * 32;
    const aShoulder = aX + aDirection * 34;
    const bShoulder = bX + bDirection * 34;
    const stagger = Math.sign(bY - aY) * (19 + (lane % 2) * 17);
    return roundedPath([
      [aX, aY], [aShoulder, aY], [aShoulder, aY + stagger], [laneX, aY + stagger],
      [laneX, bY - stagger], [bShoulder, bY - stagger], [bShoulder, bY], [bX, bY],
    ]);
  }
  const bend = source.west === target.west ? 72 : 83;
  return `M ${aX} ${aY} H ${aX + aDirection * 34} C ${aX + aDirection * bend} ${aY}, ${bX + bDirection * bend} ${bY}, ${bX + bDirection * 34} ${bY} H ${bX}`;
}
