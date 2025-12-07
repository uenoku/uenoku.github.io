import React, { useState, useEffect } from 'react';
import CircuitGraph from './components/CircuitGraph';
import CodeEditor from './components/CodeEditor';
import { parseMLIR } from './utils/parser';
import { diffMLIR } from './utils/differ';

const DEFAULT_CODE = `// Example MLIR with comb.extract
hw.module @counter(in %a : i4, in %clk : !seq.clock, out result : i4) {
    %reg = seq.compreg %46, %clk : i4  
    %0 = comb.extract %a from 0 : (i4) -> i1
    %1 = comb.extract %a from 1 : (i4) -> i1
    %2 = comb.extract %a from 2 : (i4) -> i1
    %3 = comb.extract %a from 3 : (i4) -> i1
    %4 = comb.extract %reg from 0 : (i4) -> i1
    %5 = comb.extract %reg from 1 : (i4) -> i1
    %6 = comb.extract %reg from 2 : (i4) -> i1
    %7 = comb.extract %reg from 3 : (i4) -> i1
    %8 = synth.aig.and_inv %0, %4 : i1
    %9 = synth.aig.and_inv %0, %5 : i1
    %10 = synth.aig.and_inv %0, %6 : i1
    %11 = synth.aig.and_inv %0, %7 : i1
    %12 = synth.aig.and_inv %4, %1 : i1
    %13 = synth.aig.and_inv %5, %1 : i1
    %14 = synth.aig.and_inv %6, %1 : i1
    %15 = synth.aig.and_inv %4, %2 : i1
    %16 = synth.aig.and_inv %5, %2 : i1
    %17 = synth.aig.and_inv %4, %3 : i1
    %18 = synth.aig.and_inv not %13, not %15 : i1
    %19 = synth.aig.and_inv %13, %15 : i1
    %20 = synth.aig.and_inv not %18, not %19 : i1
    %21 = synth.aig.and_inv not %10, not %20 : i1
    %22 = synth.aig.and_inv %10, %20 : i1
    %23 = synth.aig.and_inv not %21, not %22 : i1
    %24 = synth.aig.and_inv not %19, not %22 : i1
    %25 = synth.aig.and_inv not %9, not %12 : i1
    %26 = synth.aig.and_inv %9, %12 : i1
    %27 = synth.aig.and_inv not %25, not %26 : i1
    %28 = synth.aig.and_inv not %23, not %26 : i1
    %29 = synth.aig.and_inv %23, %26 : i1
    %30 = synth.aig.and_inv not %28, not %29 : i1
    %31 = synth.aig.and_inv not %14, not %17 : i1
    %32 = synth.aig.and_inv %14, %17 : i1
    %33 = synth.aig.and_inv not %31, not %32 : i1
    %34 = synth.aig.and_inv not %11, not %16 : i1
    %35 = synth.aig.and_inv %11, %16 : i1
    %36 = synth.aig.and_inv not %34, not %35 : i1
    %37 = synth.aig.and_inv not %33, not %36 : i1
    %38 = synth.aig.and_inv %33, %36 : i1
    %39 = synth.aig.and_inv not %37, not %38 : i1
    %40 = synth.aig.and_inv %24, not %39 : i1
    %41 = synth.aig.and_inv not %24, %39 : i1
    %42 = synth.aig.and_inv not %40, not %41 : i1
    %43 = synth.aig.and_inv not %29, not %42 : i1
    %44 = synth.aig.and_inv %29, %42 : i1
    %45 = synth.aig.and_inv not %43, not %44 : i1
    %46 = comb.concat %45, %30, %27, %8 : i1, i1, i1, i1
    hw.output %reg : i4
}`;

