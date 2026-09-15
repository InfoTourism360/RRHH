import { conTenant, type Contexto, type Ejecutor } from '../db/pool.js';
import { leerPoliticas, minutosTeoricos, type PoliticasEntidad } from './jornada.js';

interface EventoBruto {
  id: string;
  persona_id: string;
  tipo: 'ENTRADA' | 'SALIDA' | 'INICIO_PAUSA' | 'FIN_PAUSA';
  origen: string;
  momento_servidor: string;
  momento_cliente: string | null;
  corrige_evento_id: string | null;
  accion_correccion: 'MODIFICA' | 'ANULA' | 'ANADE' | null;
}
interface EventoEfectivo { tipo: EventoBruto['tipo']; momento: Date }

/**
 * Aplica las correcciones sobre los eventos originales y devuelve la línea
 * temporal EFECTIVA (el original nunca se pierde; aquí solo se computa).
 *   - ANULA  : elimina el evento referenciado.
 *   - MODIFICA: sustituye tipo/momento del referenciado.
 *   - ANADE  : añade un evento que faltaba.
 */
export function resolverEfectivos(brutos: EventoBruto[]): EventoEfectivo[] {
  const anulados = new Set<string>();
  const modificaciones = new Map<string, EventoBruto>();
  const anadidos: EventoBruto[] = [];

  for (const e of brutos) {
    if (e.origen !== 'CORRECCION') continue;
    if (e.accion_correccion === 'ANULA' && e.corrige_evento_id) anulados.add(e.corrige_evento_id);
    else if (e.accion_correccion === 'MODIFICA' && e.corrige_evento_id) modificaciones.set(e.corrige_evento_id, e);
    else if (e.accion_correccion === 'ANADE') anadidos.push(e);
  }

  const efectivos: EventoEfectivo[] = [];
  for (const e of brutos) {
    if (e.origen === 'CORRECCION') continue;
    if (anulados.has(e.id)) continue;
    const mod = modificaciones.get(e.id);
    if (mod) {
      efectivos.push({ tipo: mod.tipo, momento: new Date(mod.momento_cliente ?? mod.momento_servidor) });
    } else {
      efectivos.push({ tipo: e.tipo, momento: new Date(e.momento_servidor) });
    }
  }
  for (const a of anadidos) {
    efectivos.push({ tipo: a.tipo, momento: new Date(a.momento_cliente ?? a.momento_servidor) });
  }
  return efectivos.sort((x, y) => x.momento.getTime() - y.momento.getTime());
}

