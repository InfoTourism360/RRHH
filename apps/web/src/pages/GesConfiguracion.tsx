import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import {
  Alerta, Boton, Campo, Cargando, Etiqueta, Modal, Selector, Tabla, Tarjeta, type Columna,
} from '../ui';

interface Tipo {
  id: string; codigo: string; denominacion: string; base_normativa: string | null;
  unidad_computo: string; devengo: string; consume_saldo: boolean;
  requiere_justificante: boolean; requiere_preaviso: boolean; dias_preaviso: number;
  aprobador: string; permite_solapamiento: boolean; activo: boolean;
}
interface Festivo { id: string; fecha: string; denominacion: string; ambito: string }
interface Persona { id: string; nombre: string; apellido1: string; num_documento: string }

const UNIDAD: Record<string, string> = { DIAS_HABILES: 'Días hábiles', DIAS_NATURALES: 'Días naturales', HORAS: 'Horas' };
const DEVENGO: Record<string, string> = { ANUAL: 'Anual', POR_HECHO: 'Por hecho causante' };
const APROBADOR: Record<string, string> = {
  RESPONSABLE_UNIDAD: 'Responsable de unidad', GESTOR_PERSONAL: 'Gestor de personal', AUTOMATICO: 'Automático',
};
const TABS = [['reglas', 'Motor de reglas'], ['calendario', 'Calendario laboral'], ['saldos', 'Saldos']] as const;

