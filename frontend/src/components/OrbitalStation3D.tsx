import React, { useMemo, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { Topology, Node, Pod } from '../types';

// Layout Constants
const HUB_RADIUS = 10;
const INNER_RING_RADIUS = 20;
const WING_WIDTH = 14;
const WING_HEIGHT = 1;
const SECTOR_PADDING = 3;
const MODULE_PADDING = 1.5;
const CAPSULE_SIZE = 0.8;

// Interfaces for Calculated Layout
interface CapsuleLayout {
    pod: Pod;
    position: [number, number, number];
}

interface ModuleLayout {
    owner: string;
    width: number;
    depth: number;
    position: [number, number, number];
    capsules: CapsuleLayout[];
}

interface SectorLayout {
    name: string;
    offset: number; // Distance from start of wing
    length: number;
    modules: ModuleLayout[];
}

interface StationNodeLayout {
    node: Node;
    angle: number;
    distance: number;
    length: number;
    width: number;
    sectors: SectorLayout[];
}

interface OrbitalStation3DProps {
    topology: Topology | null;
}

// Helper: Calculate layout for a single wing
const calculateStationLayout = (nodes: Node[], topology: Topology): StationNodeLayout[] => {
    const count = nodes.length;
    const angleStep = (Math.PI * 2) / Math.max(1, count);

    return nodes.map((node, i) => {
        const nodePods = topology.pods.filter(p => p.nodeName === node.name);
        const namespaces = Array.from(new Set(nodePods.map(p => p.namespace))).sort();

        // Calculate Sectors
        let currentOffset = 2; // Start a bit away from the hub connection
        const sectors: SectorLayout[] = namespaces.map(ns => {
            const nsPods = nodePods.filter(p => p.namespace === ns);
            // Group by Owner (Deployment/StatefulSet)
            const podsByOwner: Record<string, Pod[]> = {};
            nsPods.forEach(p => {
                const owner = p.ownerRef?.name || 'standalone';
                if (!podsByOwner[owner]) podsByOwner[owner] = [];
                podsByOwner[owner].push(p);
            });
            const owners = Object.keys(podsByOwner);

            // 1. Prepare Modules (Size only)
            const preparedModules = owners.map(owner => {
                const pods = podsByOwner[owner];
                const cols = Math.ceil(Math.sqrt(pods.length));
                const rows = Math.ceil(pods.length / cols);

                const modW = Math.max(2, cols * (CAPSULE_SIZE + 0.2) + 0.5);
                const modD = Math.max(2, rows * (CAPSULE_SIZE + 0.2) + 0.5);

                const capsules: CapsuleLayout[] = pods.map((pod, idx) => {
                    const r = Math.floor(idx / cols);
                    const c = idx % cols;
                    return {
                        pod,
                        position: [
                            (c - (cols - 1) / 2) * (CAPSULE_SIZE + 0.2),
                            0.5,
                            (r - (rows - 1) / 2) * (CAPSULE_SIZE + 0.2)
                        ]
                    };
                });

                return {
                    owner,
                    width: modW,
                    depth: modD,
                    capsules
                };
            });

            // 2. Pack Modules Grid (Bin Packing simple approach)
            let currentX = 0;
            let currentZ = 0;
            let rowMaxDepth = 0;
            const modules: ModuleLayout[] = [];

            preparedModules.forEach(mod => {
                // Check if fits in current row
                if (currentX + mod.width > WING_WIDTH - 1) {
                    // Next row
                    currentX = 0;
                    currentZ += rowMaxDepth + MODULE_PADDING;
                    rowMaxDepth = 0;
                }

                const posX = currentX + mod.width / 2;
                const posZ = currentZ + mod.depth / 2;

                modules.push({
                    ...mod,
                    position: [posX, 0.5, posZ]
                });

                currentX += mod.width + MODULE_PADDING;
                rowMaxDepth = Math.max(rowMaxDepth, mod.depth);
            });

            const totalModDepth = currentZ + rowMaxDepth;

            // Center everything X-wise
            const totalWidthUsed = WING_WIDTH;
            modules.forEach(m => {
                m.position[0] -= totalWidthUsed / 2;
                m.position[2] -= totalModDepth / 2;
            });

            const sectorLength = Math.max(5, totalModDepth + SECTOR_PADDING);
            const layout = {
                name: ns,
                offset: currentOffset + sectorLength / 2,
                length: sectorLength,
                modules
            };
            currentOffset += sectorLength;
            return layout;
        });

        // Final dimensions
        const totalLength = Math.max(20, currentOffset + 2);

        return {
            node,
            angle: i * angleStep,
            distance: INNER_RING_RADIUS,
            length: totalLength,
            width: WING_WIDTH,
            sectors
        };
    });
};

export const OrbitalStation3D: React.FC<OrbitalStation3DProps> = ({ topology }) => {
    if (!topology) return <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-500 font-mono animate-pulse">Initializing Uplink...</div>;

    const nodes = useMemo(() => topology.nodes.sort((a, b) => a.name.localeCompare(b.name)), [topology]);
    const nodeLayouts = useMemo(() => calculateStationLayout(nodes, topology), [nodes, topology]);

    // Space Background Color (Lighter Deep Blue)
    const VOID_COLOR = '#0f172a';

    return (
        <div className="w-full h-screen bg-[#0f172a]">
            <Canvas shadows camera={{ position: [0, 100, 100], fov: 35 }}>
                <color attach="background" args={[VOID_COLOR]} />
                <fog attach="fog" args={[VOID_COLOR, 100, 500]} />

                <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
                <ambientLight intensity={0.5} />

                <directionalLight
                    position={[100, 100, 50]}
                    intensity={1.8}
                    color="#ddeeff"
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                />
                <spotLight position={[-100, 50, -100]} intensity={3} color="#6677cc" angle={0.5} penumbra={1} />
                <pointLight position={[0, -50, 0]} intensity={1} color="#334466" />

                <OrbitControls makeDefault maxPolarAngle={Math.PI / 1.5} minDistance={20} maxDistance={250} />

                <StationRotator>
                    <StationHub />
                    <group>
                        {nodeLayouts.map((layout) => (
                            <StationWing
                                key={layout.node.name}
                                layout={layout}
                            />
                        ))}
                    </group>
                    <DroneSwarm />
                </StationRotator>

            </Canvas>
        </div>
    );
};

const StationRotator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.02;
        }
    });
    return <group ref={groupRef}>{children}</group>;
}

