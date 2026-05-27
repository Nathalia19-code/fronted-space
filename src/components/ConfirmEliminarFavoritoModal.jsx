/**
 * Modal de confirmación que aparece cuando el usuario intenta eliminar un favorito
 * que está siendo referenciado en uno o más itinerarios.
 *
 * <p>Solo se renderiza cuando {@code show} es {@code true}. Muestra la lista de
 * itinerarios afectados con su nombre y un badge que indica si son Individuales o
 * Grupales, leído del campo {@code grupal} de cada entrada.
 *
 * <p>Ofrece tres acciones:
 * <ul>
 *   <li>"Sí, eliminar también" — llama {@code onSi}; el padre ejecuta DELETE con
 *       {@code eliminarBloques=true}, que borra los bloques vinculados del itinerario.
 *   <li>"No, mantener los bloques como editables" — llama {@code onNo}; el padre
 *       ejecuta delete con {@code eliminarBloques=false}, que desvincula los bloques
 *       copiando los datos a {@code dato} y poniendo {@code referenciaId=null}.
 *   <li>"No quiero eliminar el favorito" — llama {@code onCancelar}; no modifica nada.
 * </ul>
 *
 * <p>Un clic sobre el fondo oscuro también llama {@code onCancelar}. El contenido
 * del modal detiene la propagación del clic para evitar el cierre accidental.
 *
 * @param {boolean} show - Controla si el modal es visible.
 * @param {Array<{titulo: string, grupal: boolean}>} viajesAfectados - Itinerarios que referencian el favorito.
 * @param {Function} onSi - Callback al confirmar eliminación con borrado de bloques.
 * @param {Function} onNo - Callback al confirmar eliminación manteniendo bloques editables.
 * @param {Function} onCancelar - Callback al cancelar la operación.
 */
export default function ConfirmEliminarFavoritoModal({ show, viajesAfectados, onSi, onNo, onCancelar }) {
  if (!show) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancelar}
    >
      <div
        style={{
          background: 'white', borderRadius: '16px',
          padding: '28px 28px 24px', width: '440px', maxWidth: '92vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', gap: '0',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i className="ph ph-warning" style={{ fontSize: '20px', color: '#d97706' }}></i>
          </div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Eliminar de favoritos
          </h3>
        </div>

        <p style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          ¿Quieres también eliminar este registro de todos los itinerarios en los que aparece?
        </p>

        {viajesAfectados && viajesAfectados.length > 0 && (
          <div style={{ marginBottom: '16px', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Itinerarios afectados
            </p>
            {viajesAfectados.map((v, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{v.titulo}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'white', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1px 8px' }}>
                  {v.grupal ? 'Grupal' : 'Individual'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={onSi}
            style={{
              width: '100%', padding: '11px 16px', borderRadius: '8px',
              border: 'none', cursor: 'pointer',
              background: '#fef2f2', color: '#dc2626', fontWeight: '600', fontSize: '14px',
              display: 'flex', alignItems: 'center', gap: '8px',
              textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
            onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
          >
            <i className="ph ph-trash" style={{ fontSize: '16px', flexShrink: 0 }}></i>
            <span>Sí, eliminar también de los itinerarios</span>
          </button>

          <button
            onClick={onNo}
            style={{
              width: '100%', padding: '11px 16px', borderRadius: '8px',
              border: 'none', cursor: 'pointer',
              background: '#fffbeb', color: '#92400e', fontWeight: '600', fontSize: '14px',
              display: 'flex', alignItems: 'center', gap: '8px',
              textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef3c7'}
            onMouseLeave={e => e.currentTarget.style.background = '#fffbeb'}
          >
            <i className="ph ph-link-break" style={{ fontSize: '16px', flexShrink: 0 }}></i>
            <div>
              <div>No, mantener los bloques como editables</div>
              <div style={{ fontSize: '11px', fontWeight: '400', marginTop: '2px', opacity: 0.75 }}>
                El bloque permanece en el itinerario y podrás editarlo libremente
              </div>
            </div>
          </button>

          <button
            onClick={onCancelar}
            style={{
              width: '100%', padding: '11px 16px', borderRadius: '8px',
              border: '1px solid var(--border-color)', cursor: 'pointer',
              background: 'transparent', color: 'var(--text-secondary)',
              fontWeight: '500', fontSize: '14px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            No quiero eliminar el favorito
          </button>
        </div>
      </div>
    </div>
  )
}
