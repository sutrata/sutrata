import { StreamLanguage, LanguageSupport } from '@codemirror/language'

type State = {
  inFrontmatter: boolean
  lineNum: number
  afterCharacter: boolean
}

const sutra = StreamLanguage.define<State>({
  name: 'sutra',

  startState: () => ({ inFrontmatter: false, lineNum: 0, afterCharacter: false }),

  token(stream, state) {
    state.lineNum++

    // Blank line — reset dialogue context, emit nothing
    if (stream.match(/^\s*$/)) {
      state.afterCharacter = false
      return null
    }

    // Frontmatter delimiter ---
    if (state.lineNum === 1 && stream.match(/^---\s*$/)) {
      state.inFrontmatter = true
      return 'keyword'
    }
    if (state.inFrontmatter) {
      if (stream.match(/^---\s*$/)) {
        state.inFrontmatter = false
        return 'keyword'
      }
      // key: value lines inside frontmatter
      if (stream.match(/^[A-Za-z][A-Za-z ]*:/)) return 'attributeName'
      stream.skipToEnd()
      return 'string'
    }

    // Page break ===
    if (stream.match(/^===\s*$/)) {
      state.afterCharacter = false
      return 'punctuation'
    }

    // Comment <!-- ... -->
    if (stream.match(/^<!--[\s\S]*?-->\s*$/)) {
      state.afterCharacter = false
      return 'comment'
    }

    // Note [[ ... ]]
    if (stream.match(/^\[\[[\s\S]*?\]\]\s*$/)) {
      state.afterCharacter = false
      return 'comment'
    }

    // Scene heading ## ...
    if (stream.match(/^##/)) {
      stream.skipToEnd()
      state.afterCharacter = false
      return 'keyword'
    }

    // Section heading # ...
    if (stream.match(/^#(?!#)/)) {
      stream.skipToEnd()
      state.afterCharacter = false
      return 'heading'
    }

    // Scene metadata & key: value
    if (stream.match(/^&\s/)) {
      stream.skipToEnd()
      state.afterCharacter = false
      return 'attributeName'
    }

    // Character cue @name ...
    if (stream.match(/^@/)) {
      stream.skipToEnd()
      state.afterCharacter = true
      return 'variableName'
    }

    // Centered or transition >> ...
    if (stream.match(/^>>/)) {
      stream.skipToEnd()
      state.afterCharacter = false
      return 'operator'
    }

    // Lyrics ~ ...
    if (stream.match(/^~\s/)) {
      stream.skipToEnd()
      state.afterCharacter = false
      return 'meta'
    }

    // Parenthetical (inside dialogue context)
    if (state.afterCharacter && stream.match(/^\(/)) {
      stream.skipToEnd()
      return 'string'
    }

    // Dialogue (inside dialogue context) — styled differently from action
    if (state.afterCharacter) {
      stream.skipToEnd()
      return 'labelName'
    }

    // Action — unstyled
    stream.skipToEnd()
    return null
  },

  blankLine(state) {
    state.afterCharacter = false
  },
})

export const sutraLanguage = new LanguageSupport(sutra)
