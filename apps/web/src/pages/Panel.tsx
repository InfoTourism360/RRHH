import { useEffect, useState } from 'react';
import { api } from '../api';
import { Cargando, Tarjeta, Kpi, CabeceraPagina } from '../ui';
import { BarrasVertical, BarrasHorizontal, Donut, Gauge } from '../charts';

interface KV { k: string; v: number }
interface Panel {
  kpis: { efectivos: number; plazas: number; vacantes: number; coberturaPct: number; temporalidadPct: number; ausenciasPendientes: number };
  porGrupo: KV[]; porUnidad: KV[]; porVinculo: KV[]; porSituacion: KV[]; porNivel: KV[];
}

const VINCULO: Record<string, string> = {
  FUNC_CARRERA: 'Funcionario de carrera', FUNC_INTERINO: 'Funcionario interino',
  LAB_FIJO: 'Personal laboral fijo', LAB_TEMPORAL: 'Laboral temporal', EVENTUAL: 'Personal eventual',
};
const SITUACION: Record<string, string> = {
  SERV_ACTIVO: 'Servicio activo', SERV_ESPECIALES: 'Servicios especiales', COMISION_SERV: 'Comisión de servicios',
  EXCEDENCIA_VOL: 'Excedencia voluntaria', EXCEDENCIA_CUID: 'Excedencia (cuidado familiar)', SUSP_FIRME: 'Suspensión firme',
};

export function Panel() {
  const [p, setP] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.get<Panel>('/admin/panel').then(setP).catch(() => setError('No se pudo cargar el cuadro de mando.')); }, []);

  if (error) return <p role="alert" className="text-error">{error}</p>;
  if (!p) return <Cargando texto="Cargando cuadro de mando…" />;

  const k = p.kpis;
  return (
    <div>
      <CabeceraPagina titulo="Cuadro de mando de personal" descripcion="Plantilla, RPT, control horario y ausencias — datos en vivo de tu entidad." />

      <section aria-label="Indicadores clave" className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-6">
        <Kpi etiqueta="Efectivos en activo" valor={String(k.efectivos)} pie="relación vigente" tono="ok" />
        <Kpi etiqueta="Plantilla (plazas)" valor={String(k.plazas)} pie="dotaciones" />
        <Kpi etiqueta="Cobertura de la RPT" valor={`${k.coberturaPct}%`} tono="ok" />
        <Kpi etiqueta="Plazas vacantes" valor={String(k.vacantes)} pie="por cubrir" tono="aviso" />
        <Kpi etiqueta="Temporalidad" valor={`${String(k.temporalidadPct).replace('.', ',')}%`} tono="ok" />
        <Kpi etiqueta="Ausencias por resolver" valor={String(k.ausenciasPendientes)} pie="pendientes" tono={k.ausenciasPendientes ? "aviso" : "ok"} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Efectivos por grupo de clasificación">
          <BarrasVertical etiqueta="Efectivos por grupo" datos={p.porGrupo} />
        </Tarjeta>
        <Tarjeta titulo="Naturaleza del vínculo">
          <Donut etiqueta="Naturaleza del vínculo" centro="efectivos"
            datos={p.porVinculo.map((d) => ({ k: VINCULO[d.k] ?? d.k, v: d.v }))} />
        </Tarjeta>
        <Tarjeta titulo="Distribución por unidad orgánica">
          <BarrasHorizontal etiqueta="Efectivos por unidad" datos={p.porUnidad} />
        </Tarjeta>
        <div className="grid gap-4">
          <Tarjeta titulo="Cobertura de la relación de puestos">
            <Gauge etiqueta="Cobertura de la RPT" ocupadas={k.plazas - k.vacantes} total={k.plazas} />
          </Tarjeta>
          <Tarjeta titulo="Situación administrativa">
            <ul className="space-y-1">
              {p.porSituacion.map((d) => (
                <li key={d.k} className="flex justify-between">
                  <span>{SITUACION[d.k] ?? d.k}</span>
                  <span className="font-semibold tabular-nums">{d.v}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
        <Tarjeta titulo="Niveles de complemento de destino">
          <BarrasVertical etiqueta="Niveles de complemento de destino" datos={p.porNivel} />
        </Tarjeta>
        <Tarjeta titulo="Medidas implantadas">
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><span className="text-exito font-bold">✓</span> Los fichajes no se editan ni se borran: corregir uno crea un evento nuevo que conserva el original.</li>
            <li className="flex gap-2"><span className="text-exito font-bold">✓</span> Cada entidad queda aislada en la base de datos; una consulta no alcanza datos de otra.</li>
            <li className="flex gap-2"><span className="text-exito font-bold">✓</span> El registro de actividad es independiente del funcional y tampoco admite borrado.</li>
            <li className="flex gap-2"><span className="text-exito font-bold">✓</span> La identificación se hace con PIN: no se tratan datos biométricos.</li>
          </ul>
          <p className="text-xs text-tenue mt-3 pt-3 border-t border-linea">
            Son medidas del producto. La declaración de conformidad con el ENS y el cumplimiento del
            RGPD corresponden a la entidad y dependen también del despliegue.
          </p>
        </Tarjeta>
      </div>
    </div>
  );
}
