import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Html, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { Topology, Node, Pod } from '../types';

interface ClusterMap3DProps {
    topology: Topology | null;
}

// Layout constants
const POD_SIZE = 1.8;
const BUILDING_PADDING = 1.5;
const STREET_WIDTH = 6;
const SECTION_GAP = 2; // Gap between edge of street and block
const NODE_PADDING = 8;

interface BuildingLayout {
    owner: string;
    pods: Pod[];
    position: [number, number, number];
    width: number;
    depth: number;
}

interface NeighborhoodLayout {
    name: string;
    buildings: BuildingLayout[];
    width: number;
    depth: number;
    position: [number, number, number];
}

interface StreetSegment {
    axis: 'x' | 'z';
    x: number;
    z: number;
    length: number;
    width: number;
}

interface NodeLayoutResult {
    width: number;
    depth: number;
    namespaces: NeighborhoodLayout[];
    streets: StreetSegment[];
}

const calculateNodeLayout = (node: Node, topology: Topology): NodeLayoutResult => {
    const nodePods = topology.pods.filter(p => p.nodeName === node.name);
    const activeNamespaces = Array.from(new Set(nodePods.map(p => p.namespace))).sort();

    // 1. Build Neighborhood Blocks
    const nsLayouts: NeighborhoodLayout[] = activeNamespaces.map(ns => {
        const nsPods = nodePods.filter(p => p.namespace === ns);
        const podsByOwner: Record<string, Pod[]> = {};
        nsPods.forEach(p => {
            const owner = p.ownerRef?.name || 'standalone';
            if (!podsByOwner[owner]) podsByOwner[owner] = [];
            podsByOwner[owner].push(p);
        });
        const owners = Object.keys(podsByOwner);

        const buildings: BuildingLayout[] = [];
        let currentX = 0;
        let currentZ = 0;
        let rowMaxDepth = 0;
        const targetWidth = Math.ceil(Math.sqrt(owners.length)) * 5;

        owners.forEach(owner => {
            const ownerPods = podsByOwner[owner];
            const baseSide = Math.min(Math.ceil(Math.sqrt(ownerPods.length)), 3);
            const width = baseSide * POD_SIZE;
            const depth = baseSide * POD_SIZE;

            if (currentX + width > targetWidth && currentX > 0) {
                currentX = 0;
                currentZ += rowMaxDepth + BUILDING_PADDING;
                rowMaxDepth = 0;
            }

            buildings.push({
                owner,
                pods: ownerPods,
                position: [currentX + width / 2, 0, currentZ + depth / 2],
                width,
                depth
            });

            currentX += width + BUILDING_PADDING;
            rowMaxDepth = Math.max(rowMaxDepth, depth);
        });

        const totalWidth = Math.max(5, ...buildings.map(b => b.position[0] + b.width / 2));
        const totalDepth = Math.max(5, ...buildings.map(b => b.position[2] + b.depth / 2));

        buildings.forEach(b => {
            b.position[0] -= totalWidth / 2;
            b.position[2] -= totalDepth / 2;
        });

        return {
            name: ns,
            buildings,
            width: totalWidth + SECTION_GAP,
            depth: totalDepth + SECTION_GAP,
            position: [0, 0, 0]
        };
    });

    // 2. Strict Grid Layout for Streets
    const numNS = nsLayouts.length;
    const cols = Math.ceil(Math.sqrt(numNS));
    const rows = Math.ceil(numNS / cols);

    // Calculate max cell size for the grid
    const maxCellW = Math.max(10, ...nsLayouts.map(n => n.width));
    const maxCellD = Math.max(10, ...nsLayouts.map(n => n.depth));

    const gridSizeX = maxCellW + STREET_WIDTH;
    const gridSizeZ = maxCellD + STREET_WIDTH;

    const streets: StreetSegment[] = [];

    // Center Everything
    const totalContentW = cols * maxCellW + (cols - 1) * STREET_WIDTH;
    const totalContentD = rows * maxCellD + (rows - 1) * STREET_WIDTH;

    nsLayouts.forEach((ns, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;

        const cx = (c * (maxCellW + STREET_WIDTH)) + maxCellW / 2 - totalContentW / 2;
        const cz = (r * (maxCellD + STREET_WIDTH)) + maxCellD / 2 - totalContentD / 2;

        ns.position = [cx, 0, cz];
    });

    // Create Main Streets [Horizontal]
    // Between every row (if > 1 row)
    for (let r = 0; r < rows - 1; r++) {
        const z = (r * (maxCellD + STREET_WIDTH)) + maxCellD + STREET_WIDTH / 2 - totalContentD / 2;
        streets.push({
            axis: 'x',
            x: 0,
            z: z,
            length: totalContentW + STREET_WIDTH * 2,
            width: STREET_WIDTH
        });
    }

    // Create Cross Streets [Vertical]
    for (let c = 0; c < cols - 1; c++) {
        const x = (c * (maxCellW + STREET_WIDTH)) + maxCellW + STREET_WIDTH / 2 - totalContentW / 2;
        streets.push({
            axis: 'z',
            x: x,
            z: 0,
            length: totalContentD + STREET_WIDTH * 2,
            width: STREET_WIDTH
        });
    }

    // Add Perimeter Streets
    // Top
    streets.push({ axis: 'x', x: 0, z: -totalContentD / 2 - STREET_WIDTH / 2, length: totalContentW + STREET_WIDTH * 2, width: STREET_WIDTH });
    // Bottom
    streets.push({ axis: 'x', x: 0, z: totalContentD / 2 + STREET_WIDTH / 2, length: totalContentW + STREET_WIDTH * 2, width: STREET_WIDTH });
    // Left
    streets.push({ axis: 'z', x: -totalContentW / 2 - STREET_WIDTH / 2, z: 0, length: totalContentD + STREET_WIDTH * 2, width: STREET_WIDTH });
    // Right
    streets.push({ axis: 'z', x: totalContentW / 2 + STREET_WIDTH / 2, z: 0, length: totalContentD + STREET_WIDTH * 2, width: STREET_WIDTH });

    return {
        width: totalContentW + NODE_PADDING * 4,
        depth: totalContentD + NODE_PADDING * 4,
        namespaces: nsLayouts,
        streets
    };
};

