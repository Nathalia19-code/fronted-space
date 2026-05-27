import { useState } from 'react'

/**
 * Convierte un valor de precio (string, número o null) a {@code number} o {@code null}.
 *
 * <p>Acepta tanto punto como coma decimal. Devuelve {@code null} si el valor es vacío,
 * nulo o no parseable como número, para que el panel lo muestre como "inválido" en rojo.
 *
 * @param {*} raw - Valor a parsear.
 * @returns {number|null} Precio numérico o {@code null} si no es válido.
 */
function parsePrice(raw) {
  if (raw == null || raw === '') return null
  const n = parseFloat(String(raw).trim().replace(',', '.'))
  return isNaN(n) ? null : n
}

/**
 * Extrae la etiqueta, el icono y el precio de un bloque del itinerario para el panel de
 * presupuesto. Prioriza los datos manuales ({@code dato}) sobre {@code datosReferencia}
 * con la misma lógica de comprobación explícita que usan los bloques del editor
 * ({@code != null && !== ''}).
 *
 * @param {Object} b - Bloque del itinerario con campos {@code tipo}, {@code dato} y {@code datosReferencia}.
 * @returns {{ label: string, price: number|null, icon: string, suffix?: string }|null}
 *   Objeto con los datos de presentación, o {@code null} si el tipo no es gestionado.
 */
function getBlockInfo(b) {
  const dr = b.datosReferencia
  const dato = b.dato || {}
  if (b.tipo === 'vuelo') {
    const rawPrice = (dato.precio != null && dato.precio !== '') ? dato.precio : dr?.precio
    const orig = dato.origen || dr?.origen || ''
    const dest = dato.destino || dr?.destino || ''
    return { label: (orig && dest) ? `${orig} → ${dest}` : 'Vuelo', price: parsePrice(rawPrice), icon: 'ph-airplane-tilt' }
  }
  if (b.tipo === 'hotel') {
    const rawPrice = (dato.precioNoche != null && dato.precioNoche !== '') ? dato.precioNoche : dr?.precioNoche
    return { label: dato.nombre || dr?.hotel || 'Hotel', price: parsePrice(rawPrice), icon: 'ph-buildings', suffix: '/n' }
  }
  if (b.tipo === 'actividad') {
    const rawPrice = (dato.precio != null && dato.precio !== '') ? dato.precio : dr?.precio
    return { label: dato.nombre || dr?.nombre || 'Actividad', price: parsePrice(rawPrice), icon: 'ph-ticket' }
  }
  return null
}

/**
 * Panel de resumen de presupuesto del itinerario, ubicado en la barra lateral derecha
 * del editor.
 *
 * <p>Extrae automáticamente los precios de todos los bloques de tipo {@code vuelo},
 * {@code hotel} y {@code actividad} usando la función auxiliar {@code getBlockInfo}.
 * Para bloques vinculados (con {@code datosReferencia}) lee el precio de {@code dato}
 * primero y cae a {@code datosReferencia} si el campo en {@code dato} es nulo o vacío,
 * siguiendo el mismo patrón de prioridad que el resto de bloques del editor.
 *
 * <p>Permite añadir gastos extra (descripción + importe, que puede ser negativo para
 * representar descuentos o reembolsos) mediante un mini-formulario inline. Los extras
 * se persisten en el estado del itinerario a través del callback {@code onExtrasChange},
 * que los guarda vía PATCH {@code /viajes/{id}/gastos-extra} en el padre.
 *
 * <p>Muestra el subtotal de los bloques, la lista de extras con icono de más/menos según
 * el signo del importe, y el total final en EUR. El panel se puede plegar a una vista
 * compacta que solo muestra el total.
 *
 * <p>Todos los importes se formatean a dos decimales con coma decimal ({@code fmt}).
 * Los precios inválidos (que no se pueden parsear a número) se muestran como
 * {@code "inválido"} en rojo.
 *
 * @param {Array} bloques - Lista completa de bloques del itinerario.
 * @param {Array<{id: number, label: string, monto: number}>} extras - Gastos extra actuales.
 * @param {Function} onExtrasChange - Callback invocado con la nueva lista de extras al añadir o eliminar uno.
 */
