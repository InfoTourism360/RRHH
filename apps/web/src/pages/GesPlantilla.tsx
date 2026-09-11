import { useEffect, useState, useCallback, type FormEvent, type ReactNode } from 'react';
import { api, ApiError } from '../api';
import {
  Alerta, Boton, Campo, Selector, Tarjeta, Tabla, Modal, Etiqueta, Buscador, filtrar,
  CabeceraPagina, Cargando, type Columna,
} from '../ui';
import {
  GRUPOS, ESCALAS, TIPOS_RELACION, SITUACIONES, FORMAS_PROVISION, JORNADAS, TIPOS_DOCUMENTO_ID, etiqueta,
} from '../catalogos';

type Fila = Record<string, unknown>;
function useLista<T = Fila>(ruta: string): [T[], () => Promise<void>, boolean] {
  const [datos, setDatos] = useState<T[]>([]);
  // `cargando` evita el parpadeo de "sin datos" mientras llega la respuesta.
  const [cargando, setCargando] = useState(true);
  const cargar = useCallback(async () => {
    setCargando(true);
    try { setDatos(await api.get<T[]>(ruta)); } catch { setDatos([]); } finally { setCargando(false); }
  }, [ruta]);
  useEffect(() => { void cargar(); }, [cargar]);
  return [datos, cargar, cargando];
}

const TABS = [
  ['personas', 'Personas'], ['unidades', 'Unidades'], ['plazas', 'Plazas'],
  ['puestos', 'Puestos (RPT)'], ['relaciones', 'Ocupación'],
] as const;

export function GesPlantilla() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('personas');
  return (
    <div>
      <CabeceraPagina titulo="Plantilla y RPT" descripcion="Estructura organizativa: personas, unidades, plazas, puestos y su ocupación." />

      <div role="tablist" aria-label="Secciones de plantilla" className="flex flex-wrap gap-1 mb-5 border-b border-linea">
        {TABS.map(([k, t]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === k ? 'border-marca-600 text-marca-700' : 'border-transparent text-apagado hover:text-tinta'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'personas' && <SecPersonas />}
      {tab === 'unidades' && <SecUnidades />}
      {tab === 'plazas' && <SecPlazas />}
      {tab === 'puestos' && <SecPuestos />}
      {tab === 'relaciones' && <SecRelaciones />}
    </div>
  );
}

// Cabecera de sección con botón de alta.
function Cab({ titulo, onNuevo, children }: { titulo: string; onNuevo: () => void; children: ReactNode }) {
  return (
    <Tarjeta titulo={titulo} accion={<Boton onClick={onNuevo}>+ Nuevo</Boton>}>{children}</Tarjeta>
  );
}
function Aviso({ m }: { m: { tipo: 'exito' | 'error'; texto: string } | null }) {
  return m ? <div className="mb-4"><Alerta tipo={m.tipo}>{m.texto}</Alerta></div> : null;
}

// --------------------------------- PERSONAS ---------------------------------
function SecPersonas() {
  const [filas, recargar, cargando] = useLista('/estructura/personas');
  const [abrir, setAbrir] = useState(false);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [f, setF] = useState({ tipoDocumento: 'DNI', numDocumento: '', nombre: '', apellido1: '', apellido2: '', emailCorp: '', telefono: '' });
  const visibles = filtrar(filas, ['nombre', 'apellido1', 'apellido2', 'num_documento', 'email_corp'], q);

  async function crear(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/estructura/personas', {
        ...f, apellido2: f.apellido2 || null, emailCorp: f.emailCorp || null, telefono: f.telefono || null,
      });
      setMsg({ tipo: 'exito', texto: 'Persona creada.' }); setAbrir(false);
      setF({ tipoDocumento: 'DNI', numDocumento: '', nombre: '', apellido1: '', apellido2: '', emailCorp: '', telefono: '' });
      await recargar();
    } catch (err) { setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'Error.' }); }
  }
  const cols: Columna<Fila>[] = [
    { k: 'nombre', txt: 'Nombre', render: (r) => `${r.nombre} ${r.apellido1} ${r.apellido2 ?? ''}` },
    { k: 'doc', txt: 'Documento', render: (r) => `${r.tipo_documento} ${r.num_documento}` },
    { k: 'email_corp', txt: 'Correo' },
    { k: 'telefono', txt: 'Teléfono' },
  ];
  return (
    <>
      <Aviso m={msg} />
      <Cab titulo={`Personas (${visibles.length}${q ? ` de ${filas.length}` : ''})`} onNuevo={() => setAbrir(true)}>
        <Buscador valor={q} onCambio={setQ} placeholder="Buscar por nombre, apellidos o documento…" />
        {cargando ? <Cargando /> : <Tabla columnas={cols} filas={visibles} vacio="Ninguna persona coincide con la búsqueda." />}
      </Cab>
      {abrir && (
        <Modal titulo="Nueva persona" onCerrar={() => setAbrir(false)}>
          <form onSubmit={crear} noValidate>
            <div className="grid grid-cols-2 gap-x-4">
              <Selector etiqueta="Tipo doc." value={f.tipoDocumento} onChange={(e) => setF({ ...f, tipoDocumento: e.target.value })}>
                {TIPOS_DOCUMENTO_ID.map(([c, t]) => <option key={c} value={c}>{t}</option>)}
              </Selector>
              <Campo etiqueta="Nº documento" value={f.numDocumento} onChange={(e) => setF({ ...f, numDocumento: e.target.value })} required />
              <Campo etiqueta="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required />
              <Campo etiqueta="Primer apellido" value={f.apellido1} onChange={(e) => setF({ ...f, apellido1: e.target.value })} required />
              <Campo etiqueta="Segundo apellido" value={f.apellido2} onChange={(e) => setF({ ...f, apellido2: e.target.value })} />
              <Campo etiqueta="Teléfono" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
            </div>
            <Campo etiqueta="Correo corporativo" type="email" value={f.emailCorp} onChange={(e) => setF({ ...f, emailCorp: e.target.value })} />
            <div className="flex justify-end gap-2 mt-2"><Boton variante="secundario" type="button" onClick={() => setAbrir(false)}>Cancelar</Boton><Boton type="submit">Crear</Boton></div>
          </form>
        </Modal>
      )}
    </>
  );
}

