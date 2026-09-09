import { conTenant, type Contexto } from '../db/pool.js';

// Agregados en vivo para el cuadro de mando de dirección. Todo bajo RLS: solo
// datos de la entidad activa. Pensado para roles de gestión/administración.
export function panelDireccion(ctx: Contexto) {
  return conTenant(ctx, async (ej) => {
    const uno = async (sql: string) => (await ej.query(sql)).rows;

    const [efectivos] = await uno(
      `SELECT count(*)::int n FROM relacion_servicio WHERE cese IS NULL AND ocupa_efectivo`);
    const [plazas] = await uno(
      `SELECT count(*)::int n FROM plaza WHERE vigencia_hasta IS NULL`);
    const [vacantes] = await uno(
      `SELECT count(*)::int n FROM v_plaza_estado WHERE vacante`);
    const [pendientes] = await uno(
      `SELECT count(*)::int n FROM solicitud_ausencia WHERE estado = 'SOLICITADA'`);

    const porGrupo = await uno(
      `SELECT pl.grupo_codigo k, count(*)::int v
         FROM relacion_servicio rs JOIN puesto pu ON pu.id=rs.puesto_id JOIN plaza pl ON pl.id=pu.plaza_id
        WHERE rs.cese IS NULL AND rs.ocupa_efectivo GROUP BY pl.grupo_codigo ORDER BY pl.grupo_codigo`);
    const porUnidad = await uno(
      `SELECT u.denominacion k, count(*)::int v
         FROM relacion_servicio rs JOIN puesto pu ON pu.id=rs.puesto_id JOIN unidad_organica u ON u.id=pu.unidad_id
        WHERE rs.cese IS NULL AND rs.ocupa_efectivo GROUP BY u.denominacion ORDER BY count(*) DESC`);
    const porVinculo = await uno(
      `SELECT tipo_codigo k, count(*)::int v
         FROM relacion_servicio WHERE cese IS NULL AND ocupa_efectivo GROUP BY tipo_codigo ORDER BY count(*) DESC`);
    const porSituacion = await uno(
      `SELECT situacion_codigo k, count(*)::int v
         FROM relacion_servicio WHERE cese IS NULL GROUP BY situacion_codigo ORDER BY count(*) DESC`);
    const porNivel = await uno(
      `SELECT CASE WHEN nivel_cd<=14 THEN '1-14' WHEN nivel_cd<=20 THEN '15-20'
                   WHEN nivel_cd<=26 THEN '21-26' ELSE '27-30' END k, count(*)::int v
         FROM puesto WHERE vigencia_hasta IS NULL GROUP BY k ORDER BY k`);

    const total = efectivos!.n as number;
    const interinosTemp = (porVinculo as { k: string; v: number }[])
      .filter((r) => r.k === 'FUNC_INTERINO' || r.k === 'LAB_TEMPORAL')
      .reduce((s, r) => s + r.v, 0);

    return {
      kpis: {
        efectivos: total,
        plazas: plazas!.n,
        vacantes: vacantes!.n,
        coberturaPct: plazas!.n ? Math.round(((plazas!.n - vacantes!.n) / plazas!.n) * 100) : 0,
        temporalidadPct: total ? Math.round((interinosTemp / total) * 1000) / 10 : 0,
        ausenciasPendientes: pendientes!.n,
      },
      porGrupo, porUnidad, porVinculo, porSituacion, porNivel,
    };
  });
}
