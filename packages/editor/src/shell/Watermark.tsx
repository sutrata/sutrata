import { useDocument } from '../context/DocumentContext'

/** Renders the document's frontmatter `watermark:` text.
 *  Hidden in the screen editor UI, visible only in print output. */
export function Watermark() {
  const { watermarkText } = useDocument()
  if (!watermarkText) return null
  return <div className="cs-watermark" aria-hidden="true">{watermarkText}</div>
}