export const ClusterMap3D: React.FC<ClusterMap3DProps> = ({ topology }) => {
    if (!topology) return <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400">Loading City...</div>;

    const nodes = useMemo(() => topology.nodes.sort((a, b) => a.name.localeCompare(b.name)), [topology]);

    const nodeLayouts = useMemo(() => {
        return nodes.map(n => ({
            node: n,
            layout: calculateNodeLayout(n, topology)
        }));
    }, [nodes, topology]);

    const columns = Math.ceil(Math.sqrt(nodes.length));

    const maxW = Math.max(...nodeLayouts.map(l => l.layout.width));
    const maxD = Math.max(...nodeLayouts.map(l => l.layout.depth));
    const GRID_SPACING_X = maxW + 5; // Very tight spacing
    const GRID_SPACING_Z = maxD + 5;

    // Ocean Color
    const OCEAN_COLOR = '#90cdf4';

    return (
        <div className="w-full h-screen bg-[#90cdf4]">
            <Canvas shadows camera={{ position: [80, 80, 80], fov: 30 }}>
                <color attach="background" args={[OCEAN_COLOR]} />
                <fog attach="fog" args={[OCEAN_COLOR, 100, 300]} />

                <Sky sunPosition={[100, 40, 20]} turbidity={8} rayleigh={1} mieCoefficient={0.005} mieDirectionalG={0.7} />
                <ambientLight intensity={0.6} />
                <directionalLight
                    position={[50, 100, 20]}
                    intensity={1.2}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                />

                <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.2} />

                {/* Water */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
                    <planeGeometry args={[1000, 1000]} />
                    <meshStandardMaterial color={OCEAN_COLOR} roughness={0} metalness={0.1} opacity={0.9} transparent />
                </mesh>

                {/* Nodes */}
                <group position={[-(columns * GRID_SPACING_X) / 2 + GRID_SPACING_X / 2, 0, -(columns * GRID_SPACING_Z) / 2 + GRID_SPACING_Z / 2]}>
                    {nodeLayouts.map(({ node, layout }, index) => {
                        const row = Math.floor(index / columns);
                        const col = index % columns;

                        // Pseudo-random offsets for organic feel
                        const offsetX = Math.sin(index * 12.9898) * (GRID_SPACING_X * 0.4);
                        const offsetZ = Math.cos(index * 78.233) * (GRID_SPACING_Z * 0.4);

                        return (
                            <Node3D
                                key={node.name}
                                node={node}
                                layout={layout}
                                position={[col * GRID_SPACING_X + offsetX, 0, row * GRID_SPACING_Z + offsetZ]}
                            />
                        );
                    })}
                </group>
            </Canvas>
        </div>
    );
};

// --- Low-Poly Props ---

const Tree: React.FC<{ position: [number, number, number] }> = ({ position }) => (
    <group position={position}>
        <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.3, 1, 6]} />
            <meshStandardMaterial color="#5D4037" />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
            <coneGeometry args={[1, 2, 8]} />
            <meshStandardMaterial color="#4CAF50" />
        </mesh>
    </group>
);

const Lamp: React.FC<{ position: [number, number, number] }> = ({ position }) => (
    <group position={position}>
        <mesh position={[0, 2.5, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.12, 5, 6]} />
            <meshStandardMaterial color="#2d3748" />
        </mesh>
        <mesh position={[0, 5, 0]}>
            <sphereGeometry args={[0.4]} />
            <meshStandardMaterial color="#FDD835" emissive="#FDD835" emissiveIntensity={2} />
        </mesh>
    </group>
);