const DroneSwarm: React.FC = () => {
    const drones = useMemo(() => Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        offset: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.3,
        radius: 15 + Math.random() * 40,
        height: (Math.random() - 0.5) * 10
    })), []);

    return (
        <group>
            {drones.map(drone => (
                <Drone key={drone.id} {...drone} />
            ))}
        </group>
    )
}

const Drone: React.FC<{ offset: number, speed: number, radius: number, height: number }> = ({ offset, speed, radius, height }) => {
    const ref = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        if (ref.current) {
            const t = clock.getElapsedTime() * speed + offset;
            ref.current.position.x = Math.sin(t) * radius;
            ref.current.position.z = Math.cos(t) * radius;
            ref.current.position.y = height + Math.sin(t * 2) * 2;
            ref.current.lookAt(0, height, 0);
        }
    });

    return (
        <group ref={ref}>
            <mesh>
                <coneGeometry args={[0.2, 0.8, 4]} />
                <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={2} />
            </mesh>
            <pointLight distance={5} intensity={1} color="#ffaa00" />
        </group>
    );
}

const StationHub: React.FC = () => {
    return (
        <group>
            {/* Core Cylinder - Silver */}
            <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[HUB_RADIUS, HUB_RADIUS, 12, 64]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.2} metalness={0.8} />
            </mesh>
            {/* Energy Ring */}
            <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[HUB_RADIUS + 0.5, HUB_RADIUS + 0.5, 1, 64]} />
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} toneMapped={false} />
            </mesh>
            {/* Top Dome - Silver */}
            <mesh position={[0, 6, 0]}>
                <sphereGeometry args={[HUB_RADIUS, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.7} />
            </mesh>
            {/* Bottom Dome - Silver */}
            <mesh position={[0, -6, 0]} rotation={[Math.PI, 0, 0]}>
                <sphereGeometry args={[HUB_RADIUS, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.7} />
            </mesh>
        </group>
    );
}

