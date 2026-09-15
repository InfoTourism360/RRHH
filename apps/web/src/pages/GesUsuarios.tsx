import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import {
  Alerta, Boton, Campo, Cargando, Etiqueta, Modal, Tabla, Tarjeta, Selector,
  Buscador, filtrar, CabeceraPagina, type Columna,
} from '../ui';

/** Un rol, con la unidad a la que acota cuando el rol lo exige. */
interface Asignacion { rol: string; unidadId: string | null; unidad?: string | null }

interface Usuario {
  id: string; email: string; persona_id: string | null; activo: boolean;
  mfa_activo: boolean; tiene_pin: boolean; bloqueado_hasta: string | null;
  nombre: string | null; apellido1: string | null; apellido2: string | null; num_documento: string | null;
  roles: string[];
  asignaciones: Asignacion[];
}
interface Persona { id: string; nombre: string; apellido1: string; apellido2: string | null; num_documento: string }
interface Rol { codigo: string; denominacion: string }
interface Unidad { id: string; denominacion: string }

/** Roles que no mandan sobre nadie si no se les dice sobre qué unidad. */
const EXIGEN_UNIDAD = ['RESPONSABLE_UNIDAD'];
const faltaUnidad = (a: Asignacion[]) =>
  a.some((x) => EXIGEN_UNIDAD.includes(x.rol) && !x.unidadId);

type Dialogo =
  | { t: 'nuevo' }
  | { t: 'roles'; u: Usuario }
  | { t: 'password'; u: Usuario }
  | { t: 'pin'; u: Usuario }
  | { t: 'estado'; u: Usuario }
  | null;

const VACIO = {
  email: '', password: '', personaId: '',
  roles: [{ rol: 'EMPLEADO', unidadId: null }] as Asignacion[],
};

