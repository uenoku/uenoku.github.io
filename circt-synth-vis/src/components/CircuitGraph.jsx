import React, { useMemo, useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { parseMLIR } from '../utils/parser';
import { layoutGraph } from '../utils/layout';

const NODE_RADIUS = 20;

// Color scheme for merged view
const DIFF_COLORS = {
    shared: '#6b7280',     // gray - in both graphs
    graph1: '#3b82f6',     // blue - only in first graph
    graph2: '#f59e0b',     // orange - only in second graph
};

const CircuitGraph = ({ code, onNodeHover, highlightedNodeId, onNodeClick }) => {
    const [layout, setLayout] = useState(null);
    const [isLayouting, setIsLayouting] = useState(false);

    // Parse MLIR and generate nodes/edges
    const { nodes, edges } = useMemo(() => {
        return parseMLIR(code);
    }, [code]);

    // Run Layout
    useEffect(() => {
        let mounted = true;
        const runLayout = async () => {
            setIsLayouting(true);
            const result = await layoutGraph(nodes, edges);
            if (mounted) {
                setLayout(result);
                setIsLayouting(false);
            }
        };
        runLayout();
        return () => { mounted = false; };
    }, [nodes, edges]);

    if (!layout || isLayouting) {
        return <div className="flex items-center justify-center h-full text-gray-400">Layouting...</div>;
    }

    // Calculate initial scale to fit entire graph in viewport
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth * 0.6 : 800;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight * 0.8 : 600;

    const scaleX = viewportWidth / layout.width;
    const scaleY = viewportHeight / layout.height;
    const initialScale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1x

    // Export functions
    const exportToSVG = () => {
        const svgElement = document.querySelector('.circuit-graph-wrapper svg');
        if (!svgElement) return;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'circuit-graph.svg';
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportToPNG = () => {
        const svgElement = document.querySelector('.circuit-graph-wrapper svg');
        if (!svgElement) return;

        const canvas = document.createElement('canvas');
        const bbox = svgElement.getBBox();
        canvas.width = bbox.width + 200;
        canvas.height = bbox.height + 200;

        const ctx = canvas.getContext('2d');
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const img = new Image();

        img.onload = () => {
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 100, 100);

            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'circuit-graph.png';
                link.click();
                URL.revokeObjectURL(url);
            });
        };

        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        img.src = url;
    };

    return (
        <div className="circuit-graph-wrapper">
            <div className="circuit-graph-stats">
                <div><span className="label">Total Nodes:</span> {layout.nodes.length}</div>
                <div><span className="label">Max Depth:</span> {layout.layers.length - 1}</div>
            </div>
            <div className="graph-container" style={{ position: 'relative' }}>
                <TransformWrapper
                    initialScale={initialScale}
                    minScale={0.05}
                    maxScale={4}
                    limitToBounds={false}
                    panning={{ disabled: false }}
                    wheel={{ step: 0.1 }}
                >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                            <div className="zoom-controls">
                                <button onClick={() => zoomIn()}>+</button>
                                <button onClick={() => zoomOut()}>-</button>
                                <button onClick={() => resetTransform()}>Reset</button>
                                <button onClick={exportToSVG} title="Export as SVG">SVG</button>
                                <button onClick={exportToPNG} title="Export as PNG">PNG</button>
                            </div>
                            <TransformComponent wrapperClass="transform-wrapper" contentClass="transform-content">
                                <svg width={layout.width} height={layout.height}>
                                    <defs>
                                        <marker id="arrow" markerWidth="10" markerHeight="10" refX="28" refY="3" orient="auto" markerUnits="strokeWidth">
                                            <path d="M0,0 L0,6 L9,3 z" fill="#9ca3af" />
                                        </marker>
                                    </defs>

                                    {/* Depth Labels and Bounding Boxes */}
                                    {layout.layers.map((layer, depth) => {
                                        if (!layer || !layer.nodes || layer.nodes.length === 0) return null;
                                        const { bounds } = layer;
                                        const padding = 20;
                                        const labelX = bounds.x + bounds.width / 2;

                                        return (
                                            <g key={`layer-${depth}`}>
                                                {/* Bounding box */}
                                                <rect
                                                    x={bounds.x - padding}
                                                    y={bounds.y - padding}
                                                    width={bounds.width + padding * 2}
                                                    height={bounds.height + padding * 2}
                                                    fill="rgba(55, 65, 81, 0.1)"
                                                    stroke="rgba(156, 163, 175, 0.3)"
                                                    strokeWidth="1"
                                                    rx="8"
                                                />
                                                {/* Depth label */}
                                                <text x={labelX} y={30} textAnchor="middle" fill="#9ca3af" fontSize="12" fontWeight="bold">
                                                    Depth {depth}
                                                </text>
                                                <text x={labelX} y={45} textAnchor="middle" fill="#6b7280" fontSize="10">
                                                    ({layer.nodes.length} nodes)
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* Edges */}
                                    {layout.edges.map((edge, i) => {
                                        // ELK provides sections for edges
                                        // edge.sections[0].startPoint, endPoint, bendPoints
                                        if (!edge.sections || edge.sections.length === 0) return null;

                                        const section = edge.sections[0];
                                        let d = `M ${section.startPoint.x} ${section.startPoint.y}`;
                                        if (section.bendPoints) {
                                            section.bendPoints.forEach(bp => {
                                                d += ` L ${bp.x} ${bp.y}`;
                                            });
                                        }
                                        d += ` L ${section.endPoint.x} ${section.endPoint.y}`;

                                        return (
                                            <g key={i}>
                                                <path
                                                    d={d}
                                                    stroke="#9ca3af"
                                                    strokeWidth="2"
                                                    fill="none"
                                                    markerEnd="url(#arrow)"
                                                    opacity="0.6"
                                                />
                                                {edge.isInverted && (
                                                    // Place inversion circle at midpoint or near target
                                                    // For simplicity, let's place it near the end point
                                                    <circle
                                                        cx={section.endPoint.x - 15} // Offset slightly back? Or just use midpoint of last segment
                                                        cy={section.endPoint.y}
                                                        r="4"
                                                        fill="white"
                                                        stroke="red"
                                                        strokeWidth="2"
                                                    />
                                                )}
                                            </g>
                                        );
                                    })}

                                    {/* Nodes */}
                                    {layout.nodes.map(node => {
                                        const isHighlighted = highlightedNodeId === node.id;
                                        // ELK gives top-left x,y. We need center for circle.
                                        const cx = node.x + node.width / 2;
                                        const cy = node.y + node.height / 2;

                                        return (
                                            <g
                                                key={node.id}
                                                transform={`translate(${cx},${cy})`}
                                                onMouseEnter={() => onNodeHover(node.id)}
                                                onMouseLeave={() => onNodeHover(null)}
                                                onClick={() => onNodeClick && onNodeClick(node.id)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <circle
                                                    cx={0}
                                                    cy={0}
                                                    r={isHighlighted ? NODE_RADIUS + 4 : NODE_RADIUS}
                                                    fill={
                                                        node.diffStatus
                                                            ? DIFF_COLORS[node.diffStatus]
                                                            : (node.type === 'input' ? '#3b82f6' : node.type === 'and' ? '#10b981' : node.type === 'maj' ? '#f59e0b' : '#6b7280')
                                                    }
                                                    stroke={node.isOutput ? '#ef4444' : isHighlighted ? 'yellow' : 'white'}
                                                    strokeWidth={node.isOutput ? "4" : isHighlighted ? "4" : "2"}
                                                />
                                                <text
                                                    dy=".3em"
                                                    textAnchor="middle"
                                                    fill="white"
                                                    fontSize="10"
                                                    pointerEvents="none"
                                                    style={{ textShadow: '0px 0px 2px black' }}
                                                >
                                                    {node.label}
                                                </text>
                                                <title>{node.id} (Line {node.line})</title>
                                            </g>
                                        );
                                    })}
                                </svg>
                            </TransformComponent>
                        </>
                    )}
                </TransformWrapper>
            </div>
        </div>
    );
};

export default CircuitGraph;
