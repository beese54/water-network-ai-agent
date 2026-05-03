import React, { useEffect } from 'react';
import AppShell from './components/layout/AppShell';
import { useNetworkStore } from './store/networkStore';

const App: React.FC = () => {
  const fetchTopology = useNetworkStore(s => s.fetchTopology);

  useEffect(() => {
    fetchTopology();
  }, []);

  return <AppShell />;
};

export default App;
