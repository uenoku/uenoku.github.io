import React, { useRef, useEffect } from 'react';

const highlightMLIR = (code) => {
    return code.split('\n').map((line, i) => {
        // Skip empty lines
        if (!line.trim()) {
            return '<div class="mlir-line">&nbsp;</div>';
        }

        // Check if it's a comment line
        if (line.trim().startsWith('//')) {
            return `<div class="mlir-line"><span class="mlir-comment">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></div>`;
        }

        // Simple tokenization - split by spaces and special chars, but keep them
        const tokens = line.match(/(%[\w.]+|\b[\w.]+\b|[{}()\[\],=:;]|"[^"]*"|\s+)/g) || [line];

        let result = '<div class="mlir-line">';
        tokens.forEach(token => {
            // SSA values (%0, %1, etc.)
            if (/^%[\w.]+$/.test(token)) {
                result += `<span class="mlir-value">${token}</span>`;
            }
            // Types (i1, i32, !hw.inout, etc.)
            else if (/^(i\d+|ui\d+|![\w.<>]+)$/.test(token)) {
                result += `<span class="mlir-type">${token}</span>`;
            }
            // Keywords
            else if (/^(module|func|return|attributes)$/.test(token)) {
                result += `<span class="mlir-keyword">${token}</span>`;
            }
            // Operations (hw.module, comb.and, etc.)
            else if (/^(hw\.\w+|comb\.\w+|seq\.\w+)$/.test(token)) {
                result += token.endsWith('.module') || token.endsWith('.output')
                    ? `<span class="mlir-keyword">${token}</span>`
                    : `<span class="mlir-operation">${token}</span>`;
            }
            // Numbers
            else if (/^\d+$/.test(token)) {
                result += `<span class="mlir-number">${token}</span>`;
            }
            // Strings
            else if (/^".*"$/.test(token)) {
                result += `<span class="mlir-string">${token}</span>`;
            }
            // Attributes (@foo, #bar)
            else if (/^[@#][\w.]+$/.test(token)) {
                result += `<span class="mlir-attribute">${token}</span>`;
            }
            // Everything else (including whitespace)
            else {
                result += token.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
        });
        result += '</div>';

        return result;
    }).join('');
};

const CodeEditor = ({ code, onChange, highlightedLine, onLineHover, jumpToLine, onLineJumped }) => {
    const textareaRef = useRef(null);
    const backdropRef = useRef(null);
    const highlightRef = useRef(null);

    // Jump to line when clicked from graph
    useEffect(() => {
        if (jumpToLine && textareaRef.current) {
            const lines = code.split('\n');
            // Calculate character position for the target line
            let position = 0;
            for (let i = 0; i < jumpToLine - 1 && i < lines.length; i++) {
                position += lines[i].length + 1; // +1 for newline
            }

            // Set cursor position and focus
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(position, position);

            // Scroll to make the line visible
            const lineHeight = 21;
            const targetScroll = (jumpToLine - 1) * lineHeight - 100; // Center-ish
            textareaRef.current.scrollTop = Math.max(0, targetScroll);

            // Notify parent that we've jumped
            if (onLineJumped) {
                onLineJumped();
            }
        }
    }, [jumpToLine, code, onLineJumped]);

    const handleScroll = () => {
        if (backdropRef.current && textareaRef.current) {
            backdropRef.current.scrollTop = textareaRef.current.scrollTop;
            backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
        if (highlightRef.current && textareaRef.current) {
            highlightRef.current.scrollTop = textareaRef.current.scrollTop;
            highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    const handleMouseMove = (e) => {
        if (!textareaRef.current) return;
        const rect = textareaRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top + textareaRef.current.scrollTop;
        const lineHeight = 21;
        const lineIndex = Math.floor(y / lineHeight);
        if (onLineHover) {
            onLineHover(lineIndex + 1);
        }
    };

    const handleMouseLeave = () => {
        if (onLineHover) {
            onLineHover(null);
        }
    };

    return (
        <div className="code-editor-container" style={{ lineHeight: '21px' }}>
            {/* Backdrop for line highlighting */}
            <div
                ref={backdropRef}
                className="code-editor-backdrop"
                aria-hidden="true"
            >
                {code.split('\n').map((line, i) => (
                    <div
                        key={i}
                        className={`code-line ${highlightedLine === i + 1 ? 'highlighted' : ''}`}
                        style={{ height: '21px' }}
                    >
                        &nbsp;
                    </div>
                ))}
            </div>

            {/* Syntax highlighting layer */}
            <div
                ref={highlightRef}
                className="code-editor-highlight"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: highlightMLIR(code) }}
            />

            {/* Textarea */}
            <textarea
                ref={textareaRef}
                className="code-editor-textarea"
                style={{ lineHeight: '21px' }}
                value={code}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                spellCheck="false"
                autoFocus
            />
        </div>
    );
};

export default CodeEditor;
