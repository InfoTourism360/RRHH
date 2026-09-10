import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, descargar, ApiError } from '../api';
import {
  Alerta, Boton, Campo, Cargando, Etiqueta, Modal, Selector, Tabla, Tarjeta, minAHoras, type Columna,
} from '../ui';
import { ETIQUETA_FICHAJE } from '../FicharWidget';

interface Persona { id: string; nombre: string; apellido1: string; apellido2: string | null; num_documento: string }
interface Evento {
  id: string; tipo: string; origen: string; momento_servidor: string; momento_cliente: string | null;
  accion_correccion: string | null; motivo: string | null;
}
interface Dia { fecha: string; trabajadoMin: number; teoricoMin: number; saldoMin: number; esFestivo: boolean; esAusencia: boolean; extrasMin: number; festivoMin: number }
interface Total { dias: Dia[]; totales: { trabajadoMin: number; teoricoMin: number; saldoMin: number; extrasMin: number; festivoMin: number } }

function mesPorDefecto() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function rangoDeMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(a!, m!, 0).getDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

type Accion = 'MODIFICA' | 'ANULA' | 'ANADE';

export function GesHorario() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [mes, setMes] = useState(mesPorDefecto());
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [total, setTotal] = useState<Total | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  // Estado del formulario de corrección.
  const [corr, setCorr] = useState<{ accion: Accion; original: Evento | null } | null>(null);
  const [cTipo, setCTipo] = useState('ENTRADA');
  const [cMomento, setCMomento] = useState('');
  const [cMotivo, setCMotivo] = useState('');

  const { desde, hasta } = rangoDeMes(mes);

  useEffect(() => {
    api.get<Persona[]>('/estructura/personas')
      .then((p) => { setPersonas(p); setPersonaId((prev) => prev || p[0]?.id || ''); })
      .catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    if (!personaId) return;
    setEventos(null); setTotal(null);
    const q = `desde=${desde}&hasta=${hasta}&personaId=${personaId}`;
    try { setEventos(await api.get<Evento[]>(`/horario/fichajes?${q}`)); } catch { setEventos([]); }
    try { setTotal(await api.get<Total>(`/horario/totalizacion?${q}`)); } catch { setTotal(null); }
  }, [personaId, desde, hasta]);
  useEffect(() => { void cargar(); }, [cargar]);

  function abrirCorreccion(accion: Accion, original: Evento | null) {
    setMsg(null);
    setCorr({ accion, original });
    setCTipo(original?.tipo ?? 'ENTRADA');
    setCMomento(
      original
        ? new Date(original.momento_cliente ?? original.momento_servidor).toISOString().slice(0, 16)
        : `${desde}T09:00`,
    );
    setCMotivo('');
  }

  async function enviarCorreccion(e: FormEvent) {
    e.preventDefault();
    if (!corr) return;
    try {
      await api.post('/horario/correcciones', {
        accion: corr.accion,
        corrigeEventoId: corr.original?.id ?? null,
        personaId: corr.accion === 'ANADE' ? personaId : null,
        tipo: corr.accion === 'ANULA' ? null : cTipo,
        momentoCliente: corr.accion === 'ANULA' ? null : new Date(cMomento).toISOString(),
        motivo: cMotivo,
      });
      setMsg({ tipo: 'exito', texto: 'Corrección registrada. El original se conserva y se ha avisado al empleado.' });
      setCorr(null);
      await cargar();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo registrar la corrección.' });
    }
  }

  const colsEventos: Columna<Evento>[] = [
    { k: 'm', txt: 'Momento', render: (e) => new Date(e.momento_cliente ?? e.momento_servidor).toLocaleString('es-ES') },
    { k: 'tipo', txt: 'Tipo', render: (e) => ETIQUETA_FICHAJE[e.tipo] ?? e.tipo },
    {
      k: 'origen', txt: 'Origen',
      render: (e) => e.origen === 'CORRECCION'
        ? <Etiqueta tono="aviso">Corrección · {e.accion_correccion}</Etiqueta>
        : <Etiqueta>{e.origen}</Etiqueta>,
    },
    { k: 'motivo', txt: 'Motivo', render: (e) => e.motivo ?? '' },
    {
      k: 'acc', txt: '', alinear: 'der',
      render: (e) => e.origen === 'CORRECCION' ? null : (
        <div className="flex gap-2 justify-end">
          <button onClick={() => abrirCorreccion('MODIFICA', e)} className="text-sm font-semibold text-marca-700 underline">Corregir</button>
          <button onClick={() => abrirCorreccion('ANULA', e)} className="text-sm font-semibold text-error underline">Anular</button>
        </div>
      ),
    },
  ];

  const colsDias: Columna<Dia>[] = [
    { k: 'fecha', txt: 'Fecha' },
    { k: 't', txt: 'Trabajado', alinear: 'der', render: (d) => minAHoras(d.trabajadoMin) },
    { k: 'te', txt: 'Teórico', alinear: 'der', render: (d) => minAHoras(d.teoricoMin) },
    {
      k: 's', txt: 'Saldo', alinear: 'der',
      render: (d) => <span className={d.saldoMin < 0 ? 'text-error' : d.saldoMin > 0 ? 'text-exito' : ''}>{minAHoras(d.saldoMin)}</span>,
    },
    {
      k: 'o', txt: 'Observaciones',
      render: (d) => d.esAusencia ? <Etiqueta tono="marca">Ausencia</Etiqueta>
        : d.esFestivo ? <Etiqueta tono="aviso">Festivo</Etiqueta>
        : d.extrasMin > 0 ? <Etiqueta tono="exito">+{minAHoras(d.extrasMin)} extra</Etiqueta> : '',
    },
  ];

  return (
    <div>
      <h1 className="text-[26px] font-extrabold mb-1">Control horario</h1>
      <p className="text-apagado mb-6">Jornada por empleado, correcciones trazadas e informes con hash de integridad.</p>
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}

      <Tarjeta>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-4 items-end">
          <Selector etiqueta="Empleado/a" value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} {p.apellido1} {p.apellido2 ?? ''} · {p.num_documento}</option>
            ))}
          </Selector>
          <div className="mb-4">
            <label htmlFor="mesg" className="block text-sm font-semibold mb-1.5">Periodo</label>
            <input id="mesg" type="month" value={mes} onChange={(e) => setMes(e.target.value)}
                   className="w-full rounded-lg border border-linea bg-white px-3.5 py-2.5 focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none" />
          </div>
          <div className="mb-4 flex gap-2">
            <Boton variante="secundario"
              onClick={() => descargar(`/horario/informe.pdf?desde=${desde}&hasta=${hasta}&personaId=${personaId}`, `jornada_${mes}.pdf`)}>
              Informe PDF
            </Boton>
            <Boton variante="secundario"
              onClick={() => descargar(`/horario/informe.csv?desde=${desde}&hasta=${hasta}&personaId=${personaId}`, `jornada_${mes}.csv`)}>
              CSV
            </Boton>
          </div>
          <div className="mb-4">
            <Boton onClick={() => abrirCorreccion('ANADE', null)}>+ Añadir fichaje omitido</Boton>
          </div>
        </div>
      </Tarjeta>

      {total && (
        <section aria-label="Resumen del periodo" className="grid gap-3 grid-cols-2 lg:grid-cols-5 my-4">
          {[
            ['Trabajado', minAHoras(total.totales.trabajadoMin)],
            ['Teórico', minAHoras(total.totales.teoricoMin)],
            ['Saldo', minAHoras(total.totales.saldoMin)],
            ['Extras', minAHoras(total.totales.extrasMin)],
            ['En festivo', minAHoras(total.totales.festivoMin)],
          ].map(([t, v]) => (
            <div key={t} className="bg-white rounded-xl2 border border-linea shadow-tarjeta p-4">
              <div className="text-xs font-semibold text-apagado uppercase tracking-wide">{t}</div>
              <div className="num text-2xl font-bold mt-2">{v}</div>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-4">
        <Tarjeta titulo="Resumen por día">
          {!total ? <Cargando /> : <Tabla columnas={colsDias} filas={total.dias} vacio="Sin jornada en el periodo." />}
        </Tarjeta>
        <Tarjeta titulo="Movimientos (el original nunca se borra)">
          {!eventos ? <Cargando /> : <Tabla columnas={colsEventos} filas={eventos} vacio="Sin fichajes en el periodo." />}
        </Tarjeta>
      </div>

      {corr && (
        <Modal
          titulo={corr.accion === 'ANADE' ? 'Añadir fichaje omitido'
            : corr.accion === 'ANULA' ? 'Anular fichaje' : 'Corregir fichaje'}
          onCerrar={() => setCorr(null)}>
          <form onSubmit={enviarCorreccion} noValidate>
            {corr.original && (
              <div className="mb-4 rounded-lg bg-lienzo border border-linea p-3 text-sm">
                <div className="text-apagado text-xs uppercase font-semibold tracking-wide mb-1">Registro original</div>
                {ETIQUETA_FICHAJE[corr.original.tipo]} ·{' '}
                <span className="num">{new Date(corr.original.momento_servidor).toLocaleString('es-ES')}</span>
                <p className="text-xs text-tenue mt-1">Se conserva íntegro; la corrección se anota como evento nuevo.</p>
              </div>
            )}
            {corr.accion !== 'ANULA' && (
              <>
                <Selector etiqueta="Tipo de movimiento" value={cTipo} onChange={(e) => setCTipo(e.target.value)}>
                  {Object.entries(ETIQUETA_FICHAJE).map(([c, t]) => <option key={c} value={c}>{t}</option>)}
                </Selector>
                <div className="mb-4">
                  <label htmlFor="cm" className="block text-sm font-semibold mb-1.5">Momento corregido</label>
                  <input id="cm" type="datetime-local" value={cMomento} onChange={(e) => setCMomento(e.target.value)} required
                         className="w-full rounded-lg border border-linea bg-white px-3.5 py-2.5 focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none" />
                </div>
              </>
            )}
            <Campo etiqueta="Motivo de la corrección" value={cMotivo} onChange={(e) => setCMotivo(e.target.value)}
                   ayuda="Obligatorio. Queda firmado con tu usuario y se notifica al empleado." required />
            <div className="flex justify-end gap-2 mt-2">
              <Boton variante="secundario" type="button" onClick={() => setCorr(null)}>Cancelar</Boton>
              <Boton type="submit" disabled={cMotivo.trim().length < 3}>Registrar corrección</Boton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