// --------------------------------- UNIDADES ---------------------------------
function SecUnidades() {
  const [filas, recargar, cargando] = useLista('/estructura/unidades');
  const [abrir, setAbrir] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [f, setF] = useState({ codigo: '', denominacion: '' });
  async function crear(e: FormEvent) {
    e.preventDefault();
    try { await api.post('/estructura/unidades', f); setMsg({ tipo: 'exito', texto: 'Unidad creada.' }); setAbrir(false); setF({ codigo: '', denominacion: '' }); await recargar(); }
    catch (err) { setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'Error.' }); }
  }
  return (
    <>
      <Aviso m={msg} />
      <Cab titulo={`Unidades orgánicas (${filas.length})`} onNuevo={() => setAbrir(true)}>
        {cargando ? <Cargando /> : <Tabla columnas={[{ k: 'codigo', txt: 'Código' }, { k: 'denominacion', txt: 'Denominación' }]} filas={filas} />}
      </Cab>
      {abrir && (
        <Modal titulo="Nueva unidad" onCerrar={() => setAbrir(false)}>
          <form onSubmit={crear} noValidate>
            <Campo etiqueta="Código" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} required />
            <Campo etiqueta="Denominación" value={f.denominacion} onChange={(e) => setF({ ...f, denominacion: e.target.value })} required />
            <div className="flex justify-end gap-2 mt-2"><Boton variante="secundario" type="button" onClick={() => setAbrir(false)}>Cancelar</Boton><Boton type="submit">Crear</Boton></div>
          </form>
        </Modal>
      )}
    </>
  );
}