const StationWing: React.FC<{ layout: StationNodeLayout }> = ({ layout }) => {
    const { angle, distance, length, width, node, sectors } = layout;

    // Calculate wing center
    const centerX = Math.sin(angle) * (distance + length / 2);
    const centerZ = Math.cos(angle) * (distance + length / 2);

    return (
        <group position={[centerX, 0, centerZ]} rotation={[0, angle, 0]}>
            {/* Main Hull Structure - White/Silver */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[width, WING_HEIGHT, length]} />
                <meshStandardMaterial color="#f1f5f9" roughness={0.2} metalness={0.6} />
            </mesh>

            {/* Spine Data Stream */}
            <mesh position={[0, WING_HEIGHT / 2 + 0.05, 0]}>
                <boxGeometry args={[1.5, 0.05, length - 1]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.5} metalness={0.8} />
            </mesh>

            {/* Node Label */}
            <Html position={[0, 6, -length / 2]} center transform sprite zIndexRange={[100, 0]}>
                <div className="bg-black/80 border border-cyan-500 text-cyan-400 px-3 py-1 rounded text-sm font-mono tracking-widest uppercase shadow-[0_0_10px_rgba(0,255,255,0.3)] backdrop-blur-sm whitespace-nowrap">
                    {node.name}
                </div>
            </Html>

            {/* Sectors */}
            {sectors.map(sector => (
                <group key={sector.name} position={[0, WING_HEIGHT / 2, sector.offset - length / 2]}>
                    {/* Sector Marking */}
                    <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[width - 0.5, sector.length - 0.5]} />
                        <meshStandardMaterial color="#cbd5e0" roughness={0.4} metalness={0.5} />
                    </mesh>

                    {/* Sector Label (Namespace) - HTML Overlay to prevent 3D overlap */}
                    <Html position={[-width / 2 - 2, 2, 0]} center transform sprite zIndexRange={[50, 0]}>
                        <div className="text-sm font-bold text-slate-300 tracking-widest uppercase rotate-[-90deg] whitespace-nowrap opacity-60 pointer-events-none">
                            {sector.name}
                        </div>
                    </Html>

                    {/* Modules */}
                    {sector.modules.map((mod, i) => (
                        <Module3D key={i} module={mod} />
                    ))}
                </group>
            ))}
        </group>
    );
};

const Module3D: React.FC<{ module: ModuleLayout }> = ({ module }) => {
    const [hovered, setHover] = useState(false);

    return (
        <group position={module.position}>
            {/* Module Hull - Interactivity for Hover */}
            <mesh
                castShadow
                receiveShadow
                onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
                onPointerOut={(e) => { setHover(false); }}
            >
                <boxGeometry args={[module.width, 1, module.depth]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.6} />
            </mesh>

            {/* Deployment Label (Floating above) - Only on Hover */}
            {hovered && (
                <Html position={[0, 1.5, -module.depth / 2]} center transform sprite zIndexRange={[80, 0]}>
                    <div className="bg-slate-900/90 text-[10px] text-cyan-200 px-2 py-1 rounded border border-cyan-500/50 whitespace-nowrap backdrop-blur-sm shadow-xl pointer-events-none">
                        {module.owner}
                    </div>
                </Html>
            )}

            {/* Capsules */}
            {module.capsules.map((cap, j) => (
                <Capsule3D key={cap.pod.name} capsule={cap} />
            ))}
        </group>
    );
};

const Capsule3D: React.FC<{ capsule: CapsuleLayout }> = ({ capsule }) => {
    const { pod, position } = capsule;
    const [hovered, setHover] = useState(false);

    const isReady = pod.isReady;
    const isPending = pod.status === 'Pending';
    const isError = !isReady && !isPending;

    const color = isError ? '#ff3333' : (isPending ? '#ffaa00' : '#00ffd0');

    return (
        <group position={position}>
            {/* Capsule Geometry */}
            <mesh
                castShadow
                onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
                onPointerOut={(e) => { e.stopPropagation(); setHover(false); }}
            >
                <capsuleGeometry args={[CAPSULE_SIZE / 3, 0.6, 4, 8]} />
                <meshStandardMaterial
                    color="#111"
                    emissive={color}
                    emissiveIntensity={hovered ? 2 : (isReady ? 0.8 : 0.5)}
                    roughness={0.2}
                    metalness={0.8}
                />
            </mesh>

            {/* Status Ring for Error */}
            {isError && (
                <mesh position={[0, -0.3, 0]}>
                    <torusGeometry args={[0.3, 0.05, 8, 16]} />
                    <meshBasicMaterial color="#ff0000" />
                </mesh>
            )}

            {hovered && (
                <Html position={[0, 1.5, 0]} center zIndexRange={[200, 0]}>
                    <div className="bg-black/90 text-cyan-50 border border-cyan-500/50 text-xs p-2 rounded shadow-xl whitespace-nowrap pointer-events-none">
                        <div className="font-bold text-cyan-300">{pod.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{pod.status || 'Unknown'}</div>
                    </div>
                </Html>
            )}
        </group>
    );
};
