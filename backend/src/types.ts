export interface Topology {
    clusterName: string;
    contextName: string;
    nodes: Node[];
    namespaces: Namespace[];
    workloads: Workload[];
    pods: Pod[];
    services: Service[];
}

export interface Node {
    name: string;
    roles: string[];
    allocatable: {
        cpu: string;
        memory: string;
    };
    status: 'Ready' | 'NotReady' | 'Unknown';
}

export interface Namespace {
    name: string;
    labels: Record<string, string>;
}

export interface Workload {
    name: string;
    namespace: string;
    type: 'Deployment' | 'StatefulSet' | 'DaemonSet';
    replicas: number;
    readyReplicas: number;
    // Metadata for rendering (e.g., app labels)
    labels: Record<string, string>;
}

export interface Pod {
    name: string;
    namespace: string;
    nodeName: string;
    status: string; // Running, Pending, etc.
    isReady: boolean;
    restarts: number;
    ageSeconds: number;
    ownerRef?: {
        kind: string;
        name: string;
    };
}

export interface Service {
    name: string;
    namespace: string;
    type: string;
    clusterIP: string;
    ports: number[];
}
