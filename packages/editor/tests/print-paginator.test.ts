import { paginatePrintDocument } from '../src/file/print-paginator'

/** jsdom has no layout engine, so every element measures 0. Stub the one measurement the
 *  placement logic depends on when nothing can be split — a page body's height — as a flat
 *  40px per block, which makes page capacity exactly predictable. */
function stubHeights(perBlockPx: number) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('print-page-body') ? this.children.length * perBlockPx : perBlockPx
    },
  })
  return () => {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', descriptor)
  }
}

function setup(blocks: string): void {
  document.body.innerHTML = `<div id="print-pages"></div><div id="print-flow">${blocks}</div>`
}

function pages() {
  return Array.from(document.querySelectorAll('.print-page')).map(p => ({
    continued: p.querySelector('.print-page-continued')!.textContent,
    number: p.querySelector('.print-page-number')!.textContent,
    blocks: Array.from(p.querySelector('.print-page-body')!.children).map(c => c.className),
  }))
}

const action = (scene: string, n: number) =>
  `<div class="print-action" data-scene="${scene}">Action ${n}</div>`
const heading = (scene: string) =>
  `<div class="print-scene-heading" data-scene="${scene}" data-scene-start="${scene}">INT. ROOM</div>`

describe('print paginator', () => {
  let restore = () => {}
  beforeEach(() => { restore = stubHeights(40) })
  afterEach(() => { restore() })

  it('numbers every page and marks only the ones that open mid-scene as CONTINUED', () => {
    setup(heading('8') + Array.from({ length: 11 }, (_, i) => action('8', i)).join(''))
    // 204px of page height, less the 4px rounding slack, fits five 40px blocks.
    paginatePrintDocument({ contentHeightPx: 204, pageNumberPrefix: 'p', continuedSuffix: 'CONTINUED:' })

    const result = pages()
    expect(result.map(p => p.number)).toEqual(['p1', 'p2', 'p3'])
    expect(result[0]!.continued).toBe('') // the page the scene starts on
    expect(result[1]!.continued).toBe('8 CONTINUED:')
    expect(result[2]!.continued).toBe('8 CONTINUED:')
    expect(document.getElementById('print-flow')).toBeNull()
  })

  it('starts a fresh page at a scene heading rather than leaving it stranded at the bottom', () => {
    // Four blocks of scene 8, then scene 9's heading would land as the fifth (last) block.
    setup(heading('8') + Array.from({ length: 3 }, (_, i) => action('8', i)).join('')
      + heading('9') + action('9', 0))
    paginatePrintDocument({ contentHeightPx: 204, pageNumberPrefix: 'p', continuedSuffix: 'CONTINUED:' })

    const result = pages()
    expect(result).toHaveLength(2)
    expect(result[0]!.blocks).toHaveLength(4)
    expect(result[1]!.blocks[0]).toContain('print-scene-heading')
    expect(result[1]!.continued).toBe('') // scene 9 starts here, so no continuation
  })

  it('breaks the page where a Sutra page break says to', () => {
    setup(heading('8') + action('8', 0) + '<div class="print-page-break"></div>' + action('8', 1))
    paginatePrintDocument({ contentHeightPx: 2000, pageNumberPrefix: 'p', continuedSuffix: 'CONTINUED:' })

    const result = pages()
    expect(result).toHaveLength(2)
    expect(result[0]!.blocks).toHaveLength(2)
    expect(result[1]!.continued).toBe('8 CONTINUED:')
  })

  it('does nothing when the document has no flow to paginate', () => {
    document.body.innerHTML = '<div id="print-pages"></div>'
    expect(() => paginatePrintDocument({ contentHeightPx: 204, pageNumberPrefix: 'p', continuedSuffix: 'CONTINUED:' })).not.toThrow()
    expect(document.querySelectorAll('.print-page')).toHaveLength(0)
  })
})
