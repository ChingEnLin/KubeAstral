import React, { useRef, useEffect, useState } from 'react';
import type { Topology, Node, Namespace, Workload, Pod } from '../types';

interface IsoMapProps {
    topology: Topology | null;
}

const TILE_WIDTH = 100;
const TILE_HEIGHT = 60; // Isometric scaling (usually W/2 or similar)

export const IsoMap: React.FC<IsoMapProps> = ({ topology }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            setScale(s => Math.min(Math.max(0.2, s - e.deltaY * 0.001), 3));
        };
        containerRef.current?.addEventListener('wheel', handleWheel, { passive: false });
        return () => containerRef.current?.removeEventListener('wheel', handleWheel);
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartPan({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setOffset({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    if (!topology) return <div className="text-gray-500 p-10">Loading City...</div>;

    // Simple layout logic: Grid of Nodes (Districts)
    // We'll calculate positions here for now.
    const nodes = topology.nodes.sort((a, b) => a.name.localeCompare(b.name));
    const columns = Math.ceil(Math.sqrt(nodes.length));

    return (
        <div
            ref={containerRef}
            className="w-full h-screen bg-[#f0f4f8] overflow-hidden relative cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div
                className="absolute top-1/2 left-1/2 transition-transform duration-75 ease-out origin-center"
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                }}
            >
                <div className="relative">
                    {nodes.map((node, index) => {
                        const row = Math.floor(index / columns);
                        const col = index % columns;

                        // Isometric Coordinate Transformation
                        // ScreenX = (IsoX - IsoY) * Width/2
                        // ScreenY = (IsoX + IsoY) * Height/2

                        // We treat the grid as spaced by 400x400 "world units"
                        const isoX = col * 4;
                        const isoY = row * 4;

                        const screenX = (isoX - isoY) * TILE_WIDTH;
                        const screenY = (isoX + isoY) * TILE_HEIGHT;

                        return (
                            <DistrictTile
                                key={node.name}
                                node={node}
                                x={screenX}
                                y={screenY}
                                topology={topology}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- Sub Components ---

const DistrictTile: React.FC<{ node: Node, x: number, y: number, topology: Topology }> = ({ node, x, y, topology }) => {
    // Find workloads on this node (via Namespace... actually workloads are namespace scoped, pods are node scoped)
    // Mapping approach:
    // Node -> contains Pods.
    // Visuals: We want to show "Neighborhoods" (Namespaces) on the Node platform.

    // Logic: Identify which namespaces have pods on THIS node.
    const nodePods = topology.pods.filter(p => p.nodeName === node.name);
    const activeNamespaces = Array.from(new Set(nodePods.map(p => p.namespace)));

    return (
        <div
            className="absolute group hover:z-50 transition-all duration-300"
            style={{ left: x, top: y, zIndex: 10 + Math.floor(y) }} // Painter's algorithm
        >
            {/* Base Platform */}
            <div className="w-[300px] h-[300px] absolute transform -translate-x-1/2 bg-gray-200 rounded-2xl shadow-xl border-4 border-gray-300"
                style={{
                    transform: 'rotateX(60deg) rotateZ(45deg) translate(-50%, -50%)', // Pseudo-iso rotation
                    backgroundColor: '#e2e8f0', // iso-ground-darker
                    boxShadow: '10px 10px 20px rgba(0,0,0,0.1), inset 0 0 20px rgba(255,255,255,0.5)'
                }}
            >
                <div className="absolute bottom-2 left-2 text-xs font-bold text-gray-400 transform -rotate-45">{node.name}</div>
            </div>

            {/* Content Layer (Billboards on top) */}
            <div className="absolute top-[-50px] left-[-100px] w-[200px] pointer-events-none">
                {/* We can render 2D items here that float above the tile */}
            </div>

            {/* Render Buildings (Workloads) */}
            {/* To keep it simple, we just stack pods for now */}
            <div className='absolute transform -translate-x-1/2 -translate-y-1/2' style={{ top: 0, left: 0 }}>
                {activeNamespaces.map((ns, idx) => (
                    <div key={ns} className="absolute" style={{
                        transform: `translate(${idx * 40}px, ${idx * 20}px)`
                    }}>
                        <div className="text-[10px] bg-blue-100 px-1 rounded opacity-70 mb-1">{ns}</div>
                        {/* Filter pods for this ns + node */}
                        {nodePods.filter(p => p.namespace === ns).map((pod, pIdx) => (
                            <PodWindow key={pod.name} pod={pod} index={pIdx} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

const PodWindow: React.FC<{ pod: Pod, index: number }> = ({ pod, index }) => {
    const color = pod.isReady ? 'bg-green-400' : (pod.status === 'Pending' ? 'bg-yellow-400' : 'bg-red-500');

    // Stack them vertically
    return (
        <div
            className={`w-4 h-4 ${color} border border-white shadow-sm inline-block m-px transition-transform hover:scale-150 cursor-pointer`}
            title={`${pod.name} (${pod.status})`}
        />
    )
}
