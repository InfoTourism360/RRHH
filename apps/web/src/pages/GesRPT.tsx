import { useCallback, useEffect, useState } from 'react';
import { api, descargar, ApiError } from '../api';
import {
  Alerta, Boton, Buscador, CabeceraPagina, Cargando, Etiqueta, Kpi, Selector,
  Tabla, Tarjeta, filtrar, type Columna,
} from '../ui';
import { GRUPOS } from '../catalogos';

type Estado = 'OCUPADO' | 'OCUPADO_CON_RESERVA' | 'RESERVADO' | 'VACANTE';

interface Fila {
  puesto_id: string; codigo: string; denominacion: string;
  unidad_codigo: string; unidad: string; plaza_codigo: string;
  grupo_codigo: string; grupo: string; escala: string | null; subescala: string | null;
  nivel_cd: number; complemento_esp: string | null;
  forma_provision: string | null; tipo_jornada: string | null; adscripcion: string | null;
  estado: Estado; ocupante: string | null; ocupante_tipo: string | null;
  ocupante_situacion: string | null; reserva_de: string | null; reserva_situacion: string | null;
}
interface Resumen {
  total: number; ocupados: number; vacantes: number; reservados: number; sinComplemento: number;
}
interface Unidad { id: string; denominacion: string }

const ESTADO: Record<Estado, { txt: string; tono: 'exito' | 'aviso' | 'neutro' | 'marca' }> = {
  OCUPADO: { txt: 'Ocupado', tono: 'exito' },
  OCUPADO_CON_RESERVA: { txt: 'Ocupado · reserva', tono: 'marca' },
  RESERVADO: { txt: 'Reservado', tono: 'aviso' },
  VACANTE: { txt: 'Vacante', tono: 'neutro' },
};