export function GesConfiguracion() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('reglas');
  return (
    <div>
      <h1 className="text-[26px] font-extrabold mb-1">Configuración</h1>
      <p className="text-apagado mb-5">
        Reglas de ausencias, calendario laboral y saldos. Se configuran <strong>sin tocar código</strong>:
        cada entidad adapta el catálogo a su acuerdo o convenio.
      </p>

      <div role="tablist" aria-label="Secciones de configuración" className="flex flex-wrap gap-1 mb-5 border-b border-linea">
        {TABS.map(([k, t]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === k ? 'border-marca-600 text-marca-700' : 'border-transparent text-apagado hover:text-tinta'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'reglas' && <SecReglas />}
      {tab === 'calendario' && <SecCalendario />}
      {tab === 'saldos' && <SecSaldos />}
    </div>
  );
}

// ------------------------------- MOTOR DE REGLAS -----------------------------
function SecReglas() {
  const [tipos, setTipos] = useState<Tipo[] | null>(null);
  const [edit, setEdit] = useState<Tipo | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [f, setF] = useState({
    denominacion: '', requiereJustificante: false, requierePreaviso: false,
    diasPreaviso: 0, aprobador: 'RESPONSABLE_UNIDAD', permiteSolapamiento: false, activo: true,
  });

  const cargar = useCallback(async () => {
    try { setTipos(await api.get<Tipo[]>('/ausencias/tipos')); } catch { setTipos([]); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  function abrir(t: Tipo) {
    setEdit(t);
    setF({
      denominacion: t.denominacion, requiereJustificante: t.requiere_justificante,
      requierePreaviso: t.requiere_preaviso, diasPreaviso: t.dias_preaviso,
      aprobador: t.aprobador, permiteSolapamiento: t.permite_solapamiento, activo: t.activo,
    });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    try {
      await api.patch(`/ausencias/tipos/${edit.id}`, { ...f, diasPreaviso: Number(f.diasPreaviso) });
      setMsg({ tipo: 'exito', texto: 'Regla actualizada.' }); setEdit(null); await cargar();
    } catch (err) { setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'Error.' }); }
  }

  async function precargar() {
    try { await api.post('/ausencias/tipos/precargar'); setMsg({ tipo: 'exito', texto: 'Catálogo TREBEP precargado.' }); await cargar(); }
    catch (err) { setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'Error.' }); }
  }

  const cols: Columna<Tipo>[] = [
    {
      k: 'denominacion', txt: 'Tipo',
      render: (t) => (
        <div>
          <div className="font-semibold">{t.denominacion}</div>
          {t.base_normativa && <div className="text-xs text-tenue">{t.base_normativa}</div>}
        </div>
      ),
    },
    { k: 'unidad_computo', txt: 'Cómputo', render: (t) => UNIDAD[t.unidad_computo] ?? t.unidad_computo },
    { k: 'devengo', txt: 'Devengo', render: (t) => DEVENGO[t.devengo] ?? t.devengo },
    {
      k: 'reglas', txt: 'Reglas',
      render: (t) => (
        <div className="flex flex-wrap gap-1.5">
          {t.consume_saldo && <Etiqueta tono="marca">Consume saldo</Etiqueta>}
          {t.requiere_justificante && <Etiqueta tono="aviso">Justificante</Etiqueta>}
          {t.requiere_preaviso && <Etiqueta>Preaviso {t.dias_preaviso}d</Etiqueta>}
          {t.permite_solapamiento && <Etiqueta>Permite solape</Etiqueta>}
        </div>
      ),
    },
    { k: 'aprobador', txt: 'Aprueba', render: (t) => APROBADOR[t.aprobador] ?? t.aprobador },
    {
      k: 'acc', txt: '', alinear: 'der',
      render: (t) => <button onClick={() => abrir(t)} className="text-sm font-semibold text-marca-700 underline">Editar</button>,
    },
  ];

  return (
    <>
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}
      <Tarjeta
        titulo={`Tipos de ausencia (${tipos?.length ?? 0})`}
        accion={<Boton variante="secundario" onClick={precargar}>Precargar catálogo TREBEP</Boton>}>
        <p className="text-sm text-apagado mb-4">
          El catálogo es <strong>editable por la entidad</strong>: puedes cambiar quién aprueba, el
          preaviso, el justificante o desactivar un permiso, sin desarrollo a medida.
        </p>
        {!tipos ? <Cargando /> : <Tabla columnas={cols} filas={tipos} vacio="Sin tipos configurados." />}
      </Tarjeta>

      {edit && (
        <Modal titulo={`Regla: ${edit.codigo}`} onCerrar={() => setEdit(null)}>
          <form onSubmit={guardar} noValidate>
            <Campo etiqueta="Denominación" value={f.denominacion} onChange={(e) => setF({ ...f, denominacion: e.target.value })} required />
            <Selector etiqueta="Quién aprueba" value={f.aprobador} onChange={(e) => setF({ ...f, aprobador: e.target.value })}>
              {Object.entries(APROBADOR).map(([c, t]) => <option key={c} value={c}>{t}</option>)}
            </Selector>
            <div className="grid grid-cols-2 gap-x-4">
              <Campo etiqueta="Días de preaviso" type="number" min={0} max={90} value={f.diasPreaviso}
                     onChange={(e) => setF({ ...f, diasPreaviso: Number(e.target.value) })} />
            </div>
            <fieldset className="mb-4">
              <legend className="text-sm font-semibold mb-2">Condiciones</legend>
              {([
                ['requiereJustificante', 'Requiere justificante'],
                ['requierePreaviso', 'Requiere preaviso'],
                ['permiteSolapamiento', 'Permite solaparse con otras ausencias'],
                ['activo', 'Activo (disponible para solicitar)'],
              ] as const).map(([k, t]) => (
                <label key={k} className="flex items-center gap-2.5 py-1.5 text-sm">
                  <input type="checkbox" checked={f[k] as boolean}
                         onChange={(e) => setF({ ...f, [k]: e.target.checked })}
                         className="w-4 h-4 rounded border-linea text-marca-600 focus:ring-marca-500" />
                  {t}
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2">
              <Boton variante="secundario" type="button" onClick={() => setEdit(null)}>Cancelar</Boton>
              <Boton type="submit">Guardar</Boton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// ------------------------------ CALENDARIO LABORAL ---------------------------
function SecCalendario() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [festivos, setFestivos] = useState<Festivo[] | null>(null);
  const [abrir, setAbrir] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [f, setF] = useState({ fecha: '', denominacion: '', ambito: 'LOCAL' });

  const cargar = useCallback(async () => {
    try { setFestivos(await api.get<Festivo[]>(`/ausencias/festivos?anio=${anio}`)); } catch { setFestivos([]); }
  }, [anio]);
  useEffect(() => { void cargar(); }, [cargar]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/ausencias/festivos', f);
      setMsg({ tipo: 'exito', texto: 'Festivo añadido.' }); setAbrir(false);
      setF({ fecha: '', denominacion: '', ambito: 'LOCAL' }); await cargar();
    } catch (err) { setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'Error.' }); }
  }

  const locales = (festivos ?? []).filter((x) => x.ambito === 'LOCAL').length;
  const cols: Columna<Festivo>[] = [
    { k: 'fecha', txt: 'Fecha' },
    { k: 'denominacion', txt: 'Denominación' },
    { k: 'ambito', txt: 'Ámbito', render: (x) => <Etiqueta tono={x.ambito === 'LOCAL' ? 'aviso' : 'marca'}>{x.ambito}</Etiqueta> },
  ];

  return (
    <>
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}
      <Tarjeta
        titulo={`Festivos ${anio} (${festivos?.length ?? 0})`}
        accion={<Boton onClick={() => setAbrir(true)}>+ Añadir festivo</Boton>}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label htmlFor="anio" className="text-sm font-semibold">Año</label>
          <input id="anio" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))}
                 className="w-28 rounded-lg border border-linea bg-white px-3 py-2 num focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none" />
          <span className="text-sm text-apagado">
            Fiestas locales configuradas: <strong>{locales}</strong> (habitualmente 2 al año, varían por municipio).
          </span>
        </div>
        {!festivos ? <Cargando /> : <Tabla columnas={cols} filas={festivos} vacio="Sin festivos para este año." />}
      </Tarjeta>

      {abrir && (
        <Modal titulo="Nuevo festivo" onCerrar={() => setAbrir(false)}>
          <form onSubmit={crear} noValidate>
            <Campo etiqueta="Fecha" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
            <Campo etiqueta="Denominación" value={f.denominacion} onChange={(e) => setF({ ...f, denominacion: e.target.value })} required />
            <Selector etiqueta="Ámbito" value={f.ambito} onChange={(e) => setF({ ...f, ambito: e.target.value })}>
              <option value="NACIONAL">Nacional</option>
              <option value="AUTONOMICO">Autonómico</option>
              <option value="LOCAL">Local</option>
            </Selector>
            <div className="flex justify-end gap-2">
              <Boton variante="secundario" type="button" onClick={() => setAbrir(false)}>Cancelar</Boton>
              <Boton type="submit">Añadir</Boton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------- SALDOS -----------------------------------
function SecSaldos() {
  const anioActual = new Date().getFullYear();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [anio, setAnio] = useState(anioActual);
  const [saldos, setSaldos] = useState<{ tipo: string; denominacion: string; asignado: number; consumido: number; disponible: number }[]>([]);
  const [tipoCodigo, setTipoCodigo] = useState('');
  const [dias, setDias] = useState(22);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    api.get<Persona[]>('/estructura/personas').then((p) => { setPersonas(p); setPersonaId((v) => v || p[0]?.id || ''); }).catch(() => {});
    api.get<Tipo[]>('/ausencias/tipos').then((t) => {
      const conSaldo = t.filter((x) => x.consume_saldo);
      setTipos(conSaldo); setTipoCodigo((v) => v || conSaldo[0]?.codigo || '');
    }).catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    if (!personaId) return;
    try { setSaldos(await api.get(`/ausencias/saldos?personaId=${personaId}&anio=${anio}`)); } catch { setSaldos([]); }
  }, [personaId, anio]);
  useEffect(() => { void cargar(); }, [cargar]);

  async function asignar(e: FormEvent) {
    e.preventDefault();
    try {
      await api.put('/ausencias/saldos', { personaId, tipoCodigo, anio: Number(anio), dias: Number(dias) });
      setMsg({ tipo: 'exito', texto: 'Saldo asignado.' }); await cargar();
    } catch (err) { setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'Error.' }); }
  }

  return (
    <>
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Asignar saldo">
          <form onSubmit={asignar} noValidate>
            <Selector etiqueta="Empleado/a" value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido1} · {p.num_documento}</option>)}
            </Selector>
            <Selector etiqueta="Tipo" value={tipoCodigo} onChange={(e) => setTipoCodigo(e.target.value)}>
              {tipos.map((t) => <option key={t.id} value={t.codigo}>{t.denominacion}</option>)}
            </Selector>
            <div className="grid grid-cols-2 gap-x-4">
              <Campo etiqueta="Año" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
              <Campo etiqueta="Días asignados" type="number" min={0} step={0.5} value={dias}
                     onChange={(e) => setDias(Number(e.target.value))} />
            </div>
            <p className="-mt-2 mb-4 text-sm text-apagado">
              Vacaciones art. 50 TREBEP: 22 días hábiles, más los adicionales por antigüedad
              (23 a los 15 años, 24 a los 20, 25 a los 25 y 26 a los 30).
            </p>
            <Boton type="submit">Guardar saldo</Boton>
          </form>
        </Tarjeta>

        <Tarjeta titulo={`Saldos ${anio} de la persona seleccionada`}>
          {saldos.length === 0 ? <p className="text-apagado">Sin saldos asignados.</p> : (
            <ul className="space-y-4">
              {saldos.map((s) => {
                const pct = s.asignado > 0 ? Math.round((s.consumido / s.asignado) * 100) : 0;
                return (
                  <li key={s.tipo}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="font-semibold text-sm">{s.denominacion}</span>
                      <span className="num text-sm"><strong>{s.disponible}</strong> <span className="text-apagado">/ {s.asignado}</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-lienzo border border-linea overflow-hidden">
                      <div className="h-full bg-marca-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
