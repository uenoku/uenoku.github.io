import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

export const layoutGraph = async (nodes, edges) => {
    // Filter invalid edges
    const nodeIds = new Set(nodes.map(n => n.id));
    const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    const elkGraph = {
        id: "root",
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.spacing.nodeNode': '40',
            'elk.layered.spacing.nodeNodeBetweenLayers': '80',
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.padding': '[top=80,left=20,bottom=20,right=20]', // Add top padding for labels
        },
        children: nodes.map(n => ({
            id: n.id,
            width: 40, // NODE_RADIUS * 2
            height: 40,

            ...n
        })),
        edges: validEdges.map((e, i) => ({
            id: `e${i}`,
            sources: [e.source],
            targets: [e.target],

            ...e
        }))
    };

    try {
        const layout = await elk.layout(elkGraph);

        // Group nodes by X coordinate for depth visualization
        const layersMap = new Map();
        layout.children.forEach(node => {

            const x = Math.round(node.x / 10) * 10;
            if (!layersMap.has(x)) {
                layersMap.set(x, []);
            }
            layersMap.get(x).push(node);
        });


        const sortedX = Array.from(layersMap.keys()).sort((a, b) => a - b);
        const layers = sortedX.map(x => {
            const nodes = layersMap.get(x);
            // Calculate bounding box for the layer
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            nodes.forEach(n => {
                minX = Math.min(minX, n.x);
                maxX = Math.max(maxX, n.x + n.width);
                minY = Math.min(minY, n.y);
                maxY = Math.max(maxY, n.y + n.height);
            });

            return {
                nodes,
                x: minX, // approximate x for label
                bounds: {
                    x: minX,
                    y: minY - 60, // Add extra top padding for labels (labels at y=30 and y=45)
                    width: maxX - minX,
                    height: maxY - minY + 60 // Account for the top padding shift
                }
            };
        });

        return {
            nodes: layout.children,
            edges: layout.edges,
            width: layout.width,
            height: layout.height,
            layers: layers
        };
    } catch (err) {
        console.error("ELK Layout Error:", err);
        return { nodes: [], edges: [], width: 0, height: 0, layers: [] };
    }
};
