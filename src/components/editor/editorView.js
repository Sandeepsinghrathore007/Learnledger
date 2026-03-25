export function getMountedEditorView(editor) {
  if (!editor || editor.isDestroyed) {
    return null
  }

  try {
    const view = editor.view
    const canCheckDom = typeof HTMLElement !== 'undefined'

    if (view.isDestroyed || !canCheckDom || !(view.dom instanceof HTMLElement)) {
      return null
    }

    return view
  } catch {
    return null
  }
}
