/** Per-page headers ("<scene> CONTINUED:" on the left, "p<n>" on the right) need to know
 *  where the page breaks actually fall, and a browser tells no one that: Chromium supports
 *  neither CSS Paged Media margin boxes (@top-left/@top-right) nor running elements, and
 *  exposes no JS hook for its own break positions. So the print document paginates itself:
 *  the script below runs inside the print window (or the hidden WebView2 window the Windows
 *  desktop export prints from) and distributes the rendered blocks into fixed-height
 *  .print-page boxes it can then put a real header on.
 *
 *  It runs in that window, not here — `printPaginatorScript` stringifies the function into
 *  the exported HTML — so `paginatePrintDocument` must stay self-contained: no imports, no
 *  module-scope references, nothing a bundler could rename out from under it. */

export interface PrintPaginationOptions {
  /** Printable height of one page in CSS px (paper height minus the style's top/bottom
   *  margins) — the browser applies those margins via @page, so a box of exactly this
   *  height fills one sheet. */
  contentHeightPx: number
  /** Right-hand header cell: this prefix plus the page number (e.g. "p" -> "p12"). */
  pageNumberPrefix: string
  /** Left-hand header cell on a page that opens mid-scene: the scene number, then this
   *  (e.g. "8 CONTINUED:"). */
  continuedSuffix: string
}

