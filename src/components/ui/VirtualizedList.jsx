import { memo, useEffect, useMemo, useRef, useState } from 'react'

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getItemSpan(itemSize, gap) {
  return itemSize + gap
}

function getTotalHeight(count, itemSpan, gap) {
  if (count <= 0) return 0
  return count * itemSpan - gap
}

function getVisibleRange({ count, itemSpan, viewportHeight, scrollTop, overscan }) {
  if (count <= 0 || itemSpan <= 0) {
    return { start: 0, end: 0 }
  }

  const visibleCount = Math.max(1, Math.ceil(viewportHeight / itemSpan))
  const start = clamp(Math.floor(scrollTop / itemSpan) - overscan, 0, Math.max(0, count - 1))
  const end = clamp(start + visibleCount + overscan * 2, start + 1, count)

  return { start, end }
}

function VirtualizedList({
  items,
  itemSize,
  gap = 0,
  overscan = 4,
  virtualizeAbove = 18,
  estimatedHeight = 240,
  getItemKey,
  renderItem,
  style = null,
  innerStyle = null,
  listStyle = null,
}) {
  const containerRef = useRef(null)
  const frameRef = useRef(null)
  const itemSpan = getItemSpan(itemSize, gap)
  const shouldVirtualize = items.length >= virtualizeAbove
  const [viewportHeight, setViewportHeight] = useState(estimatedHeight)
  const [range, setRange] = useState(() =>
    getVisibleRange({
      count: items.length,
      itemSpan,
      viewportHeight: estimatedHeight,
      scrollTop: 0,
      overscan,
    })
  )

  useEffect(() => {
    if (!shouldVirtualize) {
      return undefined
    }

    const node = containerRef.current
    if (!node) {
      return undefined
    }

    let frameId = null

    const syncRange = () => {
      frameId = null

      const nextViewportHeight = node.clientHeight || estimatedHeight
      const nextRange = getVisibleRange({
        count: items.length,
        itemSpan,
        viewportHeight: nextViewportHeight,
        scrollTop: node.scrollTop,
        overscan,
      })

      setViewportHeight((previous) =>
        previous === nextViewportHeight ? previous : nextViewportHeight
      )
      setRange((previous) =>
        previous.start === nextRange.start && previous.end === nextRange.end
          ? previous
          : nextRange
      )
    }

    const requestSync = () => {
      if (frameId != null) return
      frameId = window.requestAnimationFrame(syncRange)
    }

    syncRange()
    node.addEventListener('scroll', requestSync, { passive: true })
    window.addEventListener('resize', requestSync)

    let observer = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(requestSync)
      observer.observe(node)
    }

    return () => {
      node.removeEventListener('scroll', requestSync)
      window.removeEventListener('resize', requestSync)
      observer?.disconnect()

      if (frameId != null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [estimatedHeight, itemSpan, items.length, overscan, shouldVirtualize])

  useEffect(() => {
    if (!shouldVirtualize) return

    setRange((previous) => {
      const nextRange = getVisibleRange({
        count: items.length,
        itemSpan,
        viewportHeight,
        scrollTop: containerRef.current?.scrollTop || 0,
        overscan,
      })

      return previous.start === nextRange.start && previous.end === nextRange.end
        ? previous
        : nextRange
    })
  }, [itemSpan, items.length, overscan, shouldVirtualize, viewportHeight])

  const renderedItems = useMemo(() => {
    if (!shouldVirtualize) {
      return items.map((item, index) => (
        <div
          key={getItemKey(item, index)}
          style={{ marginBottom: index === items.length - 1 ? 0 : `${gap}px` }}
        >
          {renderItem(item, index)}
        </div>
      ))
    }

    return items.slice(range.start, range.end).map((item, index, visibleItems) => {
      const actualIndex = range.start + index

      return (
        <div
          key={getItemKey(item, actualIndex)}
          style={{
            height: `${itemSize}px`,
            marginBottom: index === visibleItems.length - 1 ? 0 : `${gap}px`,
          }}
        >
          {renderItem(item, actualIndex)}
        </div>
      )
    })
  }, [gap, getItemKey, itemSize, items, range.end, range.start, renderItem, shouldVirtualize])

  if (!shouldVirtualize) {
    return (
      <div
        ref={containerRef}
        style={{
          overflowY: 'auto',
          minHeight: 0,
          ...style,
        }}
      >
        <div
          ref={frameRef}
          style={{
            ...listStyle,
          }}
        >
          {renderedItems}
        </div>
      </div>
    )
  }

  const totalHeight = getTotalHeight(items.length, itemSpan, gap)
  const offsetTop = range.start * itemSpan

  return (
    <div
      ref={containerRef}
      style={{
        overflowY: 'auto',
        minHeight: 0,
        ...style,
      }}
    >
      <div
        ref={frameRef}
        style={{
          position: 'relative',
          height: `${totalHeight}px`,
          ...innerStyle,
        }}
      >
        <div
          style={{
            transform: `translateY(${offsetTop}px)`,
            willChange: 'transform',
            ...listStyle,
          }}
        >
          {renderedItems}
        </div>
      </div>
    </div>
  )
}

export default memo(VirtualizedList)
