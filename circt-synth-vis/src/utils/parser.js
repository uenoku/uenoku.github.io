
/**
 * Parses MLIR code and returns a graph representation.
 * @param {string} code 
 * @returns {object} { nodes: [], edges: [] }
 */
export function parseMLIR(code) {
    const nodes = [];
    const edges = [];
    const valueToNodeId = {}; // Maps SSA value (e.g., "%0", "%a") to node ID

    // Helper to add node
    const addNode = (id, type, label, line) => {
        nodes.push({ id, type, label, line });
        valueToNodeId[id] = id; // Simple mapping for now
    };

    const lines = code.split('\n');

    lines.forEach((line, lineIndex) => {
        // 1-based line index for display/logic
        const currentLine = lineIndex + 1;
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) return;

        // Parse hw.module for inputs
        const moduleMatch = trimmed.match(/hw\.module\s+@\w+\s*\((.*)\)/);
        if (moduleMatch) {
            const args = moduleMatch[1].split(',');
            args.forEach(arg => {
                // match "in %a : type"
                const argMatch = arg.match(/in\s+(%\w+)\s*:/);
                if (argMatch) {
                    const name = argMatch[1];
                    addNode(name, 'input', name, currentLine);
                }
            });
            return;
        }

        // Parse synth.aig.and_inv
        // %0 = synth.aig.and_inv %b, not %b : i4
        const aigMatch = trimmed.match(/(%\w+)\s*=\s*synth\.aig\.and_inv\s+(.+?)\s*:\s*\w+/);
        if (aigMatch) {
            const result = aigMatch[1];
            const operandsStr = aigMatch[2];
            addNode(result, 'and', 'AND', currentLine);

            const operands = operandsStr.split(',').map(s => s.trim());
            operands.forEach(op => {
                const isInverted = op.startsWith('not ');
                const source = isInverted ? op.replace('not ', '').trim() : op;

                edges.push({
                    source: source,
                    target: result,
                    isInverted
                });
            });
            return;
        }

        // Parse synth.mig.maj_inv
        // %0 = synth.mig.maj_inv not %a, %a, %a ...
        const migMatch = trimmed.match(/(%\w+)\s*=\s*synth\.mig\.maj_inv\s+(.+?)\s*:\s*\w+/);
        if (migMatch) {
            const result = migMatch[1];
            const operandsStr = migMatch[2];
            // Remove attributes like {sv.namehint = ...}
            const cleanOperandsStr = operandsStr.replace(/\{.*?\}/, '');

            addNode(result, 'maj', 'MAJ', currentLine);

            const operands = cleanOperandsStr.split(',').map(s => s.trim()).filter(s => s);
            operands.forEach(op => {
                const isInverted = op.startsWith('not ');
                const source = isInverted ? op.replace('not ', '').trim() : op;

                edges.push({
                    source: source,
                    target: result,
                    isInverted
                });
            });
            return;
        }

        // Parse comb.extract
        // %0 = comb.extract %a from 0 : (i4) -> i1
        const extractMatch = trimmed.match(/(%\w+)\s*=\s*comb\.extract\s+(%\w+)\s+from\s+(\d+)\s*:/);
        if (extractMatch) {
            const result = extractMatch[1];
            const operand = extractMatch[2];
            const index = extractMatch[3];

            // Treat as input node with label operand[index]
            // Remove % from operand name for label
            const operandName = operand.replace('%', '');
            addNode(result, 'input', `${operandName}[${index}]`, currentLine);
            return;
        }

        // Other operations (hw.output, comb.concat, seq.compreg, etc.)
        const genericMatchWithResult = trimmed.match(/(%\w+)\s*=\s*([\w.]+)\s+(.+?)\s*:/);
        if (genericMatchWithResult) {
            const result = genericMatchWithResult[1];
            const opName = genericMatchWithResult[2];
            const operandsStr = genericMatchWithResult[3];


            if (opName.startsWith('synth.') || opName === 'comb.extract') return;

            addNode(result, 'output', opName, currentLine);

            const operands = operandsStr.split(',').map(s => s.trim()).filter(s => s.startsWith('%') || s.startsWith('not %'));
            operands.forEach(op => {
                const isInverted = op.startsWith('not ');
                const source = isInverted ? op.replace('not ', '').trim() : op;
                edges.push({ source, target: result, isInverted });
            });
            return;
        }

        // Operations without results (e.g., hw.output)
        const genericMatchNoResult = trimmed.match(/^([\w.]+)\s+(.+?)\s*:/);
        if (genericMatchNoResult) {
            const opName = genericMatchNoResult[1];
            const operandsStr = genericMatchNoResult[2];

            if (opName === 'hw.module' || opName.startsWith('synth.') || opName === 'comb.extract') return;

            // Mark operands as outputs instead of creating new nodes
            const operands = operandsStr.split(',').map(s => s.trim()).filter(s => s.startsWith('%') || s.startsWith('not %'));
            for (const operand of operands) {
                const sourceId = operand.replace(/^not /, '');
                const nodeMatch = nodes.find(n => n.id === sourceId);
                if (nodeMatch) {
                    nodeMatch.isOutput = true;
                }
            }
            return;
        }
    });

    // Filter unused input nodes
    const usedNodeIds = new Set();
    edges.forEach(edge => {
        usedNodeIds.add(edge.source);
        usedNodeIds.add(edge.target);
    });

    const filteredNodes = nodes.filter(node => {
        if (node.type !== 'input') return true;
        return usedNodeIds.has(node.id);
    });

    return { nodes: filteredNodes, edges };
}