function fechaLocal(d: Date): string {
  // Zona Europe/Madrid fijada por process.env.TZ en config/env.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Tope de un tramo para darlo por cerrado. Una guardia de 24 h existe; más allá
 * es que alguien no fichó la salida, y no se inventa: el tramo se descarta y se
 * corrige por el procedimiento, como cualquier otro olvido.
 */
const MAX_TRAMO_MIN = 24 * 60;

interface Acumulado { presencia: number; pausa: number }

/**
 * Reparte por día los tramos ENTRADA→SALIDA y las pausas.
 *
 * Empareja recorriendo TODA la línea temporal, no cada día por separado. Antes
 * se agrupaba primero por día y se emparejaba dentro de cada bolsa, de modo que
 * un turno de noche perdía las dos patas: la ENTRADA de las 22:00 no encontraba
 * salida en su día y la SALIDA de las 06:00 no encontraba entrada en el suyo.
 * No es que se repartieran las horas: se perdían enteras.
 *
 * Un tramo se imputa al día en que EMPIEZA. El turno pertenece a la jornada que
 * se inició, que es como se cuadran los cuadrantes de policía o de bomberos.
 */
export function repartirPorDia(eventos: EventoEfectivo[]): {
  porDia: Map<string, Acumulado>;
  entradaAbierta: Date | null;
  pausaAbierta: Date | null;
} {
  const porDia = new Map<string, Acumulado>();
  const sumar = (fecha: string, campo: keyof Acumulado, min: number) => {
    const a = porDia.get(fecha) ?? { presencia: 0, pausa: 0 };
    a[campo] += min;
    porDia.set(fecha, a);
  };

  let entrada: Date | null = null;
  let iniPausa: Date | null = null;

  for (const e of eventos) {
    if (e.tipo === 'ENTRADA') {
      // El día queda registrado aunque el tramo no llegue a cerrarse: si alguien
      // olvidó fichar la salida, su día tiene que salir en el informe con cero
      // para que se vea y se corrija, no desaparecer.
      const dia = fechaLocal(e.momento);
      if (!porDia.has(dia)) porDia.set(dia, { presencia: 0, pausa: 0 });
      // Dos ENTRADA seguidas: la anterior quedó sin cerrar y no se puede inferir.
      entrada = e.momento;
    } else if (e.tipo === 'SALIDA') {
      if (entrada) {
        const min = (e.momento.getTime() - entrada.getTime()) / 60000;
        if (min >= 0 && min <= MAX_TRAMO_MIN) sumar(fechaLocal(entrada), 'presencia', min);
        entrada = null;
      }
    } else if (e.tipo === 'INICIO_PAUSA') {
      iniPausa = e.momento;
    } else if (e.tipo === 'FIN_PAUSA') {
      if (iniPausa) {
        const min = (e.momento.getTime() - iniPausa.getTime()) / 60000;
        // La pausa se imputa al día del turno que la contiene, no al del reloj:
        // si no, una pausa a las 02:00 restaría de un día que no trabajó.
        const dia = fechaLocal(entrada ?? iniPausa);
        if (min >= 0 && min <= MAX_TRAMO_MIN) sumar(dia, 'pausa', min);
        iniPausa = null;
      }
    }
  }
  return { porDia, entradaAbierta: entrada, pausaAbierta: iniPausa };
}

export interface JornadaDelDia {
  /** Minutos ya consolidados: tramos ENTRADA→SALIDA menos pausas cerradas. */
  cerradoMin: number;
  /** ENTRADA sin SALIDA, en ISO; el cliente cuenta desde aquí hasta ahora. */
  abiertaDesde: string | null;
  /** INICIO_PAUSA sin FIN_PAUSA, en ISO; ese tiempo no computa. */
  pausaDesde: string | null;
  teoricoMin: number;
}

/**
 * Estado de la jornada de un día concreto, incluida la parte en curso. La
 * totalización normal solo cuenta tramos cerrados, así que durante la mañana
 * daría siempre cero: esto es lo que permite pintar el avance en tiempo real.
 */
export async function jornadaDelDia(ctx: Contexto, personaId: string, fecha: string): Promise<JornadaDelDia> {
  return conTenant(ctx, async (ej: Ejecutor) => {
    const pol = await leerPoliticas(ej, ctx.entidadId);
    const r = await ej.query<EventoBruto>(
      `SELECT id, persona_id, tipo, origen, momento_servidor, momento_cliente,
              corrige_evento_id, accion_correccion
         FROM fichaje_evento
        WHERE persona_id = $1
          AND momento_servidor >= ($2::date - 1) AND momento_servidor < ($2::date + 1)
        ORDER BY momento_servidor`,
      // Se mira también el día anterior: quien entró a las 22:00 sigue dentro de
      // su jornada a las 02:00 y tiene que ver su turno en marcha, no un cero.
      [personaId, fecha],
    );
    const { porDia, entradaAbierta, pausaAbierta } = repartirPorDia(resolverEfectivos(r.rows));
    const { presencia, pausa } = porDia.get(fecha) ?? { presencia: 0, pausa: 0 };
    return {
      cerradoMin: Math.round(presencia) - Math.round(pausa),
      abiertaDesde: entradaAbierta?.toISOString() ?? null,
      pausaDesde: pausaAbierta?.toISOString() ?? null,
      teoricoMin: minutosTeoricos(pol, new Date(`${fecha}T00:00:00`)),
    };
  });
}

export interface DiaTotalizado {
  fecha: string;
  trabajadoMin: number;
  teoricoMin: number;
  saldoMin: number;
  esFestivo: boolean;
  esAusencia: boolean;
  extrasMin: number;
  festivoMin: number;
}
export interface Totalizacion {
  personaId: string;
  desde: string;
  hasta: string;
  dias: DiaTotalizado[];
  totales: { trabajadoMin: number; teoricoMin: number; saldoMin: number; extrasMin: number; festivoMin: number };
}

// Predicado de festivo inyectable (lo rellena el calendario laboral de la Fase 3).
export type EsFestivo = (fechaISO: string) => boolean;

export async function totalizar(
  ctx: Contexto,
  personaId: string,
  desde: string,
  hasta: string,
  esFestivo?: EsFestivo,
  diasAusencia?: Set<string>,
): Promise<Totalizacion> {
  return conTenant(ctx, async (ej: Ejecutor) => {
    const pol: PoliticasEntidad = await leerPoliticas(ej, ctx.entidadId);
    const r = await ej.query<EventoBruto>(
      `SELECT id, persona_id, tipo, origen, momento_servidor, momento_cliente,
              corrige_evento_id, accion_correccion
         FROM fichaje_evento
        WHERE persona_id = $1
          AND momento_servidor >= $2::date AND momento_servidor < ($3::date + 2)
        ORDER BY momento_servidor`,
      // Un día de margen por la derecha: sin él, la SALIDA de madrugada de un
      // turno iniciado el último día del rango quedaría fuera y se perdería.
      [personaId, desde, hasta],
    );
    const { porDia } = repartirPorDia(resolverEfectivos(r.rows));

    // Une los días con eventos y los días de ausencia aprobada (aunque no fichara).
    // Se recortan los que caen fuera: la consulta pide un día de más para poder
    // cerrar un turno que empezó el último día del rango.
    const clavesDia = new Set<string>(
      [...porDia.keys(), ...(diasAusencia ?? [])].filter((f) => f >= desde && f <= hasta),
    );

    const dias: DiaTotalizado[] = [];
    for (const fecha of [...clavesDia].sort()) {
      const { presencia, pausa } = porDia.get(fecha) ?? { presencia: 0, pausa: 0 };
      const trabajado = Math.max(0, Math.round(presencia) - Math.round(pausa));
      const teorico = minutosTeoricos(pol, new Date(`${fecha}T00:00:00`));
      const festivo = (esFestivo?.(fecha) ?? false) || teorico === 0;
      const ausencia = diasAusencia?.has(fecha) ?? false;
      // Un día de ausencia aprobada cubre la jornada teórica: saldo neutro.
      const saldo = ausencia ? 0 : trabajado - teorico;
      dias.push({
        fecha,
        trabajadoMin: trabajado,
        teoricoMin: teorico,
        saldoMin: saldo,
        esFestivo: festivo,
        esAusencia: ausencia,
        extrasMin: festivo || ausencia ? 0 : Math.max(0, trabajado - teorico),
        festivoMin: festivo ? trabajado : 0,
      });
    }

    const totales = dias.reduce(
      (a, d) => ({
        trabajadoMin: a.trabajadoMin + d.trabajadoMin,
        teoricoMin: a.teoricoMin + d.teoricoMin,
        saldoMin: a.saldoMin + d.saldoMin,
        extrasMin: a.extrasMin + d.extrasMin,
        festivoMin: a.festivoMin + d.festivoMin,
      }),
      { trabajadoMin: 0, teoricoMin: 0, saldoMin: 0, extrasMin: 0, festivoMin: 0 },
    );
    return { personaId, desde, hasta, dias, totales };
  });
}