// --------------------------------- PLAZAS -----------------------------------
function SecPlazas() {
  const [filas, recargar, cargando] = useLista('/estructura/plazas');
  const [abrir, setAbrir] = useState(false);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [f, setF] = useState({ codigo: '', denominacion: '', grupoCodigo: 'C1', escalaCodigo: 'GENERAL', dotacion: 1 });
  const visibles = filtrar(filas, ['codigo', 'denominacion', 'grupo_codigo'], q);
  async function crear(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/estructura/plazas', { ...f, dotacion: Number(f.dotacion), escalaCodigo: f.escalaCodigo || null });
      setMsg({ tipo: 'exito', texto: 'Plaza creada.' }); setAbrir(false);
      setF({ codigo: '', denominacion: '', grupoCodigo: 'C1', escalaCodigo: 'GENERAL', dotacion: 1 }); await recargar();
    } catch (err) { setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'Error.' }); }
  }
  const cols: Columna<Fila>[] = [
    { k: 'codigo', txt: 'Código' }, { k: 'denominacion', txt: 'Denominación' },
    { k: 'grupo_codigo', txt: 'Grupo' },
    { k: 'estado', txt: 'Estado', render: (r) => r.vacante ? <Etiqueta tono="aviso">Vacante</Etiqueta> : <Etiqueta tono="exito">Ocupada</Etiqueta> },
  ];
  return (
    <>
      <Aviso m={msg} />
      <Cab titulo={`Plazas (${visibles.length}${q ? ` de ${filas.length}` : ''})`} onNuevo={() => setAbrir(true)}>
        <Buscador valor={q} onCambio={setQ} placeholder="Buscar por código, denominación o grupo…" />
        {cargando ? <Cargando /> : <Tabla columnas={cols} filas={visibles} vacio="Ninguna plaza coincide con la búsqueda." />}
      </Cab>
      {abrir && (
        <Modal titulo="Nueva plaza" onCerrar={() => setAbrir(false)}>
          <form onSubmit={crear} noValidate>
            <div className="grid grid-cols-2 gap-x-4">
              <Campo etiqueta="Código" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} required />
              <Campo etiqueta="Dotación" type="number" min={0} value={f.dotacion} onChange={(e) => setF({ ...f, dotacion: Number(e.target.value) })} />
              <Selector etiqueta="Grupo" value={f.grupoCodigo} onChange={(e) => setF({ ...f, grupoCodigo: e.target.value })}>
                {GRUPOS.map(([c, t]) => <option key={c} value={c}>{t}</option>)}
              </Selector>
              <Selector etiqueta="Escala" value={f.escalaCodigo} onChange={(e) => setF({ ...f, escalaCodigo: e.target.value })}>
                <option value="">(laboral / sin escala)</option>
                {ESCALAS.map(([c, t]) => <option key={c} value={c}>{t}</option>)}
              </Selector>
            </div>
            <Campo etiqueta="Denominación" value={f.denominacion} onChange={(e) => setF({ ...f, denominacion: e.target.value })} required />
            <div className="flex justify-end gap-2 mt-2"><Boton variante="secundario" type="button" onClick={() => setAbrir(false)}>Cancelar</Boton><Boton type="submit">Crear</Boton></div>
          </form>
        </Modal>
      )}
    </>
  );
}

// --------------------------------- PUESTOS ----------------------------------
function SecPuestos() {
  const [filas, recargar, cargando] = useLista('/estructura/puestos');
  const [plazas] = useLista<Fila>('/estructura/plazas');
  const [unidades] = useLista<Fila>('/estructura/unidades');
  const [abrir, setAbrir] = useState(false);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [f, setF] = useState({ plazaId: '', unidadId: '', codigo: '', denominacion: '', nivelCd: 16, formaProvision: 'CONCURSO', tipoJornada: 'COMPLETA' });
  const visibles = filtrar(filas, ['codigo', 'denominacion'], q);
  async function crear(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/estructura/puestos', { ...f, nivelCd: Number(f.nivelCd) });
      setMsg({ tipo: 'exito', texto: 'Puesto creado.' }); setAbrir(false);
      setF({ plazaId: '', unidadId: '', codigo: '', denominacion: '', nivelCd: 16, formaProvision: 'CONCURSO', tipoJornada: 'COMPLETA' }); await recargar();
    } catch (err) { setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'Error.' }); }
  }
  const cols: Columna<Fila>[] = [
    { k: 'codigo', txt: 'Código' }, { k: 'denominacion', txt: 'Denominación' },
    { k: 'nivel_cd', txt: 'Nivel CD', alinear: 'der' },
  ];
  return (
    <>
      <Aviso m={msg} />
      <Cab titulo={`Puestos de trabajo (${visibles.length}${q ? ` de ${filas.length}` : ''})`} onNuevo={() => setAbrir(true)}>
        <Buscador valor={q} onCambio={setQ} placeholder="Buscar por código o denominación…" />
        {cargando ? <Cargando /> : <Tabla columnas={cols} filas={visibles} vacio="Ningún puesto coincide con la búsqueda." />}
      </Cab>
      {abrir && (
        <Modal titulo="Nuevo puesto (RPT)" onCerrar={() => setAbrir(false)}>
          <form onSubmit={crear} noValidate>
            <Selector etiqueta="Plaza" value={f.plazaId} onChange={(e) => setF({ ...f, plazaId: e.target.value })} required>
              <option value="">— Selecciona plaza —</option>
              {plazas.map((p) => <option key={p.id as string} value={p.id as string}>{p.codigo as string} · {p.denominacion as string}</option>)}
            </Selector>
            <Selector etiqueta="Unidad orgánica" value={f.unidadId} onChange={(e) => setF({ ...f, unidadId: e.target.value })} required>
              <option value="">— Selecciona unidad —</option>
              {unidades.map((u) => <option key={u.id as string} value={u.id as string}>{u.denominacion as string}</option>)}
            </Selector>
            <div className="grid grid-cols-2 gap-x-4">
              <Campo etiqueta="Código" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} required />
              <Campo etiqueta="Nivel CD (1-30)" type="number" min={1} max={30} value={f.nivelCd} onChange={(e) => setF({ ...f, nivelCd: Number(e.target.value) })} required />
              <Selector etiqueta="Provisión" value={f.formaProvision} onChange={(e) => setF({ ...f, formaProvision: e.target.value })}>
                {FORMAS_PROVISION.map(([c, t]) => <option key={c} value={c}>{t}</option>)}
              </Selector>
              <Selector etiqueta="Jornada" value={f.tipoJornada} onChange={(e) => setF({ ...f, tipoJornada: e.target.value })}>
                {JORNADAS.map(([c, t]) => <option key={c} value={c}>{t}</option>)}
              </Selector>
            </div>
            <Campo etiqueta="Denominación" value={f.denominacion} onChange={(e) => setF({ ...f, denominacion: e.target.value })} required />
            <div className="flex justify-end gap-2 mt-2"><Boton variante="secundario" type="button" onClick={() => setAbrir(false)}>Cancelar</Boton><Boton type="submit">Crear</Boton></div>
          </form>
        </Modal>
      )}
    </>
  );
}

