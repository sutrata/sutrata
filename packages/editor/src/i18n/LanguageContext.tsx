import React, { createContext, useContext, useState, useCallback } from 'react'
import { parse, DocumentNode, SceneHeadingNode, ContentNode } from '@sutra/parser'
import { detectScript } from './language-detect'

interface LanguageContextType {
  currentLanguage: string
  resolveLanguageAtCaret: (text: string, caretPos: number, docFrontmatter?: Record<string, any>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en')

  const resolveLanguageAtCaret = useCallback(
    (text: string, caretPos: number, docFrontmatter: Record<string, any> = {}): string => {
      try {
        const ast = parse(text)
        let effectiveLanguage = 'en'

        // 1. Default to document frontmatter lang if present (lowest priority)
        if (docFrontmatter.lang) {
          effectiveLanguage = docFrontmatter.lang
        }

        // 2. Find the block containing the caret
        const blockInfo = findBlockAtPosition(ast, caretPos)
        if (!blockInfo) {
          return effectiveLanguage
        }

        const block = blockInfo.node

        // 3. Check for & lang: scene metadata (beats frontmatter)
        if (isSceneHeading(block) && block.metadata && block.metadata.length > 0) {
          const langMeta = block.metadata.find(m => m.key === 'lang')
          if (langMeta) {
            effectiveLanguage = langMeta.value
          }
        }

        // 4. Check for inline {lang=…} tag (beats all)
        const inlineTag = findInlineLangTag(block, caretPos)
        if (inlineTag) {
          effectiveLanguage = inlineTag
        }

        // 5. Fallback: detect from text at caret if no higher-priority language was found
        // This applies when: no inline tag, no scene metadata, and no frontmatter lang
        if (!inlineTag && !hasLangMetadata(block) && !docFrontmatter.lang) {
          const blockText = getBlockText(block)
          if (blockText) {
            effectiveLanguage = detectScript(blockText)
          }
        }

        return effectiveLanguage
      } catch (err) {
        console.error('Error resolving language at caret:', err)
        return 'en'
      }
    },
    []
  )

  return (
    <LanguageContext.Provider value={{ currentLanguage, resolveLanguageAtCaret }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}

// Helper: Check if a node is a SceneHeadingNode
function isSceneHeading(node: ContentNode): node is SceneHeadingNode {
  return (node as any).type === 'scene-heading'
}

// Helper: Get text content from a block
function getBlockText(block: ContentNode): string {
  const blockAny = block as any

  // For SceneHeadingNode, extract text from children (action, dialogue, etc.)
  if (blockAny.type === 'scene-heading' && blockAny.children && blockAny.children.length > 0) {
    const childTexts = blockAny.children
      .map((child: any) => {
        if (child.type === 'action' && child.spans) {
          return extractTextFromSpans(child.spans)
        }
        if (child.type === 'dialogue' && child.spans) {
          return extractTextFromSpans(child.spans)
        }
        if (child.text) return child.text
        return ''
      })
      .filter((t: string) => t.length > 0)
      .join(' ')

    if (childTexts) return childTexts
  }

  // Direct text property (for action, transition, note, etc.)
  if (blockAny.text) return blockAny.text

  // Inline spans (for action, dialogue, lyrics)
  if (blockAny.spans) {
    return blockAny.spans
      .map((span: any) => {
        if (span.type === 'text') return span.text
        if (span.spans) return extractTextFromSpans(span.spans)
        return ''
      })
      .join('')
  }

  return ''
}

// Helper: Extract text from nested spans
function extractTextFromSpans(spans: any[]): string {
  return spans
    .map(span => {
      if (span.type === 'text') return span.text
      if (span.spans) return extractTextFromSpans(span.spans)
      return ''
    })
    .join('')
}

// Helper: Check if block has lang metadata
function hasLangMetadata(block: ContentNode): boolean {
  if (!isSceneHeading(block)) return false
  return block.metadata && block.metadata.length > 0 && block.metadata.some(m => m.key === 'lang')
}

// Helper: Find the block containing the caret position
// Returns the block and its start position
function findBlockAtPosition(
  ast: DocumentNode,
  pos: number
): { node: ContentNode; startPos: number } | null {
  if (!ast.children) return null

  // Approximate position tracking - simplified for now
  // In a real implementation, this would use actual byte offsets
  let currentPos = 0

  for (const child of ast.children) {
    const blockAny = child as any
    // Use raw text for more accurate length calculation
    const blockLength = blockAny.raw ? blockAny.raw.length + 1 : 50 // +1 for newline, fallback to ~50 chars

    if (pos >= currentPos && pos < currentPos + blockLength) {
      return { node: child, startPos: currentPos }
    }
    currentPos += blockLength
  }

  // If position is beyond all blocks, return the last block as fallback
  if (ast.children.length > 0) {
    let totalPos = 0
    const lastChild = ast.children[ast.children.length - 1]!
    return { node: lastChild, startPos: totalPos }
  }

  return null
}

// Helper: Get the length of a block in characters
function getBlockLength(block: ContentNode): number {
  const blockAny = block as any
  if (blockAny.raw) {
    return blockAny.raw.length + 1 // +1 for newline
  }
  return (blockAny.text?.length ?? 0) + 1 // +1 for newline
}

// Helper: Find inline {lang=XX} tag in the block
function findInlineLangTag(block: ContentNode, caretPos: number): string | null {
  const blockText = getBlockText(block)
  if (!blockText) return null

  // Regex to find {lang=XX} tags - match 2-letter language codes
  const tagRegex = /\{lang=([a-z]{2})\}/g
  let match
  let closestTag: string | null = null
  let closestDistance = Infinity

  while ((match = tagRegex.exec(blockText)) !== null) {
    const distance = Math.abs(caretPos - match.index)
    if (distance < closestDistance) {
      closestDistance = distance
      closestTag = match[1] ?? null
    }
  }

  return closestTag
}
