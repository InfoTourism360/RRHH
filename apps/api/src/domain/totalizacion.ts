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

function minutosTrabajados(eventos: EventoEfectivo[]): { presencia: number; pausa: number } {
  let presencia = 0;
  let entrada: Date | null = null;
  let pausa = 0;
  let iniPausa: Date | null = null;
  for (const e of eventos) {
    if (e.tipo === 'ENTRADA') entrada = e.momento;
    else if (e.tipo === 'SALIDA' && entrada) { presencia += (e.momento.getTime() - entrada.getTime()) / 60000; entrada = null; }
    else if (e.tipo === 'INICIO_PAUSA') iniPausa = e.momento;
    else if (e.tipo === 'FIN_PAUSA' && iniPausa) { pausa += (e.momento.getTime() - iniPausa.getTime()) / 60000; iniPausa = null; }
  }
  return { presencia: Math.round(presencia), pausa: Math.round(pausa) };
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
          AND momento_servidor >= $2::date AND momento_servidor < ($3::date + 1)
        ORDER BY momento_servidor`,
      [personaId, desde, hasta],
    );
    const efectivos = resolverEfectivos(r.rows);

    // Agrupa por día local.
    const porDia = new Map<string, EventoEfectivo[]>();
    for (const e of efectivos) {
      const k = fechaLocal(e.momento);
      (porDia.get(k) ?? porDia.set(k, []).get(k)!).push(e);
    }
    // Une los días con eventos y los días de ausencia aprobada (aunque no fichara).
    const clavesDia = new Set<string>([...porDia.keys(), ...(diasAusencia ?? [])]);

    const dias: DiaTotalizado[] = [];
    for (const fecha of [...clavesDia].sort()) {
      const { presencia, pausa } = minutosTrabajados(porDia.get(fecha) ?? []);
      const trabajado = Math.max(0, presencia - pausa);
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
