import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { Alerta, Etiqueta } from './ui';
import { hoyISO } from './fechas';

export type TipoFichaje = 'ENTRADA' | 'SALIDA' | 'INICIO_PAUSA' | 'FIN_PAUSA';
interface Evento { id: string; tipo: TipoFichaje; origen: string; momento_servidor: string; momento_cliente: string | null }

export const ETIQUETA_FICHAJE: Record<string, string> = {
  ENTRADA: 'Entrada', SALIDA: 'Salida', INICIO_PAUSA: 'Inicio de pausa', FIN_PAUSA: 'Fin de pausa',
};


/** Deriva el estado de la jornada a partir del último movimiento del día. */
function estadoDe(evs: Evento[]): { estado: 'FUERA' | 'DENTRO' | 'PAUSA'; ultimo: Evento | null } {
  const ordenados = [...evs].sort(
    (a, b) => new Date(a.momento_servidor).getTime() - new Date(b.momento_servidor).getTime(),
  );
  const ultimo = ordenados[ordenados.length - 1] ?? null;
  if (!ultimo || ultimo.tipo === 'SALIDA') return { estado: 'FUERA', ultimo };
  if (ultimo.tipo === 'INICIO_PAUSA') return { estado: 'PAUSA', ultimo };
  return { estado: 'DENTRO', ultimo };
}

export function FicharWidget({ onFichado }: { onFichado?: () => void }) {
  const [evs, setEvs] = useState<Evento[] | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState<TipoFichaje | null>(null);

  const cargar = useCallback(async () => {
    const d = hoyISO();
    try { setEvs(await api.get<Evento[]>(`/horario/fichajes?desde=${d}&hasta=${d}`)); }
    catch { setEvs([]); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  async function fichar(tipo: TipoFichaje) {
    setMsg(null); setEnviando(tipo);
    try {
      await api.post('/horario/fichar', { tipo, origen: 'WEB' });
      setMsg({ tipo: 'exito', texto: `${ETIQUETA_FICHAJE[tipo]} registrada a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.` });
      await cargar();
      onFichado?.();
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof ApiError ? e.message : 'No se pudo fichar.' });
    } finally { setEnviando(null); }
  }

  const { estado, ultimo } = estadoDe(evs ?? []);
  const hora = (e: Evento | null) =>
    e ? new Date(e.momento_cliente ?? e.momento_servidor).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';

  const insignia = estado === 'DENTRO'
    ? <Etiqueta tono="exito">Jornada iniciada</Etiqueta>
    : estado === 'PAUSA'
      ? <Etiqueta tono="aviso">En pausa</Etiqueta>
      : <Etiqueta>Fuera de jornada</Etiqueta>;

  // Acción principal según el estado; el resto quedan como secundarias.
  const principal: TipoFichaje = estado === 'FUERA' ? 'ENTRADA' : estado === 'PAUSA' ? 'FIN_PAUSA' : 'SALIDA';
  const secundarias: TipoFichaje[] = estado === 'DENTRO' ? ['INICIO_PAUSA'] : [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {insignia}
        <span className="text-sm text-apagado">
          {ultimo ? `Último movimiento: ${ETIQUETA_FICHAJE[ultimo.tipo]} · ${hora(ultimo)}` : 'Sin fichajes hoy'}
        </span>
      </div>

      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}

      <div className="flex flex-wrap gap-3" role="group" aria-label="Acciones de fichaje">
        <button onClick={() => fichar(principal)} disabled={enviando !== null}
          className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-bold bg-marca-600 text-white hover:bg-marca-700 disabled:bg-linea disabled:text-apagado disabled:shadow-none transition shadow-sm">
          {enviando === principal ? 'Registrando…' : ETIQUETA_FICHAJE[principal]}
        </button>
        {secundarias.map((t) => (
          <button key={t} onClick={() => fichar(t)} disabled={enviando !== null}
            className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold bg-white text-marca-700 border border-linea hover:border-marca-300 hover:bg-marca-50 disabled:bg-linea disabled:text-apagado transition">
            {enviando === t ? 'Registrando…' : ETIQUETA_FICHAJE[t]}
          </button>
        ))}
      </div>
      <p className="text-xs text-tenue mt-3">
        La hora oficial es la del servidor. Los registros son inmutables: una corrección se anota como
        evento nuevo, sin borrar el original.
      </p>
    </div>
  );
}
