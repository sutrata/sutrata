import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom doesn't implement URL.createObjectURL / revokeObjectURL
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
}

// Mock canvas for jsdom environment - jsdom doesn't fully implement canvas API
if (typeof window !== 'undefined') {
  const mockCanvas2DContext = {
    fillStyle: 'black',
    font: '12px monospace',
    fillText: vi.fn(),
    clearRect: vi.fn(),
    // VoiceToolbar's waveform
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    getImageData: vi.fn((x, y, width, height) => {
      // Return a mock ImageData object
      const data = new Uint8ClampedArray(width * height * 4)
      return {
        data,
        width,
        height,
        colorSpace: 'srgb',
      }
    }),
  }

  // Mock HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = vi.fn(function (
    contextType: string
  ) {
    if (contextType === '2d') {
      return { ...mockCanvas2DContext }
    }
    return null
  })
}

// Mock localStorage for jsdom / Node 22 compatibility
const createStorageMock = () => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = String(value) }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  }
}

const storageMock = createStorageMock()
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: storageMock,
    writable: true,
    configurable: true,
  })
}
Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
  configurable: true,
})
