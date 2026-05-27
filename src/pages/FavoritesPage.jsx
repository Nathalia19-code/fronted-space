import { useState, useEffect, useCallback } from 'react'
import api from '../api/axiosConfig'
import useFavoritosSocket from '../hooks/useFavoritosSocket'
import ConfirmEliminarFavoritoModal from '../components/ConfirmEliminarFavoritoModal'

const TIPO_ICONO = { vuelo: 'ph-airplane-tilt', hotel: 'ph-buildings', actividad: 'ph-ticket' }
const TIPO_ENDPOINT = { vuelo: 'vuelos', hotel: 'alojamientos', actividad: 'actividades' }

function nombreFavorito(datos, tipo) {
  if (!datos) return '—'
  if (tipo === 'vuelo') return datos.aerolinea ? `${datos.origen} → ${datos.destino}` : '—'
  if (tipo === 'hotel') return datos.hotel || '—'
  return datos.nombre || '—'
}

export default function FavoritesPage() {
  const [vuelos, setVuelos] = useState([])
  const [alojamientos, setAlojamientos] = useState([])
  const [actividades, setActividades] = useState([])
  const [carpetas, setCarpetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingCarpetaDelete, setPendingCarpetaDelete] = useState(null)

  const [carpetaMenuFavId, setCarpetaMenuFavId] = useState(null)
  const [showNuevaCarpeta, setShowNuevaCarpeta] = useState(false)
  const [nuevaCarpetaNombre, setNuevaCarpetaNombre] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameNombre, setRenameNombre] = useState('')
  const [expandidas, setExpandidas] = useState({})

  const cargar = useCallback(() => {
    Promise.all([
      api.get('/favoritos/vuelos'),
      api.get('/favoritos/alojamientos'),
      api.get('/favoritos/actividades'),
      api.get('/carpetas'),
    ])
      .then(([rv, ra, rac, rc]) => {
        setVuelos(rv.data)
        setAlojamientos(ra.data)
        setActividades(rac.data)
        setCarpetas(rc.data)
        setError('')
      })
      .catch(() => setError('No se pudieron cargar los favoritos.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useFavoritosSocket(cargar)

  useEffect(() => {
    if (!carpetaMenuFavId) return
    function close(e) {
      if (!e.target.closest('[data-carpeta-menu]')) setCarpetaMenuFavId(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [carpetaMenuFavId])

  async function iniciarEliminar(id, tipo) {
    try {
      const viajesAfectados = await api.get(`/favoritos/${id}/en-uso`).then(r => r.data)
      if (viajesAfectados.length === 0) {
        await borrarFavorito(id, tipo, true)
      } else {
        setPendingDelete({ id, tipo, viajesAfectados })
      }
    } catch {
      setError('No se pudo eliminar el favorito.')
    }
  }

  async function borrarFavorito(id, tipo, eliminarBloques) {
    await api.delete(`/favoritos/${TIPO_ENDPOINT[tipo] ?? tipo}/${id}?eliminarBloques=${eliminarBloques}`)
    if (tipo === 'vuelos' || tipo === 'vuelo') setVuelos(prev => prev.filter(v => v.id !== id))
    else if (tipo === 'alojamientos' || tipo === 'hotel') setAlojamientos(prev => prev.filter(a => a.id !== id))
    else setActividades(prev => prev.filter(a => a.id !== id))
  }

  async function ejecutarEliminar(eliminarBloques) {
    const { id, tipo } = pendingDelete
    setPendingDelete(null)
    try { await borrarFavorito(id, tipo, eliminarBloques) }
    catch { setError('No se pudo eliminar el favorito.') }
  }

  async function quitarDeCarpeta(carpetaId, carpetaItemId, favoritoId) {
    try {
      const viajesAfectados = await api.get(`/carpetas/${carpetaId}/items/${carpetaItemId}/en-uso`).then(r => r.data)
      if (viajesAfectados.length === 0) {
        await api.delete(`/carpetas/${carpetaId}/items/${carpetaItemId}`)
        setCarpetas(prev => prev.map(c =>
          c.id === carpetaId ? { ...c, items: c.items.filter(i => i.id !== carpetaItemId && i.favoritoId !== favoritoId) } : c
        ))
      } else {
        setPendingCarpetaDelete({ carpetaId, carpetaItemId, favoritoId, viajesAfectados })
      }
    } catch { setError('Error al quitar de la carpeta.') }
  }

  async function ejecutarEliminarCarpeta(eliminarBloques) {
    const { carpetaId, carpetaItemId, favoritoId } = pendingCarpetaDelete
    setPendingCarpetaDelete(null)
    try {
      await api.delete(`/carpetas/${carpetaId}/items/${carpetaItemId}?eliminarBloques=${eliminarBloques}`)
      setCarpetas(prev => prev.map(c =>
        c.id === carpetaId ? { ...c, items: c.items.filter(i => i.id !== carpetaItemId && i.favoritoId !== favoritoId) } : c
      ))
    } catch { setError('Error al quitar de la carpeta.') }
  }

  async function toggleCarpetaItem(carpetaId, tipo, favoritoId, itemData) {
    const carpeta = carpetas.find(c => c.id === carpetaId)
    const carpetaItem = carpeta?.items.find(i => i.favoritoId === favoritoId)
    const estaEn = !!carpetaItem
    if (estaEn) {
      const carpetaItemId = carpetaItem.id ?? favoritoId
      await quitarDeCarpeta(carpetaId, carpetaItemId, favoritoId)
    } else {
      try {
        await api.post(`/carpetas/${carpetaId}/items`, { tipo, favoritoId, datos: itemData })
        const res = await api.get('/carpetas')
        setCarpetas(res.data)
      } catch { setError('Error al actualizar la carpeta.') }
    }
  }

  async function crearCarpeta(e) {
    e.preventDefault()
    if (!nuevaCarpetaNombre.trim()) return
    try {
      await api.post('/carpetas', { nombre: nuevaCarpetaNombre.trim() })
      setNuevaCarpetaNombre('')
      setShowNuevaCarpeta(false)
      const res = await api.get('/carpetas')
      setCarpetas(res.data)
    } catch { setError('Error al crear la carpeta.') }
  }

  async function eliminarCarpeta(id) {
    try {
      await api.delete(`/carpetas/${id}`)
      setCarpetas(prev => prev.filter(c => c.id !== id))
    } catch { setError('Error al eliminar la carpeta.') }
  }

  async function renombrarCarpeta(e) {
    e.preventDefault()
    if (!renameNombre.trim()) return
    try {
      await api.put(`/carpetas/${renamingId}`, { nombre: renameNombre.trim() })
      setCarpetas(prev => prev.map(c => c.id === renamingId ? { ...c, nombre: renameNombre.trim() } : c))
      setRenamingId(null)
      setRenameNombre('')
    } catch { setError('Error al renombrar la carpeta.') }
  }

  function toggleExpandida(id) {
    setExpandidas(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <i className="ph ph-circle-notch" style={{ fontSize: '36px', animation: 'spin 1s linear infinite' }}></i>
        <p style={{ marginTop: '12px' }}>Cargando favoritos...</p>
      </div>
    )
  }

  return (
    <div>
      <ConfirmEliminarFavoritoModal
        show={!!pendingDelete}
        viajesAfectados={pendingDelete?.viajesAfectados}
        onSi={() => ejecutarEliminar(true)}
        onNo={() => ejecutarEliminar(false)}
        onCancelar={() => setPendingDelete(null)}
      />
      <ConfirmEliminarFavoritoModal
        show={!!pendingCarpetaDelete}
        viajesAfectados={pendingCarpetaDelete?.viajesAfectados}
        onSi={() => ejecutarEliminarCarpeta(true)}
        onNo={() => ejecutarEliminarCarpeta(false)}
        onCancelar={() => setPendingCarpetaDelete(null)}
      />

      <header className="section-header">
        <h2>Favoritos</h2>
        <p>Tus vuelos, alojamientos y actividades guardados.</p>
      </header>

      {error && <p className="login-error" style={{ marginBottom: '20px' }}>{error}</p>}

      <SeccionFavoritos
        titulo="Vuelos" icono="ph-airplane-tilt" tipo="vuelo"
        items={vuelos} carpetas={carpetas}
        carpetaMenuFavId={carpetaMenuFavId}
        onToggleMenu={id => setCarpetaMenuFavId(prev => prev === id ? null : id)}
        onEliminar={id => iniciarEliminar(id, 'vuelos')}
        onToggleCarpeta={toggleCarpetaItem}
        renderCard={v => <CardVuelo vuelo={v} />}
      />

      <SeccionFavoritos
        titulo="Alojamientos" icono="ph-buildings" tipo="hotel"
        items={alojamientos} carpetas={carpetas}
        carpetaMenuFavId={carpetaMenuFavId}
        onToggleMenu={id => setCarpetaMenuFavId(prev => prev === id ? null : id)}
        onEliminar={id => iniciarEliminar(id, 'alojamientos')}
        onToggleCarpeta={toggleCarpetaItem}
        renderCard={a => <CardAlojamiento alojamiento={a} />}
      />

      <SeccionFavoritos
        titulo="Actividades" icono="ph-ticket" tipo="actividad"
        items={actividades} carpetas={carpetas}
        carpetaMenuFavId={carpetaMenuFavId}
        onToggleMenu={id => setCarpetaMenuFavId(prev => prev === id ? null : id)}
        onEliminar={id => iniciarEliminar(id, 'actividades')}
        onToggleCarpeta={toggleCarpetaItem}
        renderCard={a => <CardActividad actividad={a} />}
      />

      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: '700', margin: 0 }}>
            <i className="ph ph-folders"></i> Carpetas de ideas
          </h3>
          {!showNuevaCarpeta && (
            <button
              onClick={() => setShowNuevaCarpeta(true)}
              style={{ background: 'none', border: '1px dashed var(--border-color)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <i className="ph ph-plus"></i> Nueva carpeta
            </button>
          )}
        </div>

        {showNuevaCarpeta && (
          <form onSubmit={crearCarpeta} style={{ display: 'flex', gap: '8px', marginBottom: '16px', maxWidth: '360px' }}>
            <input
              autoFocus
              value={nuevaCarpetaNombre}
              onChange={e => setNuevaCarpetaNombre(e.target.value)}
              placeholder="Nombre de la carpeta..."
              style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
            />
            <button type="submit" style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Crear</button>
            <button type="button" onClick={() => { setShowNuevaCarpeta(false); setNuevaCarpetaNombre('') }} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>Cancelar</button>
          </form>
        )}

        {carpetas.length === 0 && !showNuevaCarpeta && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontStyle: 'italic' }}>
            No tienes carpetas creadas todavía. Crea una para organizar tus favoritos.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {carpetas.map(carpeta => (
            <div key={carpeta.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', background: 'white', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleExpandida(carpeta.id)}>
                <i className="ph ph-folder-simple" style={{ fontSize: '18px', color: '#f5b400' }}></i>
                {renamingId === carpeta.id ? (
                  <form onSubmit={renombrarCarpeta} onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '6px', flex: 1 }}>
                    <input
                      autoFocus
                      value={renameNombre}
                      onChange={e => setRenameNombre(e.target.value)}
                      style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '6px', padding: '3px 8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                    />
                    <button type="submit" style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>OK</button>
                    <button type="button" onClick={() => setRenamingId(null)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>✕</button>
                  </form>
                ) : (
                  <span style={{ flex: 1, fontWeight: 600, fontSize: '15px' }}>{carpeta.nombre}</span>
                )}
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginRight: '4px' }}>{carpeta.items.length} elementos</span>
                {renamingId !== carpeta.id && (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); setRenamingId(carpeta.id); setRenameNombre(carpeta.nombre) }}
                      title="Renombrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', display: 'flex' }}
                    >
                      <i className="ph ph-pencil-simple" style={{ fontSize: '14px' }}></i>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); eliminarCarpeta(carpeta.id) }}
                      title="Eliminar carpeta" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px', display: 'flex' }}
                    >
                      <i className="ph ph-trash" style={{ fontSize: '14px' }}></i>
                    </button>
                  </>
                )}
                <i className={`ph ph-caret-${expandidas[carpeta.id] ? 'up' : 'down'}`} style={{ fontSize: '14px', color: 'var(--text-secondary)' }}></i>
              </div>

              {expandidas[carpeta.id] && (
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {carpeta.items.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>Carpeta vacía. Asigna favoritos usando el icono <i className="ph ph-folder-simple-plus"></i> en cada tarjeta.</p>
                  ) : (
                    carpeta.items.map(item => (
                      <div key={item.id ?? item.favoritoId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--hover-bg)' }}>
                        <i className={`ph ${TIPO_ICONO[item.tipo]}`} style={{ fontSize: '15px', color: '#3b82f6', flexShrink: 0 }}></i>
                        <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {nombreFavorito(item.datos, item.tipo)}
                        </span>
                        <button
                          onClick={() => quitarDeCarpeta(carpeta.id, item.id ?? item.favoritoId, item.favoritoId)}
                          title="Quitar de esta carpeta"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', display: 'flex', flexShrink: 0 }}
                        >
                          <i className="ph ph-x" style={{ fontSize: '13px' }}></i>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SeccionFavoritos({ titulo, icono, tipo, items, carpetas, carpetaMenuFavId, onToggleMenu, onEliminar, onToggleCarpeta, renderCard }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>
        <i className={`ph ${icono}`}></i> {titulo}
        {items.length > 0 && <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--text-secondary)' }}>({items.length})</span>}
      </h3>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontStyle: 'italic' }}>
          No tienes {titulo.toLowerCase()} guardados todavía.
        </p>
      ) : (
        <div className="cards-grid">
          {items.map(item => (
            <div key={item.id} className="card" style={{ position: 'relative', overflow: 'visible' }}>
              <div style={{ position: 'absolute', top: 0, right: '12px', zIndex: 1, display: 'flex', flexDirection: 'row', gap: '4px', alignItems: 'center', transform: 'translateY(-50%)' }}>
                <div data-carpeta-menu style={{ position: 'relative' }}>
                  <button
                    onClick={() => onToggleMenu(item.id)}
                    title="Asignar a carpeta"
                    style={{ background: carpetaMenuFavId === item.id ? '#f3f4f6' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: carpetas.some(c => c.items.some(i => i.favoritoId === item.id)) ? '#f5b400' : 'var(--text-secondary)' }}
                  >
                    <i className="ph ph-folder-simple-plus" style={{ fontSize: '14px' }}></i>
                  </button>

                  {carpetaMenuFavId === item.id && (
                    <div style={{ position: 'absolute', top: '32px', right: 0, minWidth: '180px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
                      {carpetas.length === 0 ? (
                        <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Sin carpetas creadas</p>
                      ) : (
                        carpetas.map(c => {
                          const checked = c.items.some(i => i.favoritoId === item.id)
                          return (
                            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border-color)', background: checked ? '#fefce8' : 'transparent' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggleCarpeta(c.id, tipo, item.id, item)}
                                style={{ cursor: 'pointer', accentColor: '#f5b400' }}
                              />
                              <i className="ph ph-folder-simple" style={{ color: '#f5b400', fontSize: '13px' }}></i>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>

                <button
                  className="btn-favorite favorited"
                  onClick={() => onEliminar(item.id)}
                  title="Quitar de favoritos"
                  style={{ position: 'static' }}
                >
                  <i className="ph ph-heart ph-fill" style={{ color: '#ef4444' }}></i>
                </button>
              </div>

              {renderCard(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CardVuelo({ vuelo }) {
  const [fechaSal, horaSal] = vuelo.horaSalida ? vuelo.horaSalida.split('T') : ['', '']
  const [fechaLleg, horaLleg] = vuelo.horaLlegada ? vuelo.horaLlegada.split('T') : ['', '']
  return (
    <div className="card-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <i className="ph ph-airplane-tilt" style={{ color: '#3b82f6', fontSize: '18px' }}></i>
        <span style={{ fontWeight: 600, fontSize: '15px' }}>{vuelo.aerolinea}</span>
      </div>
      <h3 style={{ margin: '6px 0 12px' }}>{vuelo.origen} → {vuelo.destino}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>SALIDA</p>
          <p style={{ margin: 0, fontWeight: 600 }}>{horaSal ? horaSal.slice(0, 5) : '—'}</p>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{fechaSal}</p>
        </div>
        <div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>LLEGADA</p>
          <p style={{ margin: 0, fontWeight: 600 }}>{horaLleg ? horaLleg.slice(0, 5) : '—'}</p>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{fechaLleg}</p>
        </div>
      </div>
      {vuelo.duracion && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
          <i className="ph ph-clock"></i>
          <span>Duración: {vuelo.duracion}</span>
        </div>
      )}
      <div style={{ flex: 1 }}></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="tag" style={{ background: '#f3f4f6', color: 'var(--text-secondary)', fontSize: '12px' }}>
          {{ ECONOMY: 'Turista', BUSINESS: 'Negocios', FIRST: 'Primera Clase' }[vuelo.clase] || vuelo.clase}
        </span>
        <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
          {vuelo.precio != null ? Number(vuelo.precio).toFixed(2).replace('.', ',') : '—'} {vuelo.moneda}
        </span>
      </div>
    </div>
  )
}

function CardAlojamiento({ alojamiento: a }) {
  const estrellas = parseInt(a.categoria) || 0
  return (
    <div className="card-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <i className="ph ph-buildings" style={{ color: '#3b82f6', fontSize: '18px' }}></i>
        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>{a.ciudad}, {a.pais}</span>
      </div>
      <h3 style={{ margin: '6px 0 6px' }}>{a.hotel}</h3>
      {a.direccion && (
        <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <i className="ph ph-map-pin"></i> {a.direccion}
        </p>
      )}
      {estrellas > 0 && (
        <div style={{ marginBottom: '10px', color: '#f5b400', fontSize: '15px' }}>
          {'★'.repeat(estrellas)}{'☆'.repeat(Math.max(0, 5 - estrellas))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>ENTRADA</p>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{a.fechaEntrada || '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>SALIDA</p>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{a.fechaSalida || '—'}</p>
        </div>
      </div>
      {a.serviciosIncluidos && a.serviciosIncluidos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
          {a.serviciosIncluidos.map((s, i) => (
            <span key={i} style={{ fontSize: '10px', background: '#f3f4f6', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px' }}>{s}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>por noche</span>
        <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
          {a.precioNoche != null ? Number(a.precioNoche).toFixed(2).replace('.', ',') : '—'} EUR
        </span>
      </div>
    </div>
  )
}

function CardActividad({ actividad: a }) {
  return (
    <div className="card-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <i className="ph ph-ticket" style={{ color: '#3b82f6', fontSize: '18px' }}></i>
        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>{a.ciudad}, {a.pais}</span>
      </div>
      <h3 style={{ margin: '6px 0 6px' }}>{a.nombre}</h3>
      {a.descripcion && (
        <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{a.descripcion}</p>
      )}
      {a.tipoActividad && a.tipoActividad.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
          {a.tipoActividad.map((t, i) => (
            <span key={i} style={{ fontSize: '10px', background: '#f3f4f6', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px' }}>{t}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        {a.fecha && <span><i className="ph ph-calendar"></i> {a.fecha}</span>}
        {a.duracion && <span><i className="ph ph-clock"></i> {a.duracion}</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {a.puntuacion > 0 && <span style={{ fontSize: '12px', color: '#f5b400', fontWeight: 600 }}>★ {Number(a.puntuacion).toFixed(1)}</span>}
          {a.menoresIncluidos && <span style={{ fontSize: '10px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '10px' }}>Familiar</span>}
        </div>
        <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
          {a.precio === 0 ? 'Gratis' : `${Number(a.precio).toFixed(2).replace('.', ',')} EUR`}
        </span>
      </div>
    </div>
  )
}
