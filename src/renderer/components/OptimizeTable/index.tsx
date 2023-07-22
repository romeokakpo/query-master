import React, {
  useState,
  useCallback,
  ReactElement,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import styles from './styles.module.css';

interface OptimizeTableProps {
  data: unknown[][];
  headers: {
    name: string;
    initialSize: number;
    resizable?: boolean;
    icon?: ReactElement;
  }[];
  renderCell: (y: number, x: number) => ReactElement;
  rowHeight: number;
  renderAhead: number;
  selectedRowsIndex: number[]; // Array of selected row indices
  onSelectedRowsIndexChanged: (selectedRows: number[]) => void; // Callback for row selection changes
}

function ResizeHandler({
  idx,
  onResize,
}: {
  idx: number;
  onResize: (idx: number, newSize: number) => void;
}) {
  const handlerRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    if (handlerRef.current && resizing) {
      const table = handlerRef.current?.parentNode?.parentNode?.parentNode
        ?.parentNode as HTMLTableElement;

      const tableWrapper = table.parentNode?.parentNode as HTMLDivElement;

      let lastX = -100;

      if (table && tableWrapper) {
        const onMouseMove = (e: MouseEvent) =>
          requestAnimationFrame(() => {
            if (lastX < 0) {
              lastX = e.clientX;
              return;
            }

            const edgeDirection =
              tableWrapper.getBoundingClientRect().right - e.clientX > 0
                ? 1
                : -1;
            const edgeResizing =
              Math.abs(tableWrapper.getBoundingClientRect().right - e.clientX) <
              3;

            let gain = 0;
            if (edgeResizing) {
              gain = edgeDirection * 2;
            } else {
              gain = e.clientX - lastX;
            }

            const cell = handlerRef.current?.parentNode as HTMLTableCellElement;
            const cellWidth = cell.getBoundingClientRect().width;

            let width = cellWidth;
            if (cellWidth + gain >= 100) {
              width = cellWidth + gain;
            } else {
              width = 100;
              gain = 0;
            }

            lastX = e.clientX;
            if (edgeResizing) {
              tableWrapper.scrollLeft += gain;
            }

            onResize(idx, width);

            if (table) {
              const columns = table.style.gridTemplateColumns.split(' ');
              columns[idx] = width + 'px';
              table.style.gridTemplateColumns = columns.join(' ');
            }

            if (edgeResizing) {
              tableWrapper.scrollLeft += gain;
            }
          });

        const onMouseUp = () => {
          setResizing(false);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        return () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };
      }
    }
  }, [handlerRef, idx, resizing, setResizing, onResize]);

  return (
    <div
      className={styles.resizer}
      ref={handlerRef}
      onMouseDown={() => setResizing(true)}
    ></div>
  );
}

