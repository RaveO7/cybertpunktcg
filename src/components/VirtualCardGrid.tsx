"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type MutableRefObject,
} from "react";
import { CardTile } from "@/components/CardTile";
import type { CardDTO, PrintingDTO } from "@/lib/types";

const META_HEIGHT = 120;
const OVERSCAN_ROWS = 4;

export type CardGridLayout = {
  cols: number;
  gap: number;
  gapY: number;
  colWidth: number;
  rowHeight: number;
  originX: number;
  originY: number;
  count: number;
};

function nearestScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function contentOffsetInScrollParent(node: HTMLElement, scrollParent: HTMLElement) {
  const nodeRect = node.getBoundingClientRect();
  const parentRect = scrollParent.getBoundingClientRect();
  return {
    x: Math.round(scrollParent.scrollLeft + nodeRect.left - parentRect.left),
    y: Math.round(scrollParent.scrollTop + nodeRect.top - parentRect.top),
  };
}

export function cardIdsInBox(
  items: Pick<PrintingDTO, "id">[],
  layout: CardGridLayout | null,
  box: { left: number; top: number; right: number; bottom: number },
) {
  if (!layout || layout.count === 0 || layout.colWidth <= 0 || layout.rowHeight <= 0) return [];
  const strideX = layout.colWidth + layout.gap;
  const strideY = layout.rowHeight;
  const cardHeight = layout.rowHeight - layout.gapY;
  const ids: string[] = [];
  for (let index = 0; index < layout.count; index += 1) {
    const col = index % layout.cols;
    const row = Math.floor(index / layout.cols);
    const left = layout.originX + col * strideX;
    const top = layout.originY + row * strideY;
    const right = left + layout.colWidth;
    const bottom = top + cardHeight;
    if (left < box.right && right > box.left && top < box.bottom && bottom > box.top) {
      ids.push(items[index].id);
    }
  }
  return ids;
}

/** Official /cards sizing — only when filters are collapsed */
function columnsOfficial(width: number) {
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  return 2;
}

function gapOfficial(cols: number) {
  return cols >= 4 ? 20 : 16;
}

function rowGapOfficial() {
  return 20;
}

/** Previous layout with the filter sidebar open */
function columnsWithFilters(width: number) {
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
}

function gapWithFilters(cols: number) {
  return cols >= 3 ? 24 : 20;
}

function rowGapWithFilters() {
  return 28;
}

function layoutFor(width: number, filtersCollapsed: boolean) {
  if (filtersCollapsed) {
    const cols = columnsOfficial(width);
    const gap = gapOfficial(cols);
    const gapY = rowGapOfficial();
    return { cols, gap, gapY };
  }
  const cols = columnsWithFilters(width);
  const gap = gapWithFilters(cols);
  const gapY = rowGapWithFilters();
  return { cols, gap, gapY };
}

export function VirtualCardGrid({
  items,
  cardsById,
  ownership,
  draft,
  rangeAnchor,
  addMode,
  filtersCollapsed = false,
  layoutRef,
  onCardClick,
  onCardContextMenu,
  onQueue,
  onUnqueue,
}: {
  items: PrintingDTO[];
  cardsById: Map<string, CardDTO>;
  ownership: (printingId: string) => number;
  draft: Record<string, number>;
  rangeAnchor: string | null;
  addMode: boolean;
  filtersCollapsed?: boolean;
  layoutRef?: MutableRefObject<CardGridLayout | null>;
  onCardClick: (event: MouseEvent, printingId: string) => void;
  onCardContextMenu: (event: MouseEvent, printingId: string) => void;
  onQueue: (printingId: string) => void;
  onUnqueue: (printingId: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);

  const { cols, gap, gapY } = layoutFor(width || 640, filtersCollapsed);
  const colWidth = width > 0 ? (width - gap * (cols - 1)) / cols : 200;
  const rowHeight = Math.ceil(colWidth * (3.5 / 2.5) + META_HEIGHT + gapY);
  const rowCount = Math.ceil(items.length / cols) || 0;

  // After mount: ResizeObserver/setState must not race Suspense Placement.
  useEffect(() => {
    const node = listRef.current;
    if (!node) return;

    const scrollParent = nearestScrollParent(node);
    setScrollElement(scrollParent);

    const writeLayout = () => {
      if (!layoutRef) return;
      const rect = node.getBoundingClientRect();
      const next = layoutFor(node.clientWidth || 640, filtersCollapsed);
      const nextColWidth =
        node.clientWidth > 0 ? (node.clientWidth - next.gap * (next.cols - 1)) / next.cols : 200;
      const nextRowHeight = Math.ceil(nextColWidth * (3.5 / 2.5) + META_HEIGHT + next.gapY);
      // Viewport coords so marquee hit-testing stays aligned while main scrolls.
      layoutRef.current = {
        cols: next.cols,
        gap: next.gap,
        gapY: next.gapY,
        colWidth: nextColWidth,
        rowHeight: nextRowHeight,
        originX: rect.left,
        originY: rect.top,
        count: items.length,
      };
    };

    const updateSize = () => {
      const nextWidth = node.clientWidth;
      const nextMargin = scrollParent
        ? contentOffsetInScrollParent(node, scrollParent).y
        : Math.round(node.getBoundingClientRect().top + window.scrollY);
      setWidth((current) => (current === nextWidth ? current : nextWidth));
      setScrollMargin((current) => (current === nextMargin ? current : nextMargin));
      writeLayout();
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    scrollParent?.addEventListener("scroll", writeLayout, { passive: true });
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      scrollParent?.removeEventListener("scroll", writeLayout);
      window.removeEventListener("resize", updateSize);
    };
  }, [filtersCollapsed, items.length, layoutRef]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN_ROWS,
    scrollMargin,
    useFlushSync: false,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, cols, virtualizer]);

  let gridClass = filtersCollapsed ? "grid grid-cols-2 gap-x-4" : "grid grid-cols-2 gap-x-5";
  if (cols === 3) gridClass = filtersCollapsed ? "grid grid-cols-3 gap-x-4" : "grid grid-cols-3 gap-x-6";
  if (cols === 4) gridClass = filtersCollapsed ? "grid grid-cols-4 gap-x-5" : "grid grid-cols-4 gap-x-6";

  return (
    <div
      ref={listRef}
      data-card-grid=""
      className={addMode ? "relative cursor-crosshair pb-28 select-none" : "relative"}
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const start = virtualRow.index * cols;
        const rowItems = items.slice(start, start + cols);
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className={gridClass}
            style={{
              position: "absolute",
              top: `${virtualRow.start - scrollMargin}px`,
              left: 0,
              width: "100%",
              paddingBottom: gapY,
            }}
          >
            {rowItems.map((printing) => (
              <CardTile
                key={printing.id}
                printing={printing}
                card={cardsById.get(printing.cardId)}
                ownedQty={ownership(printing.id)}
                queued={draft[printing.id] ?? 0}
                active={printing.id === rangeAnchor}
                onClick={(event) => onCardClick(event, printing.id)}
                onContextMenu={(event) => onCardContextMenu(event, printing.id)}
                onQueue={() => onQueue(printing.id)}
                onUnqueue={() => onUnqueue(printing.id)}
              />
            ))}
            {rowItems.length < cols
              ? Array.from({ length: cols - rowItems.length }, (_, index) => (
                  <div key={`pad-${virtualRow.index}-${index}`} aria-hidden="true" />
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}