const Node3D: React.FC<{ node: Node, layout: NodeLayoutResult, position: [number, number, number] }> = ({ node, layout, position }) => {

    // Generate Lamps along streets
    const decorations = useMemo(() => {
        const items = [];
        const streets = layout.streets;

        streets.forEach((st, idx) => {
            // Place lamps along the street sides (SPARSELY)
            // Increased from 10 to 25 for less lights
            const numLamps = Math.floor(st.length / 25);
            if (numLamps < 1) return;

            for (let i = 0; i <= numLamps; i++) {
                // Evenly spaced
                const offset = -st.length / 2 + (i * (st.length / numLamps));

                // Two sides of the street
                if (st.axis === 'x') {
                    items.push(<Lamp key={`l-x-${idx}-${i}-1`} position={[st.x + offset, 0, st.z - st.width / 2 - 0.5]} />);
                    items.push(<Lamp key={`l-x-${idx}-${i}-2`} position={[st.x + offset, 0, st.z + st.width / 2 + 0.5]} />);
                } else {
                    items.push(<Lamp key={`l-z-${idx}-${i}-1`} position={[st.x - st.width / 2 - 0.5, 0, st.z + offset]} />);
                    items.push(<Lamp key={`l-z-${idx}-${i}-2`} position={[st.x + st.width / 2 + 0.5, 0, st.z + offset]} />);
                }
            }
        });

        return items;
    }, [layout.streets]);

    return (
        <group position={position}>
            {/* Base Platform (Light Concrete) */}
            <mesh receiveShadow castShadow position={[0, 0, 0]}>
                <boxGeometry args={[layout.width, 2, layout.depth]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
            </mesh>
            <mesh position={[0, -1.5, 0]}>
                <boxGeometry args={[layout.width + 1, 4, layout.depth + 1]} />
                <meshStandardMaterial color="#718096" />
            </mesh>

            {/* Render Streets */}
            {layout.streets.map((st, i) => (
                <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[st.x, 1.02, st.z]} receiveShadow>
                    <planeGeometry args={st.axis === 'x' ? [st.length, st.width] : [st.width, st.length]} />
                    <meshStandardMaterial color="#1a202c" roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
                </mesh>
            ))}

            {/* Label */}
            <Html position={[-layout.width / 2, 2, -layout.depth / 2]} center transform sprite zIndexRange={[100, 0]}>
                <div className="bg-gray-800 text-white px-2 py-1 rounded text-sm font-bold opacity-80 whitespace-nowrap shadow">
                    {node.name}
                </div>
            </Html>

            <group position={[0, 1, 0]}>
                {decorations}
            </group>

            {/* Neighborhoods (Buildings only, sidewalks implied by base) */}
            {layout.namespaces.map((ns) => (
                <group key={ns.name} position={[ns.position[0], 1, ns.position[2]]}>
                    {/* NS Label */}
                    <Text
                        position={[-ns.width / 2 + 0.5, 0.3, -ns.depth / 2 + 0.5]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        fontSize={0.8}
                        color="#718096"
                        anchorX="left"
                        anchorY="top"
                    >
                        {ns.name}
                    </Text>

                    {/* Buildings */}
                    {ns.buildings.map((b) => (
                        <Building3D key={b.owner} building={b} />
                    ))}
                </group>
            ))}
        </group>
    );
}

const Building3D: React.FC<{ building: BuildingLayout }> = ({ building }) => {
    const { pods, position } = building;
    const baseSide = Math.min(Math.ceil(Math.sqrt(pods.length)), 3);

    return (
        <group position={position}>
            {pods.map((pod, i) => {
                const layerSize = baseSide * baseSide;
                const layer = Math.floor(i / layerSize);
                const idxInLayer = i % layerSize;
                const row = Math.floor(idxInLayer / baseSide);
                const col = idxInLayer % baseSide;
                const offsetX = (col - (baseSide - 1) / 2) * POD_SIZE;
                const offsetZ = (row - (baseSide - 1) / 2) * POD_SIZE;

                return (
                    <Pod3D key={pod.name} pod={pod} position={[offsetX, layer * 1.5, offsetZ]} />
                )
            })}
        </group>
    );
}

const Pod3D: React.FC<{ pod: Pod, position: [number, number, number] }> = ({ pod, position }) => {
    const color = pod.isReady ? '#48bb78' : (pod.status === 'Pending' ? '#ecc94b' : '#f56565');
    const [hovered, setHover] = useState(false);

    return (
        <group position={position}>
            <mesh
                castShadow
                receiveShadow
                position={[0, 0.75, 0]}
                onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
                onPointerOut={(e) => { e.stopPropagation(); setHover(false); }}
            >
                <boxGeometry args={[POD_SIZE - 0.2, 1.5, POD_SIZE - 0.2]} />
                <meshStandardMaterial color={hovered ? '#63b3ed' : '#edf2f7'} />
            </mesh>
            <mesh position={[0, 0.75, (POD_SIZE - 0.2) / 2 + 0.01]}>
                <planeGeometry args={[POD_SIZE - 0.6, 1]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
            </mesh>

            {hovered && (
                <Html position={[0, 2, 0]} center className="pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs p-2 rounded shadow-xl whitespace-nowrap z-50 border border-gray-600">
                        <strong>{pod.name}</strong>
                        <div className="text-[10px] text-gray-400">{pod.status}</div>
                    </div>
                </Html>
            )}
        </group>
    );
};
