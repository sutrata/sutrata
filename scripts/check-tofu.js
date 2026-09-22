#!/usr/bin/env node

/**
 * CI gate: Check that all corpus samples render without tofu (missing glyph boxes)
 * Uses canvas-based glyph detection to ensure font coverage.
 * Exit code: 0 = all pass, 1 = any tofu found
 */

const fs = require('fs')
const path = require('path')

let createCanvas
try {
  createCanvas = require('canvas').createCanvas
} catch (err) {
  console.error('Error: canvas module is required for tofu detection')
  console.error('Install it with: npm install canvas')
  process.exit(1)
}

// Import corpus
const corpusPath = path.join(__dirname, 'corpus-tofu-test.json')
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf-8'))

function detectTofu(text, fontFamily) {
  if (!text || !text.length) return false

  try {
    const canvas = createCanvas(1000, 100)
    const ctx = canvas.getContext('2d')

    ctx.font = `12px ${fontFamily}`
    ctx.fillStyle = 'black'
    ctx.fillText('□', 10, 50) // .notdef replacement

    const refData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const refPixels = countNonZeroPixels(refData)

    for (const char of text) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillText(char, 10, 50)
      const charData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      const charPixels = countNonZeroPixels(charData)

      if (Math.abs(charPixels - refPixels) < refPixels * 0.1) {
        return true
      }
    }
  } catch (err) {
    console.error(`Error checking tofu for text "${text}":`, err.message)
    return false
  }

  return false
}

function countNonZeroPixels(imageData) {
  let count = 0
  for (let i = 0; i < imageData.length; i += 4) {
    if (imageData[i] > 0 || imageData[i + 1] > 0 || imageData[i + 2] > 0) {
      count++
    }
  }
  return count
}

// Run checks
let failures = 0
console.log('Checking tofu coverage for all scripts...\n')

for (const entry of corpus.scripts) {
  const { lang, script, sample, fontFamily } = entry
  const hasTofu = detectTofu(sample, fontFamily)

  const status = hasTofu ? 'TOFU FOUND' : 'OK'
  console.log(`${status} [${lang}] ${script}: "${sample}"`)

  if (hasTofu) failures++
}

console.log(`\n${corpus.scripts.length - failures}/${corpus.scripts.length} scripts passed`)

if (failures > 0) {
  console.error(`\nTofu detected in ${failures} script(s). Install missing fonts.`)
  process.exit(1)
} else {
  console.log('\nAll scripts pass tofu check!')
  process.exit(0)
}
