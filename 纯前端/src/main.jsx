import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { createSimulation } from './sim/index.mjs';
import cluster8 from './sim/cluster8.mjs';
import Dashboard from './ui/Dashboard.jsx';

function Application({ config }) {
  const [simulation] = useState(() => createSimulation({ config }));
  const [snapshot, setSnapshot] = useState(simulation.current);

  useEffect(() => {
    const timer = window.setInterval(() => setSnapshot(simulation.step()), 1000);
    return () => window.clearInterval(timer);
  }, [simulation]);

  return <Dashboard snapshot={snapshot} />;
}

const racks = new URLSearchParams(window.location.search).get('tors');
const config = racks === '8' ? cluster8 : undefined;
render(<Application config={config} />, document.querySelector('#app'));
