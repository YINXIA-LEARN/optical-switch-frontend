import { makeElectricGroup, strategy } from './config.mjs';

const first = makeElectricGroup([0, 1, 2, 3]);
const second = makeElectricGroup([4, 5, 6, 7]);

export default {
  // Electrical links stay within each four-rack group.
  tors: [...first.tors, ...second.tors],
  electricLinks: [...first.electricLinks, ...second.electricLinks],
  strategies: [
    strategy('A', [[0, 1], [2, 3], [4, 5], [6, 7]]),
    // The same MEMS can connect optical ports in different groups.
    strategy('B', [[0, 4], [1, 5], [2, 6], [3, 7]]),
    strategy('C', [[0, 7], [1, 6], [2, 5], [3, 4]]),
  ],
};