export default function OptimizeTable({
  data,
  headers,
  renderCell,
  rowHeight,
  renderAhead,
  selectedRowsIndex,
  onSelectedRowsIndexChanged,
}: OptimizeTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [visibleDebounce, setVisibleDebounce] = useState<{
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
  }>({
    rowStart: 0,
    rowEnd: 0,
    colStart: 0,
    colEnd: 0,
  });

  const [headerSizes] = useState(() => {
    return headers.map((header) => header.initialSize);
  });

  const recalculateVisible = useCallback(
    (e: HTMLDivElement) => {
      const currentRowStart = Math.max(
        0,
        Math.floor(e.scrollTop / rowHeight) - 1 - renderAhead
      );
      const currentRowEnd = Math.min(
        data.length,
        currentRowStart +
          Math.ceil(e.getBoundingClientRect().height / rowHeight) +
          renderAhead
      );

      let currentColStart = -1;
      let currentColAccumulateSize = 0;
      let currentColEnd = -1;

      const visibleXStart = e.scrollLeft;
      const visibleXEnd = visibleXStart + e.getBoundingClientRect().width;

      for (let i = 0; i < headerSizes.length; i++) {
        if (currentColAccumulateSize >= visibleXStart && currentColStart < 0) {
          currentColStart = i - 1;
        }

        currentColAccumulateSize += headerSizes[i];

        if (currentColAccumulateSize >= visibleXEnd && currentColEnd < 0) {
          currentColEnd = i;
          break;
        }
      }

      if (currentColEnd < 0) currentColEnd = headerSizes.length - 1;
      if (currentColStart < 0) currentColStart = 0;
      if (currentColEnd >= headerSizes.length)
        currentColEnd = headerSizes.length - 1;

      setVisibleDebounce({
        rowEnd: currentRowEnd,
        rowStart: currentRowStart,
        colStart: currentColStart,
        colEnd: currentColEnd,
      });
    },
    [setVisibleDebounce, data, rowHeight, renderAhead, headerSizes]
  );

  const onHeaderResize = useCallback(
    (idx: number, newWidth: number) => {
      if (containerRef.current) {
        headerSizes[idx] = newWidth;
        recalculateVisible(containerRef.current);
      }
    },
    [headerSizes, recalculateVisible, containerRef]
  );

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
      recalculateVisible(e.currentTarget);

      e.preventDefault();
      e.stopPropagation();
    },
    [recalculateVisible]
  );

  const handleRowSelection = useCallback(
    (rowIndex: number, isCtrlKey: boolean, isShiftKey: boolean) => {
      let updatedSelectedRowsIndex: number[] = [];

      if (isCtrlKey) {
        // If CTRL key is pressed, toggle the selection of the clicked row
        if (selectedRowsIndex.includes(rowIndex)) {
          updatedSelectedRowsIndex = selectedRowsIndex.filter(
            (index) => index !== rowIndex
          );
        } else {
          updatedSelectedRowsIndex = [...selectedRowsIndex, rowIndex];
        }
      } else if (isShiftKey) {
        // If SHIFT key is pressed, select rows from the last selected row to the clicked row
        const lastIndex = selectedRowsIndex[selectedRowsIndex.length - 1];
        const start = Math.min(lastIndex, rowIndex);
        const end = Math.max(lastIndex, rowIndex);

        for (let i = start; i <= end; i++) {
          updatedSelectedRowsIndex.push(i);
        }
      } else {
        updatedSelectedRowsIndex = [rowIndex];
      }

      onSelectedRowsIndexChanged(updatedSelectedRowsIndex);
    },
    [selectedRowsIndex, onSelectedRowsIndexChanged]
  );

  const handleRowClick = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>, rowIndex: number) => {
      const isCtrlKey = e.ctrlKey || e.metaKey;
      const isShiftKey = e.shiftKey;
      handleRowSelection(rowIndex, isCtrlKey, isShiftKey);
    },
    [handleRowSelection]
  );

  useEffect(() => {
    if (containerRef.current) {
      recalculateVisible(containerRef.current);
    }
  }, [containerRef, recalculateVisible]);

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          recalculateVisible(entry.target as HTMLDivElement);
        }
      });

      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [containerRef, recalculateVisible]);

  return useMemo(() => {
    const paddingTop = visibleDebounce.rowStart * rowHeight;
    const paddingBottom = (data.length - visibleDebounce.rowEnd) * rowHeight;

    const windowArray = new Array(
      visibleDebounce.rowEnd - visibleDebounce.rowStart
    )
      .fill(false)
      .map(() => new Array(data[0].length).fill(false));

    const cells = windowArray.map((row, rowIndex) => {
      const absoluteRowIndex = rowIndex + visibleDebounce.rowStart;
      const isRowSelected = selectedRowsIndex.includes(absoluteRowIndex);
      return (
        <tr
          key={absoluteRowIndex}
          onClick={(e) => handleRowClick(e, absoluteRowIndex)}
          className={isRowSelected ? styles.selectedRow : undefined}
        >
          {visibleDebounce.colStart > 0 && (
            <td
              style={{
                gridColumn: `span ${visibleDebounce.colStart}`,
              }}
            />
          )}
          {row
            .slice(visibleDebounce.colStart, visibleDebounce.colEnd + 1)
            .map((_, cellIndex) => (
              <td key={cellIndex + visibleDebounce.colStart}>
                <div className={styles.tableCellContent}>
                  {renderCell(
                    absoluteRowIndex,
                    cellIndex + visibleDebounce.colStart
                  )}
                </div>
              </td>
            ))}
          {visibleDebounce.colEnd < headerSizes.length - 1 && (
            <td
              style={{
                gridColumn: `span ${
                  headerSizes.length - 1 - visibleDebounce.colEnd
                }`,
              }}
            />
          )}
        </tr>
      );
    });

    return (
      <div
        ref={containerRef}
        className={`${styles.tableContainer} scroll`}
        onScroll={onScroll}
      >
        <div
          style={{
            height: (data.length + 1) * rowHeight + 10,
            overflow: 'hidden',
          }}
        >
          <table
            style={{
              gridTemplateColumns: headerSizes
                .map((header) => header + 'px')
                .join(' '),
            }}
          >
            {/* This is table header */}
            <thead>
              <tr>
                {headers.map((header, idx) => (
                  <th key={header.name}>
                    {header.icon && (
                      <div className={styles.tableHeaderIcon}>
                        {header.icon}
                      </div>
                    )}
                    <div className={styles.tableCellContent}>{header.name}</div>
                    {header.resizable && (
                      <ResizeHandler idx={idx} onResize={onHeaderResize} />
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Add enough top padding to replace the row that we don't render */}
              {!!paddingTop && (
                <tr key="padding-top">
                  <td
                    style={{
                      height: paddingTop,
                      gridColumn: `span ${headers.length}`,
                    }}
                  />
                </tr>
              )}

              {cells}

              {/* Add enough bottom padding to replace the row that we don't render */}
              {!!paddingBottom && (
                <tr key="padding-bottom">
                  <td
                    style={{
                      height: paddingBottom,
                      gridColumn: `span ${headers.length}`,
                    }}
                  ></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, [
    visibleDebounce.rowEnd,
    visibleDebounce.rowStart,
    visibleDebounce.colEnd,
    visibleDebounce.colStart,
    data,
    renderCell,
    headerSizes,
    onScroll,
    rowHeight,
    headers,
    onHeaderResize,
    selectedRowsIndex,
  ]);
}