/** Importe en euros. Sin consignar no es cero: se distingue. */
function euros(v: string | null) {
  if (v === null) return <span className="text-tenue">sin consignar</span>;
  return <span className="num">{Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>;
}

export function GesRPT() {
  const [datos, setDatos] = useState<{ filas: Fila[]; resumen: Resumen } | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [unidadId, setUnidadId] = useState('');
  const [grupo, setGrupo] = useState('');
  const [soloVacantes, setSoloVacantes] = useState(false);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Unidad[]>('/estructura/unidades').then(setUnidades).catch(() => {});
  }, []);

  const consulta = new URLSearchParams();
  if (unidadId) consulta.set('unidadId', unidadId);
  if (grupo) consulta.set('grupo', grupo);
  if (soloVacantes) consulta.set('soloVacantes', 'true');
  const qs = consulta.toString();

  const cargar = useCallback(async () => {
    setDatos(null);
    try { setDatos(await api.get(`/estructura/rpt${qs ? `?${qs}` : ''}`)); }
    catch { setDatos({ filas: [], resumen: { total: 0, ocupados: 0, vacantes: 0, reservados: 0, sinComplemento: 0 } }); }
  }, [qs]);
  useEffect(() => { void cargar(); }, [cargar]);

  async function exportar() {
    setError(null);
    try { await descargar(`/estructura/rpt.csv${qs ? `?${qs}` : ''}`, 'rpt.csv'); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo exportar la RPT.'); }
  }

  const filas = filtrar(datos?.filas ?? [], ['codigo', 'denominacion', 'unidad', 'ocupante'], q);
  const r = datos?.resumen;

  const cols: Columna<Fila>[] = [
    { k: 'codigo', txt: 'Código' },
    {
      k: 'denominacion',
      txt: 'Denominación',
      render: (f) => (
        <>
          <span className="font-semibold">{f.denominacion}</span>
          <span className="block text-xs text-tenue">{f.unidad}</span>
        </>
      ),
    },
    { k: 'grupo_codigo', txt: 'Grupo' },
    { k: 'nivel_cd', txt: 'Nivel CD', alinear: 'der' },
    { k: 'complemento_esp', txt: 'C. específico', alinear: 'der', render: (f) => euros(f.complemento_esp) },
    { k: 'forma_provision', txt: 'Provisión', render: (f) => f.forma_provision ?? '—' },
    {
      k: 'estado',
      txt: 'Situación',
      render: (f) => (
        <>
          <Etiqueta tono={ESTADO[f.estado].tono}>{ESTADO[f.estado].txt}</Etiqueta>
          {f.ocupante && <span className="block text-xs text-apagado mt-1">{f.ocupante}</span>}
          {f.reserva_de && (
            <span className="block text-xs text-tenue mt-0.5">
              Reserva: {f.reserva_de} ({f.reserva_situacion})
            </span>
          )}
        </>
      ),
    },
  ];

  return (
    <div>
      <CabeceraPagina
        titulo="RPT"
        descripcion="Relación de puestos de trabajo vigente, con su cobertura actual."
        accion={<Boton variante="secundario" onClick={exportar}>Exportar CSV</Boton>}
      />
      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}

      {r && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-5">
          <Kpi etiqueta="Puestos" valor={r.total} />
          <Kpi etiqueta="Ocupados" valor={r.ocupados} tono="ok" />
          <Kpi etiqueta="Vacantes" valor={r.vacantes} pie="Ofertables" />
          <Kpi etiqueta="Reservados" valor={r.reservados} tono={r.reservados ? 'aviso' : 'neutro'}
               pie="No ofertables" />
        </div>
      )}

      {r && r.reservados > 0 && (
        <div className="mb-4">
          <Alerta tipo="aviso">
            {r.reservados === 1
              ? 'Hay 1 puesto sin ocupante cuyo titular conserva la reserva.'
              : `Hay ${r.reservados} puestos sin ocupante cuyos titulares conservan la reserva.`}
            {' '}No cuentan como vacantes: no pueden incluirse en una oferta de empleo
            público ni sacarse a concurso mientras dure la reserva.
          </Alerta>
        </div>
      )}

      {r && r.sinComplemento > 0 && (
        <div className="mb-4">
          <Alerta tipo="aviso">
            {r.sinComplemento === 1
              ? 'Hay 1 puesto sin complemento específico consignado.'
              : `Hay ${r.sinComplemento} puestos sin complemento específico consignado.`}
            {' '}La RPT no debería publicarse con esa columna incompleta.
          </Alerta>
        </div>
      )}

      <Tarjeta titulo={`Puestos (${filas.length}${q ? ` de ${datos?.filas.length}` : ''})`}>
        <div className="grid gap-x-4 sm:grid-cols-3 mb-1">
          <Selector etiqueta="Unidad" value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
            <option value="">Todas</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.denominacion}</option>)}
          </Selector>
          <Selector etiqueta="Grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            <option value="">Todos</option>
            {GRUPOS.map(([c, t]) => <option key={c} value={c}>{t}</option>)}
          </Selector>
          <div className="mb-4 flex items-end">
            <label className="flex items-center gap-2 text-sm font-semibold pb-2.5">
              <input type="checkbox" checked={soloVacantes}
                     onChange={(e) => setSoloVacantes(e.target.checked)}
                     className="w-4 h-4 rounded border-linea text-marca-600 focus:ring-marca-500/30" />
              Solo vacantes ofertables
            </label>
          </div>
        </div>

        <Buscador valor={q} onCambio={setQ} placeholder="Buscar por código, denominación, unidad u ocupante…" />
        {!datos ? <Cargando /> : (
          <Tabla columnas={cols} filas={filas} vacio="Ningún puesto coincide con los filtros." />
        )}

        <p className="text-xs text-tenue mt-4 pt-3 border-t border-linea">
          El nivel de complemento de destino (1–30) determina su importe según la Ley de
          Presupuestos de cada ejercicio, que no se almacena aquí. La vacancia se deriva de
          la ocupación vigente; no es un campo editable.
        </p>
      </Tarjeta>
    </div>
  );
}
