import { useRef, useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import api from '../../api/axiosConfig'

export default function TextBlock({ bloque, viajeId, onDelete, onContentSaved, ydoc }) {
  const [titulo, setTitulo] = useState(bloque?.dato?.titulo ?? '')

  const debounceBody  = useRef(null)
  const debounceTitle = useRef(null)
  const blockFocused  = useRef(false)
  const initializado  = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Placeholder.configure({ placeholder: 'Escribe tus notas aquí...' }),
      Collaboration.configure({ document: ydoc, field: `block-${bloque.id}` }),
    ],
    onUpdate({ editor }) {
      clearTimeout(debounceBody.current)
      debounceBody.current = setTimeout(async () => {
        const html = editor.getHTML()
        try {
          await api.put(`/viajes/${viajeId}/itinerario/bloque/${bloque.id}`, {
            tipo: 'texto',
            contenido: html,
            dato: { titulo },
          })
        } catch {}
      }, 800)
    },
  })

  useEffect(() => {
    if (!editor || initializado.current) return
    initializado.current = true
    const fragment = ydoc.getXmlFragment(`block-${bloque.id}`)
    if (fragment.length === 0 && bloque?.contenido && bloque.contenido !== '<p></p>') {
      editor.commands.setContent(bloque.contenido)
    }
  }, [editor])

  useEffect(() => {
    if (blockFocused.current) return
    setTitulo(bloque?.dato?.titulo ?? '')
  }, [bloque?.dato?.titulo])

  function handleTituloChange(e) {
    const val = e.target.value
    setTitulo(val)
    clearTimeout(debounceTitle.current)
    debounceTitle.current = setTimeout(async () => {
      try {
        await api.put(`/viajes/${viajeId}/itinerario/bloque/${bloque.id}`, {
          tipo: 'texto',
          contenido: editor?.getHTML() ?? '',
          dato: { titulo: val },
        })
        onContentSaved?.()
      } catch {}
    }, 800)
  }

  return (
    <div className="itinerary-block" onFocus={() => { blockFocused.current = true }} onBlur={() => { blockFocused.current = false }}>
      <div className="block-controls">
        <i className="ph ph-dots-six-vertical drag-handle"></i>
        <button
          onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px', padding: '2px 4px' }}
          title="Eliminar bloque"
        >
          <i className="ph ph-trash"></i>
        </button>
      </div>
      <div className="block-content">
        <input
          className="block-title-input"
          placeholder="Título del día (Ej: Día 1 — Roma)"
          value={titulo}
          onChange={handleTituloChange}
        />
        <EditorContent editor={editor} className="tiptap-editor" />
      </div>
    </div>
  )
}
