import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { insertInlineNoteAtRange } from '@/components/editor/InlineNoteNode'

const EMPTY_SLASH_STATE = {
  active: false,
  range: null,
  query: '',
  item: null,
}

export const inlineNoteSlashCommandKey = new PluginKey('inlineNoteSlashCommand')

function getMatchingItem(query) {
  const normalized = query.trim().toLowerCase()
  if (normalized !== '' && !'note'.startsWith(normalized)) return null

  return {
    id: 'note',
    title: 'Inline Note',
    description: 'Insert a collapsible note block',
  }
}

function resolveSlashCommandState(state) {
  const { selection } = state

  if (!selection.empty) return EMPTY_SLASH_STATE

  const { $from } = selection
  if (!$from.parent.isTextblock) return EMPTY_SLASH_STATE

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
  const match = textBefore.match(/(?:^|\s)(\/[a-z]*)$/i)

  if (!match) return EMPTY_SLASH_STATE

  const token = match[1]
  const item = getMatchingItem(token.slice(1))
  if (!item) return EMPTY_SLASH_STATE

  return {
    active: true,
    range: {
      from: selection.from - token.length,
      to: selection.from,
    },
    query: token.slice(1),
    item,
  }
}

export function getInlineNoteSlashCommandState(state) {
  return inlineNoteSlashCommandKey.getState(state) || EMPTY_SLASH_STATE
}

export const InlineNoteSlashCommand = Extension.create({
  name: 'inlineNoteSlashCommand',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: inlineNoteSlashCommandKey,
        state: {
          init: () => EMPTY_SLASH_STATE,
          apply: (transaction, _value, _oldState, newState) => {
            if (transaction.getMeta(inlineNoteSlashCommandKey)?.dismiss) {
              return EMPTY_SLASH_STATE
            }

            return resolveSlashCommandState(newState)
          },
        },
        props: {
          handleKeyDown: (view, event) => {
            const pluginState = inlineNoteSlashCommandKey.getState(view.state)
            if (!pluginState?.active) return false

            if (event.key === 'Escape') {
              view.dispatch(view.state.tr.setMeta(inlineNoteSlashCommandKey, { dismiss: true }))
              return true
            }

            if (event.key !== 'Enter') return false

            event.preventDefault()
            insertInlineNoteAtRange(this.editor, pluginState.range)
            return true
          },
        },
      }),
    ]
  },
})