export default function PresupuestoPanel({ bloques, extras = [], onExtrasChange }) {
  const [nuevoLabel, setNuevoLabel] = useState('')
  const [nuevoMonto, setNuevoMonto] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const blockInfos = bloques
    .filter(b => ['vuelo', 'hotel', 'actividad'].includes(b.tipo))
    .map(b => ({ id: b.id, ...getBlockInfo(b) }))

  const totalBloques = blockInfos.reduce((s, b) => s + (b.price ?? 0), 0)
  const totalExtras = extras.reduce((s, e) => s + Number(e.monto), 0)
  const total = totalBloques + totalExtras

  /**
   * Valida y persiste un nuevo gasto extra a partir del formulario inline.
   *
   * <p>Normaliza el importe aceptando tanto punto como coma decimal. Si la descripción
   * está vacía o el importe no es un número válido, la función retorna sin hacer nada.
   * Asigna como identificador el timestamp actual ({@code Date.now()}) para garantizar
   * unicidad dentro de la sesión. Tras añadir el extra invoca {@code onExtrasChange} con
   * la lista actualizada, resetea los campos del formulario y oculta el formulario.
   *
   * @param {React.FormEvent} e - Evento de envío del formulario; se cancela con {@code preventDefault}.
   */
  function agregarExtra(e) {
    e.preventDefault()
    const monto = parseFloat(nuevoMonto.replace(',', '.'))
    if (!nuevoLabel.trim() || isNaN(monto)) return
    onExtrasChange([...extras, { id: Date.now(), label: nuevoLabel.trim(), monto }])
    setNuevoLabel('')
    setNuevoMonto('')
    setShowForm(false)
  }

  /**
   * Elimina un gasto extra de la lista filtrando por su identificador.
   *
   * <p>Construye una nueva lista sin el extra indicado e invoca {@code onExtrasChange}
   * para que el padre persista el cambio vía PATCH {@code /viajes/{id}/gastos-extra}.
   *
   * @param {number} extraId - Identificador del gasto extra a eliminar.
   */
  function eliminarExtra(extraId) {
    onExtrasChange(extras.filter(x => x.id !== extraId))
  }

  /** Formatea un número a dos decimales con coma decimal para mostrar importes en EUR. */
  const fmt = n => n.toFixed(2).replace('.', ',')

  if (collapsed) {
    return (
      <div style={{ width: '100%', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'white', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
          <i className="ph ph-wallet" style={{ color: '#3b82f6' }}></i>
          <span style={{ fontSize: '15px', color: '#3b82f6' }}>{fmt(total)} EUR</span>
        </span>
        <button onClick={() => setCollapsed(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
          <i className="ph ph-caret-down"></i>
        </button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'white', fontSize: '13px' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="ph ph-wallet" style={{ color: '#3b82f6' }}></i> Presupuesto
        </span>
        <button onClick={() => setCollapsed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
          <i className="ph ph-caret-up"></i>
        </button>
      </div>

      {blockInfos.length > 0 && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
          {blockInfos.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden' }}>
                <i className={`ph ${b.icon}`} style={{ color: '#6b7280', flexShrink: 0, fontSize: '12px' }}></i>
                <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>{b.label}</span>
              </div>
              <span style={{ fontWeight: 600, flexShrink: 0, color: b.price == null ? '#dc2626' : '#111827', fontSize: '12px' }}>
                {b.price == null ? 'inválido' : `${fmt(b.price)}${b.suffix ?? ''}`}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Subtotal bloques</span>
            <span style={{ fontWeight: 600 }}>{fmt(totalBloques)} EUR</span>
          </div>
        </div>
      )}

      {extras.length > 0 && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-color)' }}>
          {extras.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
                <i className={`ph ${Number(e.monto) >= 0 ? 'ph-plus-circle' : 'ph-minus-circle'}`} style={{ color: Number(e.monto) >= 0 ? '#22c55e' : '#ef4444', flexShrink: 0, fontSize: '12px' }}></i>
                <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>{e.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <span style={{ fontWeight: 600, color: Number(e.monto) >= 0 ? '#111827' : '#ef4444', fontSize: '12px' }}>
                  {Number(e.monto) > 0 ? '+' : ''}{fmt(Number(e.monto))}
                </span>
                <button onClick={() => eliminarExtra(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0 2px', display: 'flex' }}>
                  <i className="ph ph-x" style={{ fontSize: '11px' }}></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-color)' }}>
        {showForm ? (
          <form onSubmit={agregarExtra} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              value={nuevoLabel}
              onChange={e => setNuevoLabel(e.target.value)}
              placeholder="Descripción (ej: Comida)"
              style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}
              autoFocus
            />
            <input
              value={nuevoMonto}
              onChange={e => setNuevoMonto(e.target.value)}
              placeholder="Importe (negativo = descuento)"
              style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="submit" style={{ flex: 1, background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', padding: '5px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Añadir</button>
              <button type="button" onClick={() => { setShowForm(false); setNuevoLabel(''); setNuevoMonto('') }} style={{ flex: 1, background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>Cancelar</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)} style={{ background: 'none', border: '1px dashed var(--border-color)', borderRadius: '6px', padding: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontFamily: 'inherit' }}>
            <i className="ph ph-plus"></i> Añadir gasto extra
          </button>
        )}
      </div>

      <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '13px' }}>TOTAL</span>
        <span style={{ fontWeight: 700, fontSize: '16px', color: '#3b82f6' }}>{fmt(total)} EUR</span>
      </div>
    </div>
  )
}
