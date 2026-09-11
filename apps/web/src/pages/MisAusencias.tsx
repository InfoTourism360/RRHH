import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { Alerta, Boton, Campo, Cargando, Selector, Tarjeta, Tabla, Etiqueta, type Columna, CabeceraPagina, BarraSaldo } from '../ui';

interface Tipo { id: string; codigo: string; denominacion: string; unidad_computo: string; requiere_justificante: boolean; base_normativa: string | null }
interface Saldo { tipo: string; denominacion: string; asignado: number; consumido: number; disponible: number }
interface Solicitud { id: string; tipo: string; fecha_inicio: string; fecha_fin: string; dias_computados: string; estado: string; motivo_resolucion: string | null }

const ESTADO: Record<string, { txt: string; tono: 'marca' | 'exito' | 'error' | 'neutro' }> = {
  SOLICITADA: { txt: 'Pendiente', tono: 'marca' },
  APROBADA: { txt: 'Aprobada', tono: 'exito' },
  DENEGADA: { txt: 'Denegada', tono: 'error' },
  CANCELADA: { txt: 'Cancelada', tono: 'neutro' },
};
const UNIDAD: Record<string, string> = {
  DIAS_HABILES: 'días hábiles', DIAS_NATURALES: 'días naturales', HORAS: 'horas',
};

export function MisAusencias() {
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[] | null>(null);
  const [tipoCodigo, setTipoCodigo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [horas, setHoras] = useState('');
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    const [t, s, mis] = await Promise.all([
      api.get<Tipo[]>('/ausencias/tipos'),
      api.get<Saldo[]>('/ausencias/saldos'),
      api.get<Solicitud[]>('/ausencias/solicitudes/mias'),
    ]);
    setTipos(t); setSaldos(s); setSolicitudes(mis);
    setTipoCodigo((prev) => prev || t[0]?.codigo || '');
  }, []);

  useEffect(() => { cargar().catch(() => setMsg({ tipo: 'error', texto: 'No se pudieron cargar los datos.' })); }, [cargar]);

  const tipoSel = tipos.find((t) => t.codigo === tipoCodigo);
  const esHoras = tipoSel?.unidad_computo === 'HORAS';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post('/ausencias/solicitudes', {
        tipoCodigo, fechaInicio: inicio, fechaFin: fin,
        horas: esHoras && horas ? Number(horas) : null,
        observaciones: obs || null,
      });
      setMsg({ tipo: 'exito', texto: 'Solicitud enviada. Recibirás un aviso con la resolución.' });
      setInicio(''); setFin(''); setHoras(''); setObs('');
      await cargar();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud.' });
    }
  }

  async function cancelar(id: string) {
    try { await api.post(`/ausencias/solicitudes/${id}/cancelar`); await cargar(); }
    catch (err) { setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo cancelar.' }); }
  }

  const cols: Columna<Solicitud>[] = [
    { k: 'tipo', txt: 'Tipo' },
    { k: 'periodo', txt: 'Periodo', render: (s) => `${s.fecha_inicio} → ${s.fecha_fin}` },
    { k: 'dias_computados', txt: 'Cómputo', alinear: 'der' },
    {
      k: 'estado', txt: 'Estado',
      render: (s) => (
        <span className="inline-flex flex-col gap-1 items-start">
          <Etiqueta tono={ESTADO[s.estado]?.tono ?? 'neutro'}>{ESTADO[s.estado]?.txt ?? s.estado}</Etiqueta>
          {s.estado === 'DENEGADA' && s.motivo_resolucion && (
            <span className="text-xs text-apagado">{s.motivo_resolucion}</span>
          )}
        </span>
      ),
    },
    {
      k: 'acc', txt: '', alinear: 'der',
      render: (s) => ['SOLICITADA', 'APROBADA'].includes(s.estado)
        ? <button onClick={() => cancelar(s.id)} className="text-sm font-semibold text-error underline">Cancelar</button>
        : null,
    },
  ];

  return (
    <div>
      <CabeceraPagina titulo="Mis ausencias" descripcion="Solicita vacaciones y permisos y consulta tu saldo." />
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Solicitar ausencia">
          <form onSubmit={enviar} noValidate>
            <Selector etiqueta="Tipo de ausencia" value={tipoCodigo} onChange={(e) => setTipoCodigo(e.target.value)} required>
              {tipos.map((t) => <option key={t.id} value={t.codigo}>{t.denominacion}</option>)}
            </Selector>
            {tipoSel && (
              <p className="-mt-2 mb-4 text-sm text-apagado">
                Se computa en <strong>{UNIDAD[tipoSel.unidad_computo] ?? tipoSel.unidad_computo}</strong>
                {tipoSel.requiere_justificante && ' · requiere justificante'}
                {tipoSel.base_normativa && ` · ${tipoSel.base_normativa}`}
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Campo etiqueta="Desde" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
              <Campo etiqueta="Hasta" type="date" value={fin} onChange={(e) => setFin(e.target.value)} required />
            </div>
            {esHoras && (
              <Campo etiqueta="Horas" type="number" min={0} step={0.5} value={horas}
                     onChange={(e) => setHoras(e.target.value)} ayuda="Este permiso se computa por horas." />
            )}
            <Campo etiqueta="Observaciones (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
            <Boton type="submit">Enviar solicitud</Boton>
          </form>
        </Tarjeta>

        <Tarjeta titulo="Mis saldos del año">
          {saldos.length === 0 ? <p className="text-apagado">Sin saldos con cómputo anual.</p> : (
            <ul className="space-y-4">
              {saldos.map((s) => (
                <BarraSaldo key={s.tipo} denominacion={s.denominacion}
                  asignado={s.asignado} consumido={s.consumido} disponible={s.disponible} />
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <div className="mt-4">
        <Tarjeta titulo="Mis solicitudes">
          {!solicitudes ? <Cargando /> : <Tabla columnas={cols} filas={solicitudes} vacio="No tienes solicitudes." />}
        </Tarjeta>
      </div>
    </div>
  );
}
