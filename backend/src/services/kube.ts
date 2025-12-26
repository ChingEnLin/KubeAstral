import * as k8s from '@kubernetes/client-node';
import { Topology, Node, Namespace, Workload, Pod, Service } from '../types.js';

export class KubeService {
    private kc: k8s.KubeConfig;
    private k8sApi: k8s.CoreV1Api;
    private appApi: k8s.AppsV1Api;
    private currentContext: string;

    constructor() {
        this.kc = new k8s.KubeConfig();
        this.kc.loadFromDefault();
        this.currentContext = this.kc.currentContext;
        this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
        this.appApi = this.kc.makeApiClient(k8s.AppsV1Api);
    }

    public getContexts() {
        return this.kc.contexts.map(ctx => ctx.name);
    }

    public getCurrentContext() {
        return this.currentContext;
    }

    public setContext(contextName: string) {
        if (this.kc.contexts.find(ctx => ctx.name === contextName)) {
            this.kc.setCurrentContext(contextName);
            this.currentContext = contextName;
            // Re-initialize clients
            this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
            this.appApi = this.kc.makeApiClient(k8s.AppsV1Api);
            return true;
        }
        return false;
    }

    public async getTopology(): Promise<Topology> {
        // Note: The client returns the body directly in recent versions when using promises,
        // or the types are resolving to the body.
        const [nodesRes, nsRes, podsRes, deployRes, stsRes, dsRes, svcRes] = await Promise.all([
            this.k8sApi.listNode(),
            this.k8sApi.listNamespace(),
            this.k8sApi.listPodForAllNamespaces(),
            this.appApi.listDeploymentForAllNamespaces(),
            this.appApi.listStatefulSetForAllNamespaces(),
            this.appApi.listDaemonSetForAllNamespaces(),
            this.k8sApi.listServiceForAllNamespaces(),
        ]);

        // Debugging what we actually got
        console.log('nodesRes keys:', Object.keys(nodesRes || {}));
        // Check if it has 'body' or 'items'
        const nodesList = (nodesRes as any).body || nodesRes;

        const nodes: Node[] = (nodesList.items || []).map((n: k8s.V1Node) => ({
            name: n.metadata?.name || 'unknown',
            roles: Object.keys(n.metadata?.labels || {}).filter((k: string) => k.includes('role')).map((k: string) => k.split('/')[1] || k),
            allocatable: {
                cpu: n.status?.allocatable?.cpu || '0',
                memory: n.status?.allocatable?.memory || '0',
            },
            status: n.status?.conditions?.find((c: k8s.V1NodeCondition) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
        }));

        const nsList = (nsRes as any).body || nsRes;
        const namespaces: Namespace[] = (nsList.items || []).map((ns: k8s.V1Namespace) => ({
            name: ns.metadata?.name || 'unknown',
            labels: ns.metadata?.labels || {},
        }));

        const deployList = (deployRes as any).body || deployRes;
        const stsList = (stsRes as any).body || stsRes;
        const dsList = (dsRes as any).body || dsRes;

        const workloads: Workload[] = [
            ...(deployList.items || []).map((d: k8s.V1Deployment) => this.mapDeployment(d)),
            ...(stsList.items || []).map((s: k8s.V1StatefulSet) => this.mapStatefulSet(s)),
            ...(dsList.items || []).map((d: k8s.V1DaemonSet) => this.mapDaemonSet(d)),
        ];

        const podsList = (podsRes as any).body || podsRes;
        const pods: Pod[] = (podsList.items || []).map((p: k8s.V1Pod) => this.mapPod(p));

        const svcList = (svcRes as any).body || svcRes;
        const services: Service[] = (svcList.items || []).map((s: k8s.V1Service) => ({
            name: s.metadata?.name || 'unknown',
            namespace: s.metadata?.namespace || 'unknown',
            type: s.spec?.type || 'ClusterIP',
            clusterIP: s.spec?.clusterIP || 'None',
            ports: s.spec?.ports?.map((p: k8s.V1ServicePort) => p.port) || [],
        }));

        return {
            clusterName: this.kc.getCluster(this.kc.getCurrentCluster()?.name || '')?.name || 'unknown',
            contextName: this.currentContext,
            nodes,
            namespaces,
            workloads,
            pods,
            services,
        };
    }

    private mapDeployment(d: k8s.V1Deployment): Workload {
        return {
            name: d.metadata?.name || 'unknown',
            namespace: d.metadata?.namespace || 'unknown',
            type: 'Deployment',
            replicas: d.spec?.replicas || 0,
            readyReplicas: d.status?.readyReplicas || 0,
            labels: d.metadata?.labels || {},
        };
    }

    private mapStatefulSet(s: k8s.V1StatefulSet): Workload {
        return {
            name: s.metadata?.name || 'unknown',
            namespace: s.metadata?.namespace || 'unknown',
            type: 'StatefulSet',
            replicas: s.spec?.replicas || 0,
            readyReplicas: s.status?.readyReplicas || 0,
            labels: s.metadata?.labels || {},
        };
    }

    private mapDaemonSet(d: k8s.V1DaemonSet): Workload {
        return {
            name: d.metadata?.name || 'unknown',
            namespace: d.metadata?.namespace || 'unknown',
            type: 'DaemonSet',
            replicas: d.status?.currentNumberScheduled || 0,
            readyReplicas: d.status?.numberReady || 0,
            labels: d.metadata?.labels || {},
        };
    }

    private mapPod(p: k8s.V1Pod): Pod {
        const startTimeResult = p.status?.startTime ? new Date(p.status.startTime).getTime() : Date.now();
        const ageSeconds = Math.floor((Date.now() - startTimeResult) / 1000);

        // Simple owner ref check
        const owner = p.metadata?.ownerReferences?.[0];

        return {
            name: p.metadata?.name || 'unknown',
            namespace: p.metadata?.namespace || 'unknown',
            nodeName: p.spec?.nodeName || 'unknown',
            status: p.status?.phase || 'Unknown',
            isReady: p.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True' || false,
            restarts: p.status?.containerStatuses?.reduce((acc, c) => acc + c.restartCount, 0) || 0,
            ageSeconds,
            ownerRef: owner ? { kind: owner.kind, name: owner.name } : undefined,
        };
    }
}
