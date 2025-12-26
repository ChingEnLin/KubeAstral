import express from 'express';
import cors from 'cors';

import { KubeService } from './services/kube.js';

const app = express();
const PORT = process.env.PORT || 3001;
const kubeService = new KubeService();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'KubeTown Backend is running' });
});

app.get('/contexts', (req, res) => {
    try {
        const contexts = kubeService.getContexts();
        const current = kubeService.getCurrentContext();
        res.json({ contexts, current });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/set-context', (req, res) => {
    const { contextName } = req.body;
    if (!contextName) {
        return res.status(400).json({ error: 'contextName is required' });
    }

    try {
        const success = kubeService.setContext(contextName);
        if (success) {
            res.json({ success: true, message: `Switched to context ${contextName}` });
        } else {
            res.status(404).json({ error: 'Context not found' });
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/topology', async (req, res) => {
    try {
        const topology = await kubeService.getTopology();
        res.json(topology);
    } catch (err: any) {
        console.error('Topology fetch error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
