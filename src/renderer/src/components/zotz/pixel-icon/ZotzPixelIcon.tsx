import React from 'react'

const CELL = 2

// `o` is a lit cell; each row is one line of the icon.
const ZOTZ_PIXEL_ICONS = {
  folder: [
    'oooo......',
    'o..oooooo.',
    'o........o',
    'o........o',
    'o........o',
    'o........o',
    'oooooooooo'
  ],
  group: ['ooooo.ooooo', 'o...o.o...o', 'o.o.o.o.o.o', 'o...o.o...o', 'ooooo.ooooo', '..o.....o..'],
  plus: ['..o..', '..o..', 'ooooo', '..o..', '..o..'],
  more: ['o.o.o'],
  newFolder: [
    'oooo......',
    'o..oooooo.',
    'o...o....o',
    'o.ooooo..o',
    'o...o....o',
    'o........o',
    'oooooooooo'
  ]
} satisfies Record<string, readonly string[]>

export type ZotzPixelIconName = keyof typeof ZOTZ_PIXEL_ICONS

type PixelShape = { width: number; height: number; path: string }

const shapes = new Map<ZotzPixelIconName, PixelShape>()

function shapeOf(name: ZotzPixelIconName): PixelShape {
  const cached = shapes.get(name)
  if (cached) {
    return cached
  }
  const rows = ZOTZ_PIXEL_ICONS[name]
  const shape = {
    width: rows[0].length * CELL,
    height: rows.length * CELL,
    path: rows
      .flatMap((row, y) =>
        [...row].flatMap((cell, x) =>
          cell === 'o' ? [`M${x * CELL} ${y * CELL}h${CELL}v${CELL}h-${CELL}z`] : []
        )
      )
      .join('')
  }
  shapes.set(name, shape)
  return shape
}

/** Pixel-grid icon drawn in the text color, for Zotz's pixel chrome. */
export function ZotzPixelIcon({
  name,
  className
}: {
  name: ZotzPixelIconName
  className?: string
}): React.JSX.Element {
  const { width, height, path } = shapeOf(name)
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      // Inline size wins over the Button's `[&_svg]:size-*`, which would stretch the grid.
      style={{ width, height }}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d={path} />
    </svg>
  )
}
