import { parseMLIR } from './parser';

/**
 * Recursively compute a structural signature for a node based on its operation and inputs
 * @param {string} nodeId - The node ID to compute signature for
 * @param {Map} nodeMap - Map of all nodes
 * @param {Array} edges - All edges
 * @param {Map} memoized - Cache of already computed signatures
 * @returns {string} Structural signature
 */
function getStructuralSignature(nodeId, nodeMap, edges, memoized = new Map()) {
    if (memoized.has(nodeId)) {
        return memoized.get(nodeId);
    }

    const node = nodeMap.get(nodeId);
    if (!node) {
        return 'unknown';
    }

    // For input nodes, use label to distinguish different inputs
    // This ensures %a and %b are treated as different even though both are inputs
    if (node.type === 'input') {
        const sig = `input:${node.label || node.id}`;
        memoized.set(nodeId, sig);
        return sig;
    }

    // Find all edges where this node is the target (its inputs)
    const inputEdges = edges.filter(e => e.target === nodeId);

    // Sort inputs by source to get consistent ordering
    const inputs = inputEdges
        .map(e => getStructuralSignature(e.source, nodeMap, edges, memoized))
        .sort();

    // Signature is: operation_type(input1,input2,...)
    const sig = `${node.type}(${inputs.join(',')})`;
    memoized.set(nodeId, sig);
    return sig;
}

/**
 * Match nodes between two graphs based on structural equivalence
 * @param {Array} nodes1 - Nodes from graph 1
 * @param {Array} edges1 - Edges from graph 1
 * @param {Array} nodes2 - Nodes from graph 2
 * @param {Array} edges2 - Edges from graph 2
 * @returns {Map} Map from node1.id to matched node2.id
 */
function matchNodesByStructure(nodes1, edges1, nodes2, edges2) {
    const nodes1Map = new Map(nodes1.map(n => [n.id, n]));
    const nodes2Map = new Map(nodes2.map(n => [n.id, n]));

    // Compute signatures for all nodes
    const sig1ToNodes = new Map();
    const sig2ToNodes = new Map();

    nodes1.forEach(node => {
        const sig = getStructuralSignature(node.id, nodes1Map, edges1);
        if (!sig1ToNodes.has(sig)) {
            sig1ToNodes.set(sig, []);
        }
        sig1ToNodes.get(sig).push(node);
    });

    nodes2.forEach(node => {
        const sig = getStructuralSignature(node.id, nodes2Map, edges2);
        if (!sig2ToNodes.has(sig)) {
            sig2ToNodes.set(sig, []);
        }
        sig2ToNodes.get(sig).push(node);
    });

    // Match nodes with same signatures
    const matches = new Map(); // node1.id -> node2.id
    const usedNodes2 = new Set();

    sig1ToNodes.forEach((nodes1List, sig) => {
        const nodes2List = sig2ToNodes.get(sig);
        if (nodes2List) {
            // For nodes with same structure, try to match by position/order
            // This ensures nodes are only matched once
            const minLen = Math.min(nodes1List.length, nodes2List.length);
            for (let i = 0; i < minLen; i++) {
                // Only match if node2 hasn't been matched yet
                if (!usedNodes2.has(nodes2List[i].id)) {
                    matches.set(nodes1List[i].id, nodes2List[i].id);
                    usedNodes2.add(nodes2List[i].id);
                }
            }
        }
    });

    return matches;
}

/**
 * Diff two MLIR code strings using structural matching
 * @param {string} code1 - Original MLIR code
 * @param {string} code2 - Modified MLIR code
 * @returns {object} Diff results with categorized nodes
 */
export function diffMLIR(code1, code2) {
    const graph1 = parseMLIR(code1);
    const graph2 = parseMLIR(code2);

    // Match nodes by structural equivalence
    const matches = matchNodesByStructure(
        graph1.nodes,
        graph1.edges,
        graph2.nodes,
        graph2.edges
    );

    const nodes1Map = new Map(graph1.nodes.map(n => [n.id, n]));
    const nodes2Map = new Map(graph2.nodes.map(n => [n.id, n]));

    // Track which nodes from graph2 have been matched
    const matchedNodes2 = new Set(Array.from(matches.values()));

    // Categorize nodes
    const unchanged = [];
    const modified = [];
    const removed = [];
    const added = [];

    // Process nodes from graph1
    graph1.nodes.forEach(node1 => {
        const matchedNode2Id = matches.get(node1.id);

        if (matchedNode2Id) {
            // Matched - treat as unchanged (structurally equivalent)
            const node2 = nodes2Map.get(matchedNode2Id);
            unchanged.push({
                ...node1,
                diffStatus: 'unchanged',
                matchedId: matchedNode2Id,
                originalId: node1.id,
                newId: node2.id
            });
        } else {
            // No match - removed
            removed.push({ ...node1, diffStatus: 'removed' });
        }
    });

    // Process nodes from graph2 that weren't matched
    graph2.nodes.forEach(node2 => {
        if (!matchedNodes2.has(node2.id)) {
            // Not matched - added
            added.push({ ...node2, diffStatus: 'added' });
        }
    });

    return {
        graph1,
        graph2,
        unchanged,
        modified,
        added,
        removed,
        matches, // Map of matched node IDs for reference
        // Merged list for single graph view
        mergedNodes: [
            ...unchanged,
            ...added,
            ...removed,
            ...modified.map(m => m.new)
        ]
    };
}
