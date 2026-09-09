import { useEffect, useState } from 'react';
import { api } from '../api';
import { Cargando, Tarjeta } from '../ui';
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

function Kpi({ label, num, foot, tono }: { label: string; num: string; foot?: string; tono?: 'ok' | 'warn' }) {
  const punto = tono === 'ok' ? 'bg-exito' : tono === 'warn' ? 'bg-aviso' : 'bg-marca-500';
  return (
    <div className="bg-white rounded-xl2 border border-linea shadow-tarjeta p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-apagado uppercase tracking-wide">
        <span className={`w-1.5 h-1.5 rounded-full ${punto}`} aria-hidden="true" />{label}
      </div>
      <div className="num text-[28px] leading-none font-bold mt-2.5">{num}</div>
      {foot && <div className="text-xs text-tenue mt-1.5">{foot}</div>}
    </div>
  );
}

export function Panel() {
  const [p, setP] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.get<Panel>('/admin/panel').then(setP).catch(() => setError('No se pudo cargar el cuadro de mando.')); }, []);

  if (error) return <p role="alert" className="text-error">{error}</p>;
  if (!p) return <Cargando texto="Cargando cuadro de mando…" />;

  const k = p.kpis;
  return (
    <div>
      <h1 className="text-[26px] font-extrabold mb-1">Cuadro de mando de personal</h1>
      <p className="text-apagado mb-6">Plantilla, RPT, control horario y ausencias — datos en vivo de tu entidad.</p>

      <section aria-label="Indicadores clave" className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-6">
        <Kpi label="Efectivos en activo" num={String(k.efectivos)} foot="relación vigente" tono="ok" />
        <Kpi label="Plantilla (plazas)" num={String(k.plazas)} foot="dotaciones" />
        <Kpi label="Cobertura de la RPT" num={`${k.coberturaPct}%`} tono="ok" />
        <Kpi label="Plazas vacantes" num={String(k.vacantes)} foot="por cubrir" tono="warn" />
        <Kpi label="Temporalidad" num={`${String(k.temporalidadPct).replace('.', ',')}%`} tono="ok" />
        <Kpi label="Ausencias por resolver" num={String(k.ausenciasPendientes)} foot="pendientes" tono={k.ausenciasPendientes ? 'warn' : 'ok'} />
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
        <Tarjeta titulo="Cumplimiento normativo">
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><span className="text-exito font-bold">✓</span> Registro horario inmutable (append-only, correcciones trazadas, 4 años).</li>
            <li className="flex gap-2"><span className="text-exito font-bold">✓</span> ENS categoría media: aislamiento por entidad, registro de actividad, copias.</li>
            <li className="flex gap-2"><span className="text-exito font-bold">✓</span> RGPD: minimización y sin biometría.</li>
          </ul>
        </Tarjeta>
      </div>
    </div>
  );
}
