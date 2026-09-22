import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { detectTofu } from '../../src/fonts/tofu-detect'

describe('tofu-detect', () => {
  let originalCreateElement: typeof document.createElement

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
    originalCreateElement = document.createElement.bind(document)
  })

  afterEach(() => {
    // Restore original createElement
    document.createElement = originalCreateElement
  })

  it('returns false for a known string in a well-supported font', () => {
    // Track what character was rendered last
    let lastRenderedChar = ''

    const mockGetImageData = vi.fn((x, y, w, h) => {
      const data = new Uint8ClampedArray(w * h * 4)
      // Reference .notdef char renders with 50 pixels
      // Regular chars render with 150 pixels (more data)
      const pixelCount = lastRenderedChar === '�' ? 50 : 150
      for (let i = 0; i < Math.min(pixelCount * 4, data.length); i += 4) {
        data[i] = 100 // R
        data[i + 3] = 255 // A
      }
      return {
        data,
        width: w,
        height: h,
        colorSpace: 'srgb',
      }
    })

    const mockCtx = {
      font: '',
      fillStyle: '',
      fillText: vi.fn((text: string) => {
        lastRenderedChar = text
      }),
      clearRect: vi.fn(),
      getImageData: mockGetImageData,
    }

    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'canvas') {
        const canvas = originalCreateElement('canvas')
        canvas.getContext = vi.fn(() => mockCtx as any)
        return canvas
      }
      return originalCreateElement(tagName)
    })

    const result = detectTofu('Hello', 'monospace')
    expect(result).toBe(false)
  })

  it('returns true for unmapped PUA codepoint', () => {
    // Track what character was rendered last
    let lastRenderedChar = ''

    const mockGetImageData = vi.fn((x, y, w, h) => {
      const data = new Uint8ClampedArray(w * h * 4)
      // Both reference .notdef and unmapped char render with same pixel count (50)
      // This simulates the tofu detection scenario
      const pixelCount = 50
      for (let i = 0; i < Math.min(pixelCount * 4, data.length); i += 4) {
        data[i] = 100 // R
        data[i + 3] = 255 // A
      }
      return {
        data,
        width: w,
        height: h,
        colorSpace: 'srgb',
      }
    })

    const mockCtx = {
      font: '',
      fillStyle: '',
      fillText: vi.fn((text: string) => {
        lastRenderedChar = text
      }),
      clearRect: vi.fn(),
      getImageData: mockGetImageData,
    }

    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'canvas') {
        const canvas = originalCreateElement('canvas')
        canvas.getContext = vi.fn(() => mockCtx as any)
        return canvas
      }
      return originalCreateElement(tagName)
    })

    const result = detectTofu('󰀀', 'monospace')
    expect(result).toBe(true)
  })

  it('returns false for empty string', () => {
    const result = detectTofu('', 'monospace')
    expect(result).toBe(false)
  })

  it('handles SSR context gracefully (no document)', () => {
    const originalDoc = global.document
    // @ts-ignore
    delete global.document
    try {
      const result = detectTofu('test', 'monospace')
      expect(result).toBe(false)
    } finally {
      global.document = originalDoc
    }
  })
})
