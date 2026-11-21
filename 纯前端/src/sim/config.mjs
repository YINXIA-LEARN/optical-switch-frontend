export function makeElectricGroup(ids) {
  return {
    tors: ids.map(id => ({ id, label: `ToR${id}`, ports: ['O', 'E1', 'E2', 'E3'] })),
    electricLinks: ids.flatMap((a, index) =>
      ids.slice(index + 1).map(b => ({
        a,
        b,
        aPort: `E${ids.filter(id => id !== a).indexOf(b) + 1}`,
        bPort: `E${ids.filter(id => id !== b).indexOf(a) + 1}`,
      })),
    ),
  };
}

export function strategy(id, pairs) {
  return { id, pairs: pairs.map(([a, b]) => ({ a, b })) };
}

export const defaultConfig = {
  ...makeElectricGroup([0, 1, 2, 3]),
  strategies: [
    strategy('A', [[0, 1], [2, 3]]),
    strategy('B', [[0, 2], [1, 3]]),
    strategy('C', [[0, 3], [1, 2]]),
  ],
};