export function paginatePrintDocument(opts: PrintPaginationOptions): void {
  const flow = document.getElementById('print-flow')
  const pagesRoot = document.getElementById('print-pages')
  if (!flow || !pagesRoot) return
  const root: HTMLElement = pagesRoot

  const blocks: HTMLElement[] = []
  for (let i = 0; i < flow.children.length; i++) blocks.push(flow.children[i] as HTMLElement)
  if (blocks.length === 0) return

  // Elements that may be broken across a page boundary mid-paragraph. Everything else
  // moves to the next page whole (a cue, a heading and a note are all short enough that
  // splitting one is always the wrong answer).
  const SPLITTABLE = /\bprint-(action|dialogue|lyrics)\b/
  // ...and elements that must not be the last thing on a page — the same rule
  // styles/pagination.ts states for DOCX/CSS, re-stated here because inside a
  // self-paginated flow the browser's own break-after: avoid never comes into play.
  // (?![\w-] so this doesn't also catch the print-character-block wrapper — a *finished*
  // speech is free to end a page; it's the cue inside it that must not.)
  const KEEP_WITH_NEXT = /\bprint-(scene-heading|character|parenthetical|section)(?![\w-])/
  // A cue + its dialogue: not splittable as text, but its children can be distributed.
  const CONTAINER = /\bprint-character-block\b/
  const MIN_LINES = 2
  // Slack against sub-pixel rounding: a box that measures a hair over the page height
  // would spill a stray sliver onto the next sheet.
  const SLACK_PX = 4

  type Page = { el: HTMLElement; body: HTMLElement; continued: HTMLElement; number: HTMLElement }
  const pages: Page[] = []
  function newPage(): Page {
    const el = document.createElement('section')
    el.className = 'print-page'
    el.style.height = opts.contentHeightPx + 'px'
    const header = document.createElement('div')
    header.className = 'print-page-header'
    const continued = document.createElement('span')
    continued.className = 'print-page-continued'
    const number = document.createElement('span')
    number.className = 'print-page-number'
    header.appendChild(continued)
    header.appendChild(number)
    const body = document.createElement('div')
    body.className = 'print-page-body'
    el.appendChild(header)
    el.appendChild(body)
    root.appendChild(el)
    const page = { el, body, continued, number }
    pages.push(page)
    // Numbered as soon as the page exists, not in the header pass at the end: an empty
    // header measures as a bare margin, and every block would then be placed against a
    // page height ~one line too generous.
    number.textContent = opts.pageNumberPrefix + String(pages.length)
    return page
  }

  let page = newPage()
  /** How much of the page box is left for body content, in the body's own coordinates —
   *  i.e. page height less everything above the body (the header and its margin). */
  const limit = () =>
    opts.contentHeightPx
    - (page.body.getBoundingClientRect().top - page.el.getBoundingClientRect().top)
    - SLACK_PX

  function lineCount(el: HTMLElement): number {
    const range = document.createRange()
    range.selectNodeContents(el)
    return range.getClientRects().length
  }

  /** Every position a line could break at, as (text node, offset) pairs. */
  function wordBoundaries(el: HTMLElement): { node: Text; offset: number }[] {
    const spots: { node: Text; offset: number }[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode() as Text | null
    while (node) {
      const text = node.data
      for (let i = 1; i < text.length; i++) {
        if (/\s/.test(text[i - 1]!) && !/\s/.test(text[i]!)) spots.push({ node, offset: i })
      }
      node = walker.nextNode() as Text | null
    }
    return spots
  }

  /** Cut `el` so that what stays fits in `maxHeight`, returning the remainder as a new
   *  element of the same kind (or null when there is no split leaving MIN_LINES on both
   *  sides — then the whole block moves to the next page instead). */
  function split(el: HTMLElement, maxHeight: number): HTMLElement | null {
    const range = document.createRange()
    // Nothing to split against without a layout engine to measure line boxes with
    // (a headless DOM, say) — blocks then move whole rather than being cut blind.
    if (typeof range.getClientRects !== 'function') return null
    const spots = wordBoundaries(el)
    if (spots.length === 0) return null
    const top = el.getBoundingClientRect().top
    const fits = (spot: { node: Text; offset: number }) => {
      range.setStartBefore(el)
      range.setEnd(spot.node, spot.offset)
      const rects = range.getClientRects()
      const last = rects[rects.length - 1]
      return last ? last.bottom - top <= maxHeight : true
    }
    let lo = 0
    let hi = spots.length - 1
    let best = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (fits(spots[mid]!)) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    if (best < 0) return null

    const cut = spots[best]!
    const rest = el.cloneNode(false) as HTMLElement
    const tail = document.createRange()
    tail.setStart(cut.node, cut.offset)
    tail.setEndAfter(el.lastChild!)
    rest.appendChild(tail.extractContents())
    page.body.appendChild(rest)
    const ok = lineCount(el) >= MIN_LINES && lineCount(rest) >= MIN_LINES
    page.body.removeChild(rest)
    if (!ok) {
      // Put it back exactly as it was rather than leaving a half-cut paragraph behind.
      while (rest.firstChild) el.appendChild(rest.firstChild)
      el.normalize()
      return null
    }
    return rest
  }

  /** A character block is a cue plus its parentheticals and dialogue lines. When it
   *  straddles a break, the split runs *between* those children (and, where the straddling
   *  line is dialogue, inside it) so a long speech doesn't jump to the next page whole and
   *  leave a hole behind. The cue never ends up alone: a continuation is only produced
   *  when the cue keeps at least part of the first speech with it. */
  function splitContainer(el: HTMLElement, maxHeight: number): HTMLElement | null {
    const children: HTMLElement[] = []
    for (let i = 0; i < el.children.length; i++) children.push(el.children[i] as HTMLElement)
    if (children.length < 2) return null
    const top = el.getBoundingClientRect().top
    let cut = -1
    for (let i = 0; i < children.length; i++) {
      if (children[i]!.getBoundingClientRect().bottom - top > maxHeight) { cut = i; break }
    }
    if (cut <= 0) return null // the cue itself doesn't fit: the whole block moves down

    const rest = el.cloneNode(false) as HTMLElement
    const crossing = children[cut]!
    let from = cut
    if (SPLITTABLE.test(crossing.className)) {
      const tail = split(crossing, maxHeight - (crossing.getBoundingClientRect().top - top))
      if (tail) {
        rest.appendChild(tail)
        from = cut + 1
      }
    }
    if (from === cut && cut < 2) return null // would strand the cue on its own
    for (let i = from; i < children.length; i++) rest.appendChild(children[i]!)
    return rest.children.length > 0 ? rest : null
  }

  /** Break `block` so what's left fits in `room`, returning the continuation (or null when
   *  it can't be broken and has to move down whole). */
  function breakBlock(block: HTMLElement, room: number): HTMLElement | null {
    if (SPLITTABLE.test(block.className)) return split(block, room)
    if (CONTAINER.test(block.className)) return splitContainer(block, room)
    return null
  }

  /** The run of keep-with-next blocks immediately before the break, which have to travel
   *  to the next page with the block they introduce. */
  function trailingKeepWithNext(): HTMLElement[] {
    const moved: HTMLElement[] = []
    let last = page.body.lastElementChild as HTMLElement | null
    while (last && KEEP_WITH_NEXT.test(last.className)) {
      moved.unshift(last)
      last = last.previousElementSibling as HTMLElement | null
    }
    // Never empty a page for the sake of the rule — that would loop forever.
    return moved.length < page.body.children.length ? moved : []
  }

  let pending: HTMLElement | null = null
  for (let i = 0; i < blocks.length; i++) {
    const block: HTMLElement = pending ?? blocks[i]!
    pending = null

    // An explicit Sutra page break (===) just starts the next page.
    if (block.className.indexOf('print-page-break') >= 0) {
      if (page.body.children.length > 0) page = newPage()
      continue
    }

    page.body.appendChild(block)
    if (page.body.scrollHeight <= limit()) continue

    // Doesn't fit. Break the block itself where that's allowed...
    const rest = breakBlock(block, limit() - block.offsetTop)
    if (rest) {
      page = newPage()
      pending = rest // re-measured next time round: a long speech can span three pages
      i--
      continue
    }

    // ...otherwise the whole block moves down, dragging any cue/heading introducing it.
    page.body.removeChild(block)
    const travelling = trailingKeepWithNext()
    if (page.body.children.length === travelling.length) {
      // Nothing would be left behind: this block is simply taller than a page, so let
      // it sit here and overflow rather than bounce between empty pages forever.
      page.body.appendChild(block)
      continue
    }
    page = newPage()
    for (let k = 0; k < travelling.length; k++) page.body.appendChild(travelling[k]!)
    page.body.appendChild(block)
    if (page.body.scrollHeight > limit()) {
      const tail = breakBlock(block, limit() - block.offsetTop)
      if (tail) {
        page = newPage()
        pending = tail
        i--
      }
    }
  }

  // Headers, once every block has landed: which page a scene starts on is only knowable
  // after the fact (a heading can be pushed to the next page by the keep-with-next rule).
  const sceneFirstPage: Record<string, number> = {}
  for (let i = 0; i < pages.length; i++) {
    const body = pages[i]!.body
    for (let k = 0; k < body.children.length; k++) {
      const scene = body.children[k]!.getAttribute('data-scene-start')
      if (scene !== null && sceneFirstPage[scene] === undefined) sceneFirstPage[scene] = i
    }
  }
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]!
    const first = p.body.firstElementChild
    const scene = first ? first.getAttribute('data-scene') : null
    const startsHere = first !== null && first.getAttribute('data-scene-start') !== null
    if (scene !== null && !startsHere && sceneFirstPage[scene] !== undefined && sceneFirstPage[scene]! < i) {
      p.continued.textContent = scene + ' ' + opts.continuedSuffix
    }
  }

  flow.parentNode?.removeChild(flow)
}

/** The `<script>` that runs `paginatePrintDocument` in the exported document, once web
 *  fonts have settled — measuring before that would paginate against fallback metrics
 *  (and Indic text reflows a lot between the two). Any failure leaves the un-paginated
 *  flow exactly as it was, so the export degrades to the browser's own page breaks
 *  (which styles/pagination.ts's CSS rules still govern) instead of producing nothing. */
export function printPaginatorScript(opts: PrintPaginationOptions): string {
  return `<script>
      (function () {
        var run = function () {
          try {
            (${paginatePrintDocument.toString()})(${JSON.stringify(opts)});
          } catch (e) {
            console.error('Sutrata: pagination failed, falling back to browser page breaks', e);
          }
        };
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(run, run);
        } else {
          run();
        }
      })();
    </script>`
}
