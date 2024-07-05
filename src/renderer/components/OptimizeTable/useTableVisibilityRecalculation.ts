import { useCallback, useEffect, useState } from 'react';
import useElementResize from 'renderer/hooks/useElementResize';
import { getVisibleCellRange } from './helper';
import { OptimizeTableHeaderWithIndexProps } from '.';

export default function useTableVisibilityRecalculation({
  containerRef,
  totalRowCount,
  headerSizes,
  rowHeight,
  renderAhead,
  headers,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
  totalRowCount: number;
  headerSizes: number[];
  rowHeight: number;
  renderAhead: number;
  headers: OptimizeTableHeaderWithIndexProps[];
}) {
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

  const recalculateVisible = useCallback(
    (e: HTMLDivElement) => {
      setVisibleDebounce(
        getVisibleCellRange(
          e,
          headers.map((header) => headerSizes[header.index]),
          totalRowCount,
          rowHeight,
          renderAhead
        )
      );
    },
    [
      setVisibleDebounce,
      totalRowCount,
      rowHeight,
      renderAhead,
      headerSizes,
      headers,
    ]
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

  // Recalculate the visibility again when we scroll the container
  useEffect(() => {
    if (containerRef.current) {
      const onContainerScroll = (e: Event) => {
        recalculateVisible(e.currentTarget as HTMLDivElement);
        e.preventDefault();
        e.stopPropagation();
      };

      containerRef.current.addEventListener('scroll', onContainerScroll);
      return () =>
        containerRef.current?.removeEventListener('scroll', onContainerScroll);
    }
  }, [containerRef, recalculateVisible]);

  useElementResize<HTMLDivElement>(recalculateVisible, containerRef);

  return { visibileRange: visibleDebounce, onHeaderResize };
}