function App() {
  const [mode, setMode] = useState('single'); // 'single' or 'diff'

  const [code, setCode] = useState(DEFAULT_CODE);
  const [code2, setCode2] = useState(DEFAULT_CODE);

  const [hoveredLine, setHoveredLine] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [clickedLine, setClickedLine] = useState(null);

  // Separate hover states for diff mode
  const [hoveredLine1, setHoveredLine1] = useState(null);
  const [hoveredNodeId1, setHoveredNodeId1] = useState(null);
  const [hoveredLine2, setHoveredLine2] = useState(null);
  const [hoveredNodeId2, setHoveredNodeId2] = useState(null);

  // Parse code to get node-line mapping
  const { nodes } = parseMLIR(code);

  // When hoveredNodeId changes, update hoveredLine (single mode)
  useEffect(() => {
    if (hoveredNodeId) {
      // In diff mode, search in both code files
      if (mode === 'diff') {
        const { nodes: nodes1 } = parseMLIR(code);
        const { nodes: nodes2 } = parseMLIR(code2);
        const node = nodes1.find(n => n.id === hoveredNodeId) || nodes2.find(n => n.id === hoveredNodeId);
        if (node && node.line) {
          setHoveredLine(node.line);
        }
      } else {
        const node = nodes.find(n => n.id === hoveredNodeId);
        if (node && node.line) {
          setHoveredLine(node.line);
        }
      }
    } else {
      setHoveredLine(null);
    }
  }, [hoveredNodeId, code, code2, mode]);

  // Update hoveredLine1 when hoveredNodeId1 changes
  useEffect(() => {
    if (hoveredNodeId1) {
      const { nodes: nodes1 } = parseMLIR(code);
      const node = nodes1.find(n => n.id === hoveredNodeId1);
      if (node && node.line) {
        setHoveredLine1(node.line);
      }
    } else {
      setHoveredLine1(null);
    }
  }, [hoveredNodeId1, code]);

  // Update hoveredLine2 when hoveredNodeId2 changes
  useEffect(() => {
    if (hoveredNodeId2) {
      const { nodes: nodes2 } = parseMLIR(code2);
      const node = nodes2.find(n => n.id === hoveredNodeId2);
      if (node && node.line) {
        setHoveredLine2(node.line);
      }
    } else {
      setHoveredLine2(null);
    }
  }, [hoveredNodeId2, code2]);

  const handleNodeClick = (nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.line) {
      setClickedLine(node.line);
    }
  };

  // Render single view mode
  if (mode === 'single') {
    return (
      <div className="app">
        {/* Mode Toggle */}
        <div className="mode-toggle">
          <button className="active" onClick={() => setMode('single')}>Single View</button>
          <button onClick={() => setMode('diff')}>Diff View</button>
        </div>

        <div className="sidebar">
          <div className="editor-wrapper">
            <CodeEditor
              code={code}
              onChange={setCode}
              highlightedLine={hoveredLine}
              onLineHover={(line) => {
                const node = nodes.find(n => n.line === line);
                setHoveredNodeId(node ? node.id : null);
              }}
              jumpToLine={clickedLine}
              onLineJumped={() => setClickedLine(null)}
            />
          </div>
        </div>
        <div className="viz-canvas">
          <CircuitGraph
            code={code}
            onNodeHover={setHoveredNodeId}
            highlightedNodeId={hoveredNodeId}
            onNodeClick={handleNodeClick}
          />
        </div>
      </div>
    );
  }

  // Render diff view mode
  const diffData = diffMLIR(code, code2);

  return (
    <div className="app">
      <div className="mode-toggle">
        <button
          className={mode === 'single' ? 'active' : ''}
          onClick={() => setMode('single')}
        >
          Single
        </button>
        <button
          className={mode === 'diff' ? 'active' : ''}
          onClick={() => setMode('diff')}
        >
          Diff
        </button>
      </div>

      <div className="diff-container">
        <div className="editors-column">
          <div className="editor-wrapper">
            <h3>Code 1</h3>
            <CodeEditor
              code={code}
              onChange={setCode}
              highlightedLine={hoveredLine1}
              clickedLine={clickedLine}
              onLineHover={(line) => {
                const { nodes: nodes1 } = parseMLIR(code);
                const node = nodes1.find(n => n.line === line);
                setHoveredNodeId1(node ? node.id : null);
              }}
            />
          </div>
          <div className="editor-wrapper">
            <h3>Code 2</h3>
            <CodeEditor
              code={code2}
              onChange={setCode2}
              highlightedLine={hoveredLine2}
              clickedLine={clickedLine}
              onLineHover={(line) => {
                const { nodes: nodes2 } = parseMLIR(code2);
                const node = nodes2.find(n => n.line === line);
                setHoveredNodeId2(node ? node.id : null);
              }}
            />
          </div>
        </div>

        <div className="graphs-side-by-side">
          <div className="graph-pane">
            <h3>Graph 1</h3>
            <CircuitGraph
              code={code}
              onNodeHover={setHoveredNodeId1}
              highlightedNodeId={hoveredNodeId1}
              onNodeClick={handleNodeClick}
            />
          </div>
          <div className="graph-pane">
            <h3>Graph 2</h3>
            <CircuitGraph
              code={code2}
              onNodeHover={setHoveredNodeId2}
              highlightedNodeId={hoveredNodeId2}
              onNodeClick={handleNodeClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
