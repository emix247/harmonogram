import { useState, useCallback, useRef } from 'react';

/**
 * Provides draggable column-resize logic for any <table>.
 *
 * Usage:
 *   const { widths, startResize } = useResizableColumns([200, 120, 100, ...]);
 *
 *   <table style={{ tableLayout: 'fixed', width: widths.reduce((s,w)=>s+w,0) }}>
 *     <th style={{ width: widths[0], position: 'relative' }}>
 *       Column A
 *       <ResizeHandle onMouseDown={e => startResize(0, e)} />
 *     </th>
 *     ...
 *   </table>
 */
export function useResizableColumns(initialWidths: number[]) {
  const [widths, setWidths] = useState<number[]>(initialWidths);
  // keep a ref so the stable startResize callback always reads current widths
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const startResize = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widthsRef.current[colIndex];

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(40, startWidth + ev.clientX - startX);
      setWidths(prev => {
        const next = [...prev];
        next[colIndex] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  return { widths, startResize };
}

/** Thin resize handle rendered at the right edge of a <th>. */
export function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 4,
        cursor: 'col-resize',
        userSelect: 'none',
        zIndex: 1,
      }}
      className="group/rh"
    >
      <div
        style={{
          position: 'absolute',
          right: 1,
          top: '20%',
          bottom: '20%',
          width: 2,
          borderRadius: 2,
          backgroundColor: 'transparent',
          transition: 'background-color 0.15s',
        }}
        className="group-hover/rh:bg-blue-400"
      />
    </div>
  );
}
