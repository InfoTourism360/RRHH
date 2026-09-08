import { useEffect, useState } from 'react';
import { api } from '../api';
import { Cargando, Tarjeta, fechaLarga } from '../ui';

interface Festivo { id: string; fecha: string; denominacion: string; ambito: string }
interface Solicitud { id: string; tipo: string; fecha_inicio: string; fecha_fin: string; estado: string }

const AMBITO: Record<string, string> = { NACIONAL: 'Nacional', AUTONOMICO: 'Autonómico', LOCAL: 'Local' };

export function MiCalendario() {
  const anio = new Date().getFullYear();
  const [festivos, setFestivos] = useState<Festivo[] | null>(null);
  const [ausencias, setAusencias] = useState<Solicitud[] | null>(null);

  useEffect(() => {
    api.get<Festivo[]>(`/ausencias/festivos?anio=${anio}`).then(setFestivos).catch(() => setFestivos([]));
    api.get<Solicitud[]>('/ausencias/solicitudes/mias')
      .then((s) => setAusencias(s.filter((x) => x.estado === 'APROBADA'))).catch(() => setAusencias([]));
  }, [anio]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mi calendario {anio}</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Festivos del año">
          {!festivos ? <Cargando /> : (
            <ul className="space-y-1">
              {festivos.map((f) => (
                <li key={f.id} className="flex justify-between gap-4">
                  <span>{fechaLarga(f.fecha)}</span>
                  <span className="text-gray-600 whitespace-nowrap">{f.denominacion} · {AMBITO[f.ambito]}</span>
                </li>
              ))}
              {festivos.length === 0 && <li className="text-gray-600">Sin festivos configurados.</li>}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Mis ausencias aprobadas">
          {!ausencias ? <Cargando /> : ausencias.length === 0 ? (
            <p className="text-gray-600">No tienes ausencias aprobadas.</p>
          ) : (
            <ul className="space-y-1">
              {ausencias.map((a) => (
                <li key={a.id} className="flex justify-between gap-4">
                  <span>{a.fecha_inicio} → {a.fecha_fin}</span>
                  <span className="text-gray-600">{a.tipo}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