export function GesUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [q, setQ] = useState('');
  const [dlg, setDlg] = useState<Dialogo>(null);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  // Formularios
  const [nuevo, setNuevo] = useState(VACIO);
  const [rolesSel, setRolesSel] = useState<Asignacion[]>([]);
  const [pass, setPass] = useState('');
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');

  const cargar = useCallback(async () => {
    const [u, p, r, un] = await Promise.all([
      api.get<Usuario[]>('/admin/usuarios').catch(() => [] as Usuario[]),
      api.get<Persona[]>('/estructura/personas').catch(() => [] as Persona[]),
      api.get<Rol[]>('/admin/usuarios/roles').catch(() => [] as Rol[]),
      api.get<Unidad[]>('/estructura/unidades').catch(() => [] as Unidad[]),
    ]);
    setUsuarios(u); setPersonas(p); setRoles(r); setUnidades(un);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const conAcceso = new Set((usuarios ?? []).map((u) => u.persona_id).filter(Boolean));
  const sinAcceso = personas.filter((p) => !conAcceso.has(p.id));

  function fallo(err: unknown, alt: string) {
    setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : alt });
  }
  async function ok(texto: string) { setMsg({ tipo: 'exito', texto }); setDlg(null); await cargar(); }

  async function crear(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/admin/usuarios', {
        email: nuevo.email, password: nuevo.password,
        personaId: nuevo.personaId || null, roles: nuevo.roles,
      });
      setNuevo(VACIO);
      await ok('Usuario creado. Ya puede iniciar sesión.');
    } catch (err) { fallo(err, 'No se pudo crear el usuario.'); }
  }

  async function guardarRoles(e: FormEvent) {
    e.preventDefault();
    if (dlg?.t !== 'roles') return;
    try { await api.put(`/admin/usuarios/${dlg.u.id}/roles`, { roles: rolesSel }); await ok('Roles actualizados.'); }
    catch (err) { fallo(err, 'No se pudieron actualizar los roles.'); }
  }

  async function guardarPassword(e: FormEvent) {
    e.preventDefault();
    if (dlg?.t !== 'password') return;
    try {
      await api.put(`/admin/usuarios/${dlg.u.id}/password`, { password: pass });
      setPass('');
      await ok('Contraseña restablecida y cuenta desbloqueada.');
    } catch (err) { fallo(err, 'No se pudo restablecer la contraseña.'); }
  }

  async function guardarPin(e: FormEvent) {
    e.preventDefault();
    if (dlg?.t !== 'pin') return;
    try { await api.put(`/admin/usuarios/${dlg.u.id}/pin`, { pin }); setPin(''); await ok('PIN de quiosco establecido.'); }
    catch (err) { fallo(err, 'No se pudo establecer el PIN.'); }
  }

  async function guardarEstado(e: FormEvent) {
    e.preventDefault();
    if (dlg?.t !== 'estado') return;
    try {
      await api.patch(`/admin/usuarios/${dlg.u.id}/estado`, { activo: !dlg.u.activo, motivo });
      setMotivo('');
      await ok(dlg.u.activo ? 'Acceso desactivado.' : 'Acceso reactivado.');
    } catch (err) { fallo(err, 'No se pudo cambiar el estado.'); }
  }

  const visibles = filtrar(
    (usuarios ?? []).map((u) => ({ ...u, _busca: `${u.email} ${u.nombre ?? ''} ${u.apellido1 ?? ''} ${u.num_documento ?? ''}` })),
    ['_busca'], q,
  );

  const cols: Columna<Usuario>[] = [
    {
      k: 'email', txt: 'Acceso',
      render: (u) => (
        <div>
          <div className="font-semibold">{u.email}</div>
          <div className="text-xs text-tenue">
            {u.persona_id
              ? `${u.nombre} ${u.apellido1} ${u.apellido2 ?? ''} · ${u.num_documento}`
              : 'Sin ficha de personal vinculada'}
          </div>
        </div>
      ),
    },
    {
      k: 'roles', txt: 'Roles',
      render: (u) => (
        <div className="flex flex-wrap gap-1.5">
          {u.asignaciones.length === 0 ? <span className="text-tenue text-xs">sin roles</span>
            : u.asignaciones.map((a) => (
                <Etiqueta key={`${a.rol}-${a.unidadId ?? ''}`} tono="marca">
                  {a.unidad ? `${a.rol} · ${a.unidad}` : a.rol}
                </Etiqueta>
              ))}
        </div>
      ),
    },
    {
      k: 'estado', txt: 'Estado',
      render: (u) => (
        <div className="flex flex-wrap gap-1.5">
          {u.activo ? <Etiqueta tono="exito">Activo</Etiqueta> : <Etiqueta tono="error">Desactivado</Etiqueta>}
          {u.tiene_pin && <Etiqueta>PIN</Etiqueta>}
          {u.mfa_activo && <Etiqueta tono="marca">MFA</Etiqueta>}
          {u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date() && <Etiqueta tono="aviso">Bloqueado</Etiqueta>}
        </div>
      ),
    },
    {
      k: 'acc', txt: '', alinear: 'der',
      render: (u) => (
        <div className="flex flex-wrap gap-3 justify-end">
          <button onClick={() => { setRolesSel(u.asignaciones); setDlg({ t: 'roles', u }); }}
                  className="text-sm font-semibold text-marca-700 underline">Roles</button>
          <button onClick={() => setDlg({ t: 'password', u })}
                  className="text-sm font-semibold text-marca-700 underline">Contraseña</button>
          <button onClick={() => setDlg({ t: 'pin', u })}
                  className="text-sm font-semibold text-marca-700 underline">PIN</button>
          <button onClick={() => setDlg({ t: 'estado', u })}
                  className={`text-sm font-semibold underline ${u.activo ? 'text-error' : 'text-exito'}`}>
            {u.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      ),
    },
  ];

  function Casillas({ valor, onCambio }: { valor: Asignacion[]; onCambio: (v: Asignacion[]) => void }) {
    const puesta = (codigo: string) => valor.find((x) => x.rol === codigo);
    return (
      <fieldset className="mb-4">
        <legend className="text-sm font-semibold mb-2">Roles</legend>
        {roles.map((r) => {
          const marcada = puesta(r.codigo);
          const exigeUnidad = EXIGEN_UNIDAD.includes(r.codigo);
          return (
            <div key={r.codigo} className="py-1.5">
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={!!marcada}
                       onChange={(e) => onCambio(e.target.checked
                         ? [...valor, { rol: r.codigo, unidadId: null }]
                         : valor.filter((x) => x.rol !== r.codigo))}
                       className="w-4 h-4 rounded border-linea text-marca-600 focus:ring-marca-500" />
                <span>{r.denominacion} <span className="text-tenue text-xs">({r.codigo})</span></span>
              </label>
              {marcada && exigeUnidad && (
                <div className="ml-7 mt-2">
                  <Selector etiqueta="Unidad a su cargo" value={marcada.unidadId ?? ''}
                            onChange={(e) => onCambio(valor.map((x) => x.rol === r.codigo
                              ? { ...x, unidadId: e.target.value || null } : x))}>
                    <option value="">Selecciona una unidad…</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>{u.denominacion}</option>
                    ))}
                  </Selector>
                  <p className="text-xs text-tenue -mt-2">
                    Solo resolverá lo de esta unidad y las que cuelguen de ella.
                  </p>
                </div>
              )}
            </div>
          );
        })}
        {faltaUnidad(valor) && (
          <p className="text-sm text-error mt-1">
            Indica la unidad a cargo del responsable: sin ella no podría resolver nada.
          </p>
        )}
      </fieldset>
    );
  }

  return (
    <div>
      <CabeceraPagina
        titulo="Accesos"
        descripcion="Alta de usuarios, roles y credenciales. Repartir accesos es competencia exclusiva del administrador de la entidad." />
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}

      <Tarjeta
        titulo={`Usuarios (${visibles.length}${q ? ` de ${usuarios?.length ?? 0}` : ''})`}
        accion={<Boton onClick={() => setDlg({ t: 'nuevo' })}>+ Nuevo usuario</Boton>}>
        <Buscador valor={q} onCambio={setQ} placeholder="Buscar por correo, nombre o documento…" />
        {!usuarios ? <Cargando /> : <Tabla columnas={cols} filas={visibles} vacio="Ningún usuario coincide." />}
        {sinAcceso.length > 0 && (
          <p className="text-xs text-tenue mt-4">
            {sinAcceso.length} persona{sinAcceso.length > 1 ? 's' : ''} de la plantilla todavía sin acceso.
          </p>
        )}
      </Tarjeta>

      {dlg?.t === 'nuevo' && (
        <Modal titulo="Nuevo usuario" onCerrar={() => setDlg(null)}>
          <form onSubmit={crear} noValidate>
            <Campo etiqueta="Correo electrónico" type="email" value={nuevo.email}
                   onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} required />
            <Campo etiqueta="Contraseña inicial" type="text" value={nuevo.password}
                   onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
                   ayuda="Mínimo 12 caracteres. La persona debería cambiarla en su primer acceso." required />
            <Selector etiqueta="Persona de la plantilla" value={nuevo.personaId}
                      onChange={(e) => setNuevo({ ...nuevo, personaId: e.target.value })}>
              <option value="">Sin vincular (administrador sin ficha)</option>
              {sinAcceso.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} {p.apellido1} {p.apellido2 ?? ''} · {p.num_documento}</option>
              ))}
            </Selector>
            <Casillas valor={nuevo.roles} onCambio={(v) => setNuevo({ ...nuevo, roles: v })} />
            <div className="flex justify-end gap-2">
              <Boton variante="secundario" type="button" onClick={() => setDlg(null)}>Cancelar</Boton>
              <Boton type="submit" disabled={nuevo.roles.length === 0 || faltaUnidad(nuevo.roles)}>
                Crear acceso
              </Boton>
            </div>
          </form>
        </Modal>
      )}

      {dlg?.t === 'roles' && (
        <Modal titulo={`Roles de ${dlg.u.email}`} onCerrar={() => setDlg(null)}>
          <form onSubmit={guardarRoles} noValidate>
            <Casillas valor={rolesSel} onCambio={setRolesSel} />
            <div className="flex justify-end gap-2">
              <Boton variante="secundario" type="button" onClick={() => setDlg(null)}>Cancelar</Boton>
              <Boton type="submit" disabled={faltaUnidad(rolesSel)}>Guardar</Boton>
            </div>
          </form>
        </Modal>
      )}

      {dlg?.t === 'password' && (
        <Modal titulo={`Restablecer contraseña de ${dlg.u.email}`} onCerrar={() => setDlg(null)}>
          <form onSubmit={guardarPassword} noValidate>
            <Campo etiqueta="Nueva contraseña" type="text" value={pass} onChange={(e) => setPass(e.target.value)}
                   ayuda="Mínimo 12 caracteres. Se desbloquea la cuenta y se anota en el registro (la contraseña no)." required />
            <div className="flex justify-end gap-2">
              <Boton variante="secundario" type="button" onClick={() => setDlg(null)}>Cancelar</Boton>
              <Boton type="submit" disabled={pass.length < 12}>Restablecer</Boton>
            </div>
          </form>
        </Modal>
      )}

      {dlg?.t === 'pin' && (
        <Modal titulo={`PIN de quiosco de ${dlg.u.email}`} onCerrar={() => setDlg(null)}>
          <form onSubmit={guardarPin} noValidate>
            <Campo etiqueta="PIN" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)}
                   ayuda="De 4 a 8 dígitos. Se usa en el fichaje de quiosco junto al correo; nunca sustituye a la contraseña." required />
            <div className="flex justify-end gap-2">
              <Boton variante="secundario" type="button" onClick={() => setDlg(null)}>Cancelar</Boton>
              <Boton type="submit" disabled={!/^\d{4,8}$/.test(pin)}>Guardar PIN</Boton>
            </div>
          </form>
        </Modal>
      )}

      {dlg?.t === 'estado' && (
        <Modal titulo={dlg.u.activo ? 'Desactivar acceso' : 'Reactivar acceso'} onCerrar={() => setDlg(null)}>
          <form onSubmit={guardarEstado} noValidate>
            <p className="text-sm text-apagado mb-4">
              {dlg.u.activo
                ? 'El usuario dejará de poder entrar. No se borra nada: el histórico se conserva.'
                : 'El usuario volverá a poder iniciar sesión.'}
            </p>
            <Campo etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                   ayuda="Queda registrado en el log de auditoría." required />
            <div className="flex justify-end gap-2">
              <Boton variante="secundario" type="button" onClick={() => setDlg(null)}>Cancelar</Boton>
              <Boton variante={dlg.u.activo ? 'peligro' : 'primario'} type="submit" disabled={motivo.trim().length < 3}>
                {dlg.u.activo ? 'Desactivar' : 'Activar'}
              </Boton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
