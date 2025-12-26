import type { Topology } from './types';

const API_BASE = 'http://localhost:3001';

export const fetchTopology = async (): Promise<Topology> => {
    const res = await fetch(`${API_BASE}/topology`);
    if (!res.ok) throw new Error('Failed to fetch topology');
    return res.json();
};

export const fetchContexts = async (): Promise<{ contexts: string[], current: string }> => {
    const res = await fetch(`${API_BASE}/contexts`);
    if (!res.ok) throw new Error('Failed to fetch contexts');
    return res.json();
};

export const setContext = async (contextName: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/set-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextName }),
    });
    return res.ok;
};
