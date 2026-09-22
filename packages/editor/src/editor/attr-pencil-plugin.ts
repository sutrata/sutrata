/**
 * Attribute pencil plugin — uniform inline editing affordance for scene
 * attributes and title-page frontmatter.
 *
 * A pencil widget (visible on hover) sits at the end of every scene heading
 * and at the top-right of the title page card.
 *
 * - Scene heading: opens a dropdown of attribute keys not yet present (plus a
 *   custom-key input). Picking one inserts the node via a normal PM
 *   transaction and places the cursor in the empty value, so there is no full
 *   state rebuild and no cursor jump.
 * - Title page: opens the sectioned title page form (TitlePageDialog), where
 *   frontmatter fields are added and edited.
 */
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { EditorView } from 'prosemirror-view'
import type { Node as PmNode } from 'prosemirror-model'
import { schema } from './schema'
import { openTitlePageForm } from './editor-bus'

const SCENE_META_KEYS = ['synopsis', 'status', 'tags', 'location', 'time', 'lang']

let openMenu: HTMLElement | null = null

function closeMenu() {
  if (openMenu) {
    openMenu.remove()
    openMenu = null
    document.removeEventListener('mousedown', onDocMousedown)
  }
}

function onDocMousedown(e: MouseEvent) {
  if (openMenu && !openMenu.contains(e.target as Node)) closeMenu()
}

function showMenu(anchor: HTMLElement, options: string[], onPick: (key: string) => void) {
  closeMenu()
  const menu = document.createElement('div')
  menu.className = 'cs-attr-menu'

  for (const key of options) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'cs-attr-menu-item'
    item.textContent = `+ ${key}`
    item.addEventListener('mousedown', e => {
      e.preventDefault()
      closeMenu()
      onPick(key)
    })
    menu.appendChild(item)
  }

  const customRow = document.createElement('div')
  customRow.className = 'cs-attr-menu-custom'
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'custom key…'
  input.addEventListener('keydown', e => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      const k = input.value.trim()
      if (k) { closeMenu(); onPick(k) }
    } else if (e.key === 'Escape') {
      closeMenu()
    }
  })
  input.addEventListener('mousedown', e => e.stopPropagation())
  customRow.appendChild(input)
  menu.appendChild(customRow)

  const rect = anchor.getBoundingClientRect()
  menu.style.left = `${rect.left}px`
  menu.style.top = `${rect.bottom + 4}px`
  document.body.appendChild(menu)
  openMenu = menu
  // Defer so the click that opened the menu doesn't immediately close it
  setTimeout(() => document.addEventListener('mousedown', onDocMousedown), 0)
  input.focus()
}

/** Insert an attribute node and place the cursor inside its (empty) content. */
function insertNode(view: EditorView, pos: number, node: PmNode) {
  const tr = view.state.tr.insert(pos, node)
  view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1))))
  view.focus()
}

/**
 * For a scene heading at top-level index `index`, compute which attribute
 * keys already exist and where a new attribute line should be inserted
 * (after the heading, synopsis, and existing metadata lines).
 */
function sceneAttrContext(view: EditorView, headingPos: number) {
  const doc = view.state.doc
  const $heading = doc.resolve(headingPos)
  const headingNode = doc.nodeAt(headingPos)!
  let pos = headingPos + headingNode.nodeSize
  let index = $heading.index(0) + 1
  const presentKeys = new Set<string>()

  while (index < doc.childCount) {
    const sibling = doc.child(index)
    if (sibling.type.name === 'scene_metadata') {
      presentKeys.add(sibling.attrs['metaKey'] as string)
    } else {
      break
    }
    pos += sibling.nodeSize
    index++
  }
  return { insertPos: pos, presentKeys }
}

function makePencil(className: string, title: string, onClick: (btn: HTMLElement) => void): HTMLElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = className
  btn.title = title
  btn.textContent = '✎'
  btn.contentEditable = 'false'
  btn.addEventListener('mousedown', e => {
    e.preventDefault()
    e.stopPropagation()
    onClick(btn)
  })
  return btn
}

export const attrPencilKey = new PluginKey('attrPencil')

export function createAttrPencilPlugin(): Plugin {
  return new Plugin({
    key: attrPencilKey,
    props: {
      decorations(state) {
        const decos: Decoration[] = []
        state.doc.forEach((node, offset) => {
          if (node.type.name === 'scene_heading') {
            // Widget inside the heading, after its text
            decos.push(Decoration.widget(offset + node.nodeSize - 1, view =>
              makePencil('cs-attr-pencil', 'Add scene attribute', btn => {
                const ctx = sceneAttrContext(view, offset)
                const options = SCENE_META_KEYS.filter(k => !ctx.presentKeys.has(k))
                showMenu(btn, options, key => {
                  const fresh = sceneAttrContext(view, offset)
                  insertNode(view, fresh.insertPos, schema.nodes['scene_metadata']!.create({ metaKey: key }))
                })
              }),
            { side: 1 }))
          }
          if (node.type.name === 'title_page') {
            // Title page fields are added and edited in the title page form; the pencil
            // (top-right of the card, positioned by CSS) opens it.
            decos.push(Decoration.widget(offset + 1, () =>
              makePencil('cs-attr-pencil cs-tp-pencil', 'Edit title page', () => {
                closeMenu()
                openTitlePageForm()
              }),
            { side: -1, key: 'tp-pencil' }))
          }
        })
        return DecorationSet.create(state.doc, decos)
      },
    },
    view() {
      return { destroy: closeMenu }
    },
  })
}
