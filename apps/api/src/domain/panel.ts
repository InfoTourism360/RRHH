import { conTenant, type Contexto } from '../db/pool.js';

// Agregados en vivo para el cuadro de mando de dirección. Todo bajo RLS: solo
// datos de la entidad activa. Pensado para roles de gestión/administración.
export function panelDireccion(ctx: Contexto) {
  return conTenant(ctx, async (ej) => {
    const uno = async (sql: string) => (await ej.query(sql)).rows;

    // Todas las agregaciones se lanzan en paralelo sobre la misma conexión de
    // la transacción: antes eran 10 round-trips encadenados en la pantalla que
    // más se abre del producto.
    const [
      efectivosR, plazasR, vacantesR, reservadosR, pendientesR,
      porGrupo, porUnidad, porVinculo, porSituacion, porNivel,
    ] = await Promise.all([
      uno(`SELECT count(*)::int n FROM relacion_servicio WHERE cese IS NULL AND ocupa_efectivo`),
      uno(`SELECT count(*)::int n FROM plaza WHERE vigencia_hasta IS NULL`),
      // Vacante NO es lo mismo que «sin ocupante efectivo». El puesto cuyo
      // titular está en excedencia o en comisión con reserva no tiene a nadie
      // sentado, pero no puede ofertarse ni sacarse a concurso mientras dure la
      // reserva. Contarlo como vacante es el error caro de este dominio, y el
      // cuadro de mando lo cometía: decía 5 vacantes donde la RPT decía 4 más
      // una reservada. Dos pantallas del mismo producto con cifras distintas.
      uno(`SELECT count(*)::int n
             FROM v_plaza_estado v
            WHERE v.vacante
              AND NOT EXISTS (
                SELECT 1 FROM puesto pu
                  JOIN relacion_servicio rs ON rs.puesto_id = pu.id
                 WHERE pu.plaza_id = v.plaza_id
                   AND rs.cese IS NULL AND NOT rs.ocupa_efectivo)`),
      uno(`SELECT count(*)::int n
             FROM v_plaza_estado v
            WHERE v.vacante
              AND EXISTS (
                SELECT 1 FROM puesto pu
                  JOIN relacion_servicio rs ON rs.puesto_id = pu.id
                 WHERE pu.plaza_id = v.plaza_id
                   AND rs.cese IS NULL AND NOT rs.ocupa_efectivo)`),
      uno(`SELECT count(*)::int n FROM solicitud_ausencia WHERE estado = 'SOLICITADA'`),
      uno(`SELECT pl.grupo_codigo k, count(*)::int v
             FROM relacion_servicio rs JOIN puesto pu ON pu.id=rs.puesto_id JOIN plaza pl ON pl.id=pu.plaza_id
            WHERE rs.cese IS NULL AND rs.ocupa_efectivo GROUP BY pl.grupo_codigo ORDER BY pl.grupo_codigo`),
      uno(`SELECT u.denominacion k, count(*)::int v
             FROM relacion_servicio rs JOIN puesto pu ON pu.id=rs.puesto_id JOIN unidad_organica u ON u.id=pu.unidad_id
            WHERE rs.cese IS NULL AND rs.ocupa_efectivo GROUP BY u.denominacion ORDER BY count(*) DESC`),
      uno(`SELECT tipo_codigo k, count(*)::int v
             FROM relacion_servicio WHERE cese IS NULL AND ocupa_efectivo GROUP BY tipo_codigo ORDER BY count(*) DESC`),
      uno(`SELECT situacion_codigo k, count(*)::int v
             FROM relacion_servicio WHERE cese IS NULL GROUP BY situacion_codigo ORDER BY count(*) DESC`),
      uno(`SELECT CASE WHEN nivel_cd<=14 THEN '1-14' WHEN nivel_cd<=20 THEN '15-20'
                      WHEN nivel_cd<=26 THEN '21-26' ELSE '27-30' END k, count(*)::int v
             FROM puesto WHERE vigencia_hasta IS NULL GROUP BY k ORDER BY k`),
    ]);
    const efectivos = efectivosR[0], plazas = plazasR[0], vacantes = vacantesR[0];
    const reservados = reservadosR[0], pendientes = pendientesR[0];

    const total = efectivos!.n as number;
    const interinosTemp = (porVinculo as { k: string; v: number }[])
      .filter((r) => r.k === 'FUNC_INTERINO' || r.k === 'LAB_TEMPORAL')
      .reduce((s, r) => s + r.v, 0);

    return {
      kpis: {
        efectivos: total,
        plazas: plazas!.n,
        vacantes: vacantes!.n,
        reservados: reservados!.n,
        // La cobertura mide plazas con alguien dentro, así que los reservados
        // tampoco cuentan como cubiertos: no hay nadie prestando servicio.
        coberturaPct: plazas!.n
          ? Math.round(((plazas!.n - vacantes!.n - reservados!.n) / plazas!.n) * 100) : 0,
        temporalidadPct: total ? Math.round((interinosTemp / total) * 1000) / 10 : 0,
        ausenciasPendientes: pendientes!.n,
      },
      porGrupo, porUnidad, porVinculo, porSituacion, porNivel,
    };
  });
}
