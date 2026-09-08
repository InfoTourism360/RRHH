import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { Alerta, Boton, Campo, Cargando, Selector, Tarjeta } from '../ui';

interface Tipo { id: string; codigo: string; denominacion: string; unidad_computo: string }
interface Saldo { tipo: string; denominacion: string; asignado: number; consumido: number; disponible: number }
interface Solicitud { id: string; tipo: string; fecha_inicio: string; fecha_fin: string; dias_computados: string; estado: string; motivo_resolucion: string | null }

const ESTADO_TXT: Record<string, string> = {
  SOLICITADA: 'Pendiente', APROBADA: 'Aprobada', DENEGADA: 'Denegada', CANCELADA: 'Cancelada',
};

export function MisAusencias() {
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[] | null>(null);
  const [tipoCodigo, setTipoCodigo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    const [t, s, mis] = await Promise.all([
      api.get<Tipo[]>('/ausencias/tipos'),
      api.get<Saldo[]>('/ausencias/saldos'),
      api.get<Solicitud[]>('/ausencias/solicitudes/mias'),
    ]);
    setTipos(t); setSaldos(s); setSolicitudes(mis);
    if (!tipoCodigo && t[0]) setTipoCodigo(t[0].codigo);
  }, [tipoCodigo]);

  useEffect(() => { cargar().catch(() => setMsg({ tipo: 'error', texto: 'No se pudieron cargar los datos.' })); }, [cargar]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post('/ausencias/solicitudes', {
        tipoCodigo, fechaInicio: inicio, fechaFin: fin, observaciones: obs || null,
      });
      setMsg({ tipo: 'exito', texto: 'Solicitud enviada. Recibirás la resolución por notificación.' });
      setInicio(''); setFin(''); setObs('');
      await cargar();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud.' });
    }
  }

  async function cancelar(id: string) {
    try { await api.post(`/ausencias/solicitudes/${id}/cancelar`); await cargar(); }
    catch (err) { setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo cancelar.' }); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mis ausencias</h1>
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Solicitar ausencia">
          <form onSubmit={enviar} noValidate>
            <Selector etiqueta="Tipo de ausencia" value={tipoCodigo} onChange={(e) => setTipoCodigo(e.target.value)} required>
              {tipos.map((t) => <option key={t.id} value={t.codigo}>{t.denominacion}</option>)}
            </Selector>
            <Campo etiqueta="Fecha de inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
            <Campo etiqueta="Fecha de fin" type="date" value={fin} onChange={(e) => setFin(e.target.value)} required />
            <Campo etiqueta="Observaciones (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
            <Boton type="submit">Enviar solicitud</Boton>
          </form>
        </Tarjeta>

        <Tarjeta titulo="Mis saldos del año">
          <ul className="space-y-2">
            {saldos.map((s) => (
              <li key={s.tipo}>
                <div className="flex justify-between font-medium"><span>{s.denominacion}</span><span>{s.disponible} disponibles</span></div>
                <div className="text-sm text-gray-600">Asignados {s.asignado} · consumidos {s.consumido}</div>
              </li>
            ))}
            {saldos.length === 0 && <li className="text-gray-600">Sin saldos con cómputo anual.</li>}
          </ul>
        </Tarjeta>
      </div>

      <div className="mt-6">
        <Tarjeta titulo="Mis solicitudes">
          {!solicitudes ? <Cargando /> : solicitudes.length === 0 ? (
            <p className="text-gray-600">No tienes solicitudes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th scope="col" className="py-2 pr-4">Tipo</th>
                    <th scope="col" className="py-2 pr-4">Periodo</th>
                    <th scope="col" className="py-2 pr-4">Días</th>
                    <th scope="col" className="py-2 pr-4">Estado</th>
                    <th scope="col" className="py-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map((s) => (
                    <tr key={s.id} className="border-b border-gray-200">
                      <td className="py-2 pr-4">{s.tipo}</td>
                      <td className="py-2 pr-4">{s.fecha_inicio} → {s.fecha_fin}</td>
                      <td className="py-2 pr-4">{s.dias_computados}</td>
                      <td className="py-2 pr-4">
                        {ESTADO_TXT[s.estado]}
                        {s.estado === 'DENEGADA' && s.motivo_resolucion ? ` — ${s.motivo_resolucion}` : ''}
                      </td>
                      <td className="py-2">
                        {['SOLICITADA', 'APROBADA'].includes(s.estado) && (
                          <button onClick={() => cancelar(s.id)} className="underline text-error">Cancelar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
