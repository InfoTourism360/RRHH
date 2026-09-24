import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import {
  Alerta, Boton, Campo, Cargando, Etiqueta, Selector, Tabla, Tarjeta, type Columna,
} from './ui';

/**
 * Jornadas teóricas de la entidad y su asignación.
 *
 * Responde a "cuántos minutos se le presuponen a esta persona cada día de la
 * semana". No son cuadrantes: no dice qué día trabaja cada cual. Sin esto el
 * saldo solo tenía sentido para quien está en horario de oficina.
 */

interface Jornada {
  id: string; codigo: string; denominacion: string;
  minutos_por_dia: Record<string, number>; activo: boolean; personas: string;
}
interface Persona {
  id: string; nombre: string; apellido1: string; apellido2: string | null;
  num_documento: string; jornada_tipo_id: string | null;
}

const DIAS = [
  [1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'],
  [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo'],
] as const;

const OFICINA: Record<number, number> = { 0: 0, 1: 450, 2: 450, 3: 450, 4: 450, 5: 450, 6: 0 };

const totalSemanal = (m: Record<string, number> | Record<number, number>) =>
  Object.values(m).reduce((a, b) => a + Number(b), 0);

/** 450 → "7 h 30 min", que es como lo lee una persona. */
function enHoras(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function SecJornadas() {
  const [jornadas, setJornadas] = useState<Jornada[] | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [abrir, setAbrir] = useState(false);
  const [f, setF] = useState({ codigo: '', denominacion: '', minutos: { ...OFICINA } });
  const [personaId, setPersonaId] = useState('');

  const cargar = useCallback(async () => {
    const [j, p] = await Promise.all([
      api.get<Jornada[]>('/estructura/jornadas').catch(() => [] as Jornada[]),
      api.get<Persona[]>('/estructura/personas').catch(() => [] as Persona[]),
    ]);
    setJornadas(j); setPersonas(p);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const fallo = (e: unknown, alt: string) =>
    setMsg({ tipo: 'error', texto: e instanceof ApiError ? e.message : alt });

  async function crear(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/estructura/jornadas', {
        codigo: f.codigo.trim().toUpperCase(),
        denominacion: f.denominacion.trim(),
        minutosPorDia: Object.fromEntries(Object.entries(f.minutos).map(([d, m]) => [d, Number(m)])),
      });
      setF({ codigo: '', denominacion: '', minutos: { ...OFICINA } });
      setAbrir(false);
      setMsg({ tipo: 'exito', texto: 'Jornada creada.' });
      await cargar();
    } catch (err) { fallo(err, 'No se pudo crear la jornada.'); }
  }

  async function alternar(j: Jornada) {
    try {
      await api.patch(`/estructura/jornadas/${j.id}`, { activo: !j.activo });
      await cargar();
    } catch (err) { fallo(err, 'No se pudo cambiar el estado.'); }
  }

  async function asignar(jornadaTipoId: string | null) {
    if (!personaId) return;
    try {
      await api.put(`/estructura/personas/${personaId}/jornada`, { jornadaTipoId });
      setMsg({ tipo: 'exito', texto: jornadaTipoId ? 'Jornada asignada.' : 'Asignación retirada.' });
      await cargar();
    } catch (err) { fallo(err, 'No se pudo asignar la jornada.'); }
  }

  const cols: Columna<Jornada>[] = [
    { k: 'den', txt: 'Jornada', render: (j) => (
      <div>
        <div className="font-semibold">{j.denominacion}</div>
        <div className="text-xs text-tenue num">{j.codigo}</div>
      </div>
    ) },
    { k: 'sem', txt: 'Semana', render: (j) => (
      <span className="num">{enHoras(totalSemanal(j.minutos_por_dia))}</span>
    ) },
    { k: 'rep', txt: 'Reparto', render: (j) => (
      <div className="flex flex-wrap gap-1">
        {DIAS.map(([d, nombre]) => (
          <span key={d} title={nombre}
                className={`num text-xs rounded px-1.5 py-0.5 border ${
                  Number(j.minutos_por_dia[String(d)] ?? 0) > 0
                    ? 'border-linea bg-lienzo' : 'border-transparent text-tenue'}`}>
            {nombre.slice(0, 1)}&nbsp;{Number(j.minutos_por_dia[String(d)] ?? 0)}
          </span>
        ))}
      </div>
    ) },
    { k: 'per', txt: 'Personas', alinear: 'der', render: (j) => <span className="num">{j.personas}</span> },
    { k: 'est', txt: 'Estado', render: (j) =>
      j.activo ? <Etiqueta tono="exito">Activa</Etiqueta> : <Etiqueta>Inactiva</Etiqueta> },
    { k: 'acc', txt: '', alinear: 'der', render: (j) => (
      <button onClick={() => alternar(j)} className="text-sm font-semibold text-marca-700 underline">
        {j.activo ? 'Desactivar' : 'Activar'}
      </button>
    ) },
  ];

  const seleccionada = personas.find((p) => p.id === personaId);

  return (
    <div className="grid gap-4">
      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}

      <Tarjeta
        titulo="Jornadas de la entidad"
        accion={<Boton onClick={() => setAbrir((v) => !v)}>{abrir ? 'Cancelar' : '+ Nueva jornada'}</Boton>}>
        <p className="text-sm text-apagado mb-4">
          Minutos que se presuponen cada día de la semana. Quien no tenga ninguna asignada
          usa la jornada por defecto de la entidad.
        </p>

        {abrir && (
          <form onSubmit={crear} noValidate className="mb-6 pb-6 border-b border-linea">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Campo etiqueta="Código" value={f.codigo}
                     onChange={(e) => setF({ ...f, codigo: e.target.value })}
                     ayuda="Identificador corto, p. ej. TURNOS" required />
              <Campo etiqueta="Denominación" value={f.denominacion}
                     onChange={(e) => setF({ ...f, denominacion: e.target.value })} required />
            </div>
            <fieldset className="mb-4">
              <legend className="text-sm font-semibold mb-2">Minutos por día</legend>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
                {DIAS.map(([d, nombre]) => (
                  <label key={d} className="text-sm">
                    <span className="block mb-1 text-apagado">{nombre}</span>
                    <input type="number" min={0} max={1440} inputMode="numeric"
                           value={f.minutos[d]}
                           onChange={(e) => setF({ ...f, minutos: { ...f.minutos, [d]: Number(e.target.value) } })}
                           className="num w-full rounded-lg border border-linea px-3 py-2
                                      focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none" />
                  </label>
                ))}
              </div>
              <p className="text-sm text-apagado mt-2">
                Total semanal: <strong className="num">{enHoras(totalSemanal(f.minutos))}</strong>
              </p>
            </fieldset>
            <Boton type="submit" disabled={!f.codigo.trim() || !f.denominacion.trim()}>Crear jornada</Boton>
          </form>
        )}

        {!jornadas ? <Cargando /> : (
          <Tabla columnas={cols} filas={jornadas}
                 vacio="Todavía no hay jornadas: toda la plantilla usa la de la entidad." />
        )}
      </Tarjeta>

      <Tarjeta titulo="Asignar jornada a una persona">
        <Selector etiqueta="Persona" value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
          <option value="">Selecciona una persona…</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} {p.apellido1} {p.apellido2 ?? ''} · {p.num_documento}
            </option>
          ))}
        </Selector>

        {seleccionada && (
          <>
            <Selector etiqueta="Jornada" value={seleccionada.jornada_tipo_id ?? ''}
                      onChange={(e) => asignar(e.target.value || null)}>
              <option value="">Jornada por defecto de la entidad</option>
              {(jornadas ?? []).filter((j) => j.activo).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.denominacion} ({enHoras(totalSemanal(j.minutos_por_dia))} semanales)
                </option>
              ))}
            </Selector>
            <p className="text-xs text-tenue">
              El cambio afecta al saldo calculado, no a los fichajes: esos no se tocan nunca.
            </p>
          </>
        )}
      </Tarjeta>
    </div>
  );
}
