import { useEffect, useState } from 'react';
import { OrbitalStation3D } from './components/OrbitalStation3D';
import { fetchTopology, fetchContexts, setContext } from './api';
import type { Topology } from './types';

function App() {
  const [topology, setTopology] = useState<Topology | null>(null);
  const [contexts, setContexts] = useState<string[]>([]);
  const [currentContext, setCurrentContext] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [topoData, ctxData] = await Promise.all([
        fetchTopology(),
        fetchContexts()
      ]);
      setTopology(topoData);
      setContexts(ctxData.contexts);
      setCurrentContext(ctxData.current);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      // Poll for topology updates only
      fetchTopology()
        .then(setTopology)
        .catch(console.error);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleContextChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCtx = e.target.value;
    try {
      setLoading(true);
      await setContext(newCtx);
      setCurrentContext(newCtx);
      // Reload topology immediately
      const topo = await fetchTopology();
      setTopology(topo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const [showLegend, setShowLegend] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen bg-iso-ground text-gray-800 font-sans">
      {/* HUD / Header */}
      <div className="absolute top-0 left-0 w-full z-50 p-4 flex justify-between items-start pointer-events-none">
        <div className="bg-white/90 backdrop-blur shadow-lg rounded-xl p-4 pointer-events-auto border border-gray-200">
          {/* Header content ... (same as before) */}
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent mb-2">
            KubeTown 3D
          </h1>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Context</label>
            <select
              value={currentContext}
              onChange={handleContextChange}
              disabled={loading}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 outline-none"
            >
              {contexts.map(ctx => (
                <option key={ctx} value={ctx}>{ctx}</option>
              ))}
            </select>
          </div>

          {loading && <div className="text-xs text-blue-500 mt-2 animate-pulse">Syncing satellite...</div>}
          {error && <div className="text-xs text-red-500 mt-2">Error: {error}</div>}

          {topology && (
            <div className="mt-4 border-t pt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>Nodes: <span className="font-bold">{topology.nodes.length}</span></div>
              <div>Pods: <span className="font-bold">{topology.pods.length}</span></div>
              <div>Districts: <span className="font-bold">{topology.nodes.length}</span></div>
              <div>Zones: <span className="font-bold">{topology.namespaces.length}</span></div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pointer-events-auto items-end">
          <div className="bg-white/90 backdrop-blur shadow-lg rounded-xl p-2 text-xs text-gray-500">
            Rotate: Left Click | Pan: Right Click | Zoom: Scroll
          </div>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-lg text-sm transition transition-transform hover:scale-105"
          >
            ? Legend
          </button>
        </div>
      </div>

      {showLegend && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full relative">
            <button onClick={() => setShowLegend(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>
            <h2 className="text-xl font-bold mb-4 text-gray-800">Ctiy Guide</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-300 rounded border border-gray-400"></div>
                <div>
                  <div className="font-bold text-sm">District Platform</div>
                  <div className="text-xs text-gray-500">Kubernetes Node. The physical island where apps live.</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 border border-gray-400 border-dashed rounded flex items-center justify-center text-xs text-gray-400">Zone</div>
                <div>
                  <div className="font-bold text-sm">Zone</div>
                  <div className="text-xs text-gray-500">Kubernetes Namespace. Logical separation area.</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5">
                  <div className="w-3 h-6 bg-gray-100 border border-gray-300"></div>
                  <div className="w-3 h-6 bg-gray-100 border border-gray-300"></div>
                </div>
                <div>
                  <div className="font-bold text-sm">Tower Block</div>
                  <div className="text-xs text-gray-500">Workload (Deployment/StatefulSet). A collection of pods.</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-gray-100 border border-gray-300 relative">
                  <div className="absolute inset-x-0.5 top-1 h-2 bg-green-400"></div>
                </div>
                <div>
                  <div className="font-bold text-sm">Pod Unit</div>
                  <div className="text-xs text-gray-500">Individual Pod. Green window = Ready. Red = Error.</div>
                </div>
              </div>
            </div>
            <div className="mt-6 text-center">
              <button onClick={() => setShowLegend(false)} className="text-blue-600 text-sm hover:underline">Close Guide</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Map */}
      <OrbitalStation3D topology={topology} />
    </div>
  );
}

export default App;
