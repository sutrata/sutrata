// Detect if a string contains unmapped glyphs (tofu / .notdef boxes)
// by rendering to an invisible canvas and comparing dimensions

export function detectTofu(text: string, fontFamily: string = 'monospace'): boolean {
  if (!text || !text.length) return false
  if (typeof document === 'undefined') return false // SSR/Node env

  // Create invisible canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  canvas.width = 1000
  canvas.height = 100

  // Render reference .notdef character (U+FFFD, replacement char)
  ctx.font = `12px ${fontFamily}`
  ctx.fillStyle = 'black'
  ctx.fillText('�', 10, 50)

  try {
    const refData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const refPixels = countNonZeroPixels(refData)

    // Render each character from input text
    for (const char of text) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillText(char, 10, 50)
      const charData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      const charPixels = countNonZeroPixels(charData)

      // If pixel count matches .notdef (within 10% tolerance), it's likely tofu
      if (Math.abs(charPixels - refPixels) < refPixels * 0.1) {
        return true
      }
    }
  } catch {
    return false
  }

  return false
}

function countNonZeroPixels(imageData: Uint8ClampedArray): number {
  let count = 0
  // Every 4th value is alpha; count pixels where any channel is non-zero
  for (let i = 0; i < imageData.length; i += 4) {
    if ((imageData[i] ?? 0) > 0 || (imageData[i + 1] ?? 0) > 0 || (imageData[i + 2] ?? 0) > 0) {
      count++
    }
  }
  return count
}