// -------------------------------- RELACIONES --------------------------------
function SecRelaciones() {
  const [filas, recargar, cargando] = useLista('/estructura/relaciones');
  const [personas] = useLista<Fila>('/estructura/personas');
  const [puestos] = useLista<Fila>('/estructura/puestos');
  const [abrir, setAbrir] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const hoy = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ personaId: '', puestoId: '', tipoCodigo: 'FUNC_CARRERA', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: hoy });

  async function crear(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/estructura/relaciones', f);
      setMsg({ tipo: 'exito', texto: 'Toma de posesión registrada.' }); setAbrir(false);
      setF({ personaId: '', puestoId: '', tipoCodigo: 'FUNC_CARRERA', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: hoy }); await recargar();
    } catch (err) { setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'Error.' }); }
  }
  const nombrePersona = (id: unknown) => { const p = personas.find((x) => x.id === id); return p ? `${p.nombre} ${p.apellido1}` : '—'; };
  const cols: Columna<Fila>[] = [
    { k: 'persona', txt: 'Persona', render: (r) => nombrePersona(r.persona_id) },
    { k: 'tipo_codigo', txt: 'Vínculo', render: (r) => etiqueta(TIPOS_RELACION, r.tipo_codigo as string) },
    { k: 'situacion_codigo', txt: 'Situación', render: (r) => etiqueta(SITUACIONES, r.situacion_codigo as string) },
    { k: 'toma_posesion', txt: 'Toma posesión' },
    { k: 'estado', txt: 'Estado', render: (r) => r.cese ? <Etiqueta>Cesada</Etiqueta> : <Etiqueta tono="exito">Vigente</Etiqueta> },
  ];
  return (
    <>
      <Aviso m={msg} />
      <Cab titulo={`Ocupación / relaciones de servicio (${filas.length})`} onNuevo={() => setAbrir(true)}>
        {cargando ? <Cargando /> : <Tabla columnas={cols} filas={filas} />}
      </Cab>
      {abrir && (
        <Modal titulo="Nueva toma de posesión" onCerrar={() => setAbrir(false)}>
          <form onSubmit={crear} noValidate>
            <Selector etiqueta="Persona" value={f.personaId} onChange={(e) => setF({ ...f, personaId: e.target.value })} required>
              <option value="">— Selecciona persona —</option>
              {personas.map((p) => <option key={p.id as string} value={p.id as string}>{p.nombre as string} {p.apellido1 as string} · {p.num_documento as string}</option>)}
            </Selector>
            <Selector etiqueta="Puesto" value={f.puestoId} onChange={(e) => setF({ ...f, puestoId: e.target.value })} required>
              <option value="">— Selecciona puesto —</option>
              {puestos.map((p) => <option key={p.id as string} value={p.id as string}>{p.codigo as string} · {p.denominacion as string}</option>)}
            </Selector>
            <div className="grid grid-cols-2 gap-x-4">
              <Selector etiqueta="Vínculo" value={f.tipoCodigo} onChange={(e) => setF({ ...f, tipoCodigo: e.target.value })}>
                {TIPOS_RELACION.map(([c, t]) => <option key={c} value={c}>{t}</option>)}
              </Selector>
              <Selector etiqueta="Situación" value={f.situacionCodigo} onChange={(e) => setF({ ...f, situacionCodigo: e.target.value })}>
                {SITUACIONES.map(([c, t]) => <option key={c} value={c}>{t}</option>)}
              </Selector>
            </div>
            <Campo etiqueta="Fecha de toma de posesión" type="date" value={f.tomaPosesion} onChange={(e) => setF({ ...f, tomaPosesion: e.target.value })} required />
            <div className="flex justify-end gap-2 mt-2"><Boton variante="secundario" type="button" onClick={() => setAbrir(false)}>Cancelar</Boton><Boton type="submit">Registrar</Boton></div>
          </form>
        </Modal>
      )}
    </>
  );
}
