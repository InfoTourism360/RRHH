// Utilidades de fecha para periodos mensuales. Estaban duplicadas en las dos
// pantallas de jornada (empleado y gestión), con riesgo de divergir.

/** Mes actual en formato `YYYY-MM` (zona local). */
export function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Fecha de hoy en `YYYY-MM-DD` (zona local, sin desplazamiento por UTC). */
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Primer y último día de un mes `YYYY-MM`. */
export function rangoDeMes(mes: string): { desde: string; hasta: string } {
  const [anio, m] = mes.split('-').map(Number);
  const ultimo = new Date(anio!, m!, 0).getDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
}
