import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Boton, Cargando, Etiqueta, Tarjeta, CabeceraPagina } from '../ui';

interface Noti { id: string; tipo: string; mensaje: string; datos: Record<string, unknown>; creado_en: string; leida_en: string | null }

const TIPO: Record<string, { txt: string; tono: 'marca' | 'exito' | 'error' | 'aviso' }> = {
  FICHAJE_CORREGIDO: { txt: 'Corrección de fichaje', tono: 'aviso' },
  AUSENCIA_APROBADA: { txt: 'Ausencia aprobada', tono: 'exito' },
  AUSENCIA_DENEGADA: { txt: 'Ausencia denegada', tono: 'error' },
  AUSENCIA_PENDIENTE: { txt: 'Solicitud pendiente', tono: 'marca' },
};

export function Avisos() {
  const [filas, setFilas] = useState<Noti[] | null>(null);

  const cargar = useCallback(async () => {
    try { setFilas(await api.get<Noti[]>('/horario/notificaciones')); } catch { setFilas([]); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  async function leer(id: string) { await api.patch(`/horario/notificaciones/${id}/leida`).catch(() => {}); await cargar(); }
  async function leerTodas() { await api.post('/horario/notificaciones/leer-todas').catch(() => {}); await cargar(); }

  const sinLeer = (filas ?? []).filter((n) => !n.leida_en).length;

  return (
    <div>
      <CabeceraPagina titulo="Mis avisos" descripcion="Resoluciones de tus solicitudes y correcciones sobre tus fichajes." />

      <Tarjeta
        titulo={sinLeer ? `Sin leer (${sinLeer})` : 'Todos los avisos'}
        accion={sinLeer > 0 ? <Boton variante="secundario" onClick={leerTodas}>Marcar todo como leído</Boton> : undefined}
      >
        {!filas ? <Cargando /> : filas.length === 0 ? (
          <p className="text-apagado">No tienes avisos.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {filas.map((n) => {
              const meta = TIPO[n.tipo] ?? { txt: n.tipo, tono: 'marca' as const };
              return (
                <li key={n.id} className={`py-3.5 flex flex-wrap items-start gap-3 ${n.leida_en ? 'opacity-60' : ''}`}>
                  <Etiqueta tono={meta.tono}>{meta.txt}</Etiqueta>
                  <div className="flex-1 min-w-[220px]">
                    <p className="text-sm">{n.mensaje}</p>
                    <p className="text-xs text-tenue mt-0.5">{new Date(n.creado_en).toLocaleString('es-ES')}</p>
                  </div>
                  {!n.leida_en && (
                    <button onClick={() => leer(n.id)} className="text-sm font-semibold text-marca-700 underline">
                      Marcar leído
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
