import { useRef, useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import api from '../../api/axiosConfig'

export default function TextBlock({ bloque, viajeId, onDelete, ydoc }) {
  const [titulo, setTitulo] = useState(bloque?.dato?.titulo ?? '')

  const debounceBody  = useRef(null)
  const debounceTitle = useRef(null)

  const editor = useEditor({
    extensions: [
      // Cuando hay Y.Doc se desactiva el historial propio de TipTap porque
      // Yjs tiene su propio sistema de deshacer/rehacer (undo manager)
      StarterKit.configure({ history: ydoc ? false : undefined }),
      Placeholder.configure({ placeholder: 'Escribe tus notas aquí...' }),
      // La extensión Collaboration conecta TipTap con el campo del Y.Doc
      // Cada bloque tiene su propio campo identificado por su ID
      ...(ydoc ? [Collaboration.configure({ document: ydoc, field: `block-${bloque.id}` })] : []),
    ],
    // Cuando hay Y.Doc, Collaboration gestiona el contenido directamente
    // Cuando no hay Y.Doc (fallback), se usa el contenido de MongoDB
    content: ydoc ? undefined : (bloque?.contenido ?? ''),
    onUpdate({ editor }) {
      // Guardado en MongoDB cada 800ms de inactividad (persistencia)
      // La sincronización en tiempo real la gestiona Yjs + WebSocket en ItineraryPage
      clearTimeout(debounceBody.current)
      debounceBody.current = setTimeout(() => {
        api.put(`/viajes/${viajeId}/itinerario/bloque/${bloque.id}`, {
          tipo: 'texto',
          contenido: editor.getHTML(),
          dato: { titulo },
        }).catch(() => {})
      }, 800)
    },
  })

  // Cuando el Y.Doc está vacío para este bloque (ej: primer usuario que abre
  // el editor tras un reinicio del servidor), se inicializa desde MongoDB.
  // Así todos los usuarios parten del mismo estado guardado.
  useEffect(() => {
    if (!editor || !ydoc) return
    const fragment = ydoc.getXmlFragment(`block-${bloque.id}`)
    const hayContenidoMongo =
      bloque?.contenido &&
      bloque.contenido !== '<p></p>' &&
      bloque.contenido.trim() !== ''
    if (fragment.length === 0 && hayContenidoMongo) {
      editor.commands.setContent(bloque.contenido)
    }
  }, [editor]) // solo al montar el editor

  function handleTituloChange(e) {
    const val = e.target.value
    setTitulo(val)
    clearTimeout(debounceTitle.current)
    debounceTitle.current = setTimeout(() => {
      api.put(`/viajes/${viajeId}/itinerario/bloque/${bloque.id}`, {
        tipo: 'texto',
        contenido: editor?.getHTML() ?? '',
        dato: { titulo: val },
      }).catch(() => {})
    }, 800)
  }

  return (
    <div className="itinerary-block">
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
