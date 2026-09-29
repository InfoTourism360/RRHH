import type { Ejecutor } from '../db/pool.js';

// -----------------------------------------------------------------------------
// Historial de jornada para la demostración.
//
// La siembra no creaba ni un fichaje, así que el módulo de control horario —el
// que sustenta el producto— se abría vacío: ni informes, ni saldos, ni jornada
// en el portal del empleado. Esto le da tres meses de historia creíble.
//
// El reparto no es aleatorio puro: se deriva del identificador de cada persona,
// de modo que dos siembras dan el mismo resultado y una demostración es igual
// que la anterior.
// -----------------------------------------------------------------------------

/** Hash estable de una cadena. Es lo que hace reproducible toda la siembra. */
function hash(semilla: string): number {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) {
    h ^= semilla.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

/** Ruido determinista en [-amplitud, +amplitud] a partir de una semilla textual. */
function desvio(semilla: string, amplitud: number): number {
  return (hash(semilla) % (amplitud * 2 + 1)) - amplitud;
}

const MIN = 60_000;
const hhmm = (d: Date, h: number, m: number) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
};

export interface PersonaJornada {
  personaId: string;
  /** Los de turnos trabajan fines de semana y noches; el resto, oficina. */
  turnos: boolean;
  /**
   * Si se le siembra un olvido de salida. Se desactiva para el empleado con el
   * que se enseña el portal: su pantalla debe verse sana. El olvido lo tienen
   * otros, y la historia de la correccion se cuenta desde el back-office.
   */
  olvidos?: boolean;
}

interface Evento { personaId: string; tipo: string; momento: Date; origen: string }

/**
 * Genera los eventos de `dias` días naturales hacia atrás desde hoy.
 *
 * Oficina: 08:00–15:50 de lunes a viernes con 20 minutos de pausa, o sea las
 *          7,5 h de jornada teórica.
 * Turnos : ciclo de 7 días —dos mañanas, dos tardes, una noche y dos de
 *          libranza—, todos los días de la semana. Cinco turnos de 7,5 h a la
 *          semana son los mismos 2.250 minutos, repartidos entre los siete
 *          días. Así se ve que el cómputo aguanta el turno que cruza la
 *          medianoche y el trabajo en fin de semana sin que el saldo se vaya.
 */
export function generarEventos(personas: PersonaJornada[], dias: number, hasta = new Date()): Evento[] {
  const eventos: Evento[] = [];
  const hoy = new Date(hasta);
  hoy.setHours(0, 0, 0, 0);

  for (const p of personas) {
    // Un desfase por persona para que no entren todos al mismo minuto.
    const base = desvio(p.personaId, 7);
    // Se cuentan los días EFECTIVAMENTE trabajados, no los del calendario: si
    // el olvido se atara a la fecha podría caer en un día que esa persona
    // libra, y entonces no habría olvido ninguno. Ya pasó.
    let trabajados = 0;
    const olvidaEl = p.olvidos === false ? -1 : 8 + (hash(`olvido${p.personaId}`) % 40);

    for (let atras = dias; atras >= 0; atras--) {
      const dia = new Date(hoy);
      dia.setDate(dia.getDate() - atras);
      const semana = dia.getDay();

      if (!p.turnos) {
        if (semana === 0 || semana === 6) continue;
        // Un olvido de salida por persona: da material real a la pantalla de
        // correcciones, que es de las que mejor enseñan la inmutabilidad.
        const olvido = ++trabajados === olvidaEl;
        const entra = hhmm(dia, 8, 0 + base);
        eventos.push({ personaId: p.personaId, tipo: 'ENTRADA', momento: entra, origen: 'QUIOSCO' });
        eventos.push({ personaId: p.personaId, tipo: 'INICIO_PAUSA', momento: hhmm(dia, 11, 0 + base), origen: 'QUIOSCO' });
        eventos.push({ personaId: p.personaId, tipo: 'FIN_PAUSA', momento: hhmm(dia, 11, 20 + base), origen: 'QUIOSCO' });
        if (!olvido) {
          // 08:00 a 15:50 menos 20 min de pausa = 450, la jornada teórica
          // exacta. Si la salida fuese a las 15:30, cada día restaría 20
          // minutos y en tres meses el saldo de toda la plantilla estaría en
          // veinte horas de déficit: parecería un fallo del cómputo.
          const extra = desvio(`${p.personaId}${atras}`, 12);
          eventos.push({
            personaId: p.personaId, tipo: 'SALIDA',
            momento: new Date(hhmm(dia, 15, 50 + base).getTime() + extra * MIN),
            origen: 'QUIOSCO',
          });
        }
        continue;
      }

      // Ciclo de SIETE días: dos mañanas, dos tardes, una noche y dos de
      // libranza. Cinco turnos de 7,5 h son 2.250 minutos a la semana, que es
      // exactamente la jornada teórica repartida entre los siete días. Con el
      // ciclo de seis salían casi seis turnos por semana y el agente acumulaba
      // más de treinta horas de exceso en tres meses: creíble para nadie.
      const fase = (atras + hash(p.personaId)) % 7;
      if (fase >= 5) continue; // libra

      const olvido = ++trabajados === olvidaEl;
      const inicio = fase < 2 ? 6 : fase < 4 ? 14 : 22;
      const entra = hhmm(dia, inicio, base);
      eventos.push({ personaId: p.personaId, tipo: 'ENTRADA', momento: entra, origen: 'QUIOSCO' });
      if (!olvido) {
        eventos.push({
          personaId: p.personaId, tipo: 'SALIDA',
          // 7,5 h; el turno de noche cae en la madrugada del día siguiente.
          // Igual que en oficina, la salida no es clavada: si todo el mundo
          // cerrara al minuto exacto, el saldo de doce agentes saldría con tres
          // valores distintos y se notaría que los datos están generados.
          momento: new Date(entra.getTime() + (450 + desvio(`${p.personaId}s${atras}`, 9)) * MIN),
          origen: 'QUIOSCO',
        });
      }
    }
  }
  // Nadie ficha el futuro: si la demo se siembra a media mañana, el turno de
  // tarde de hoy todavía no ha ocurrido.
  const ahora = new Date(hasta);
  return eventos.filter((e) => e.momento <= ahora).sort((a, b) => a.momento.getTime() - b.momento.getTime());
}

/** Inserta los eventos en bloque. Es el volumen gordo de la siembra. */
export async function sembrarJornada(
  ej: Ejecutor,
  entidadId: string,
  personas: PersonaJornada[],
  dias = 90,
): Promise<number> {
  const eventos = generarEventos(personas, dias);
  if (!eventos.length) return 0;

  // Un solo INSERT con arrays: 60 personas por 90 días son miles de filas y
  // hacerlo de una en una convertiría la siembra en un café.
  await ej.query(
    `INSERT INTO fichaje_evento (entidad_id, persona_id, tipo, origen, momento_servidor)
     SELECT $1, p, t, o, m
       FROM unnest($2::uuid[], $3::text[], $4::text[], $5::timestamptz[]) AS x(p, t, o, m)`,
    [
      entidadId,
      eventos.map((e) => e.personaId),
      eventos.map((e) => e.tipo),
      eventos.map((e) => e.origen),
      eventos.map((e) => e.momento.toISOString()),
    ],
  );
  return eventos.length;
}
