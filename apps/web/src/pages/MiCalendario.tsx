import { useEffect, useState } from 'react';
import { api } from '../api';
import { Cargando, Tarjeta, Etiqueta, fechaLarga, CabeceraPagina } from '../ui';

interface Festivo { id: string; fecha: string; denominacion: string; ambito: string }
interface Solicitud { id: string; tipo: string; fecha_inicio: string; fecha_fin: string; estado: string }

const AMBITO: Record<string, { txt: string; tono: 'marca' | 'neutro' | 'aviso' }> = {
  NACIONAL: { txt: 'Nacional', tono: 'marca' },
  AUTONOMICO: { txt: 'Autonómico', tono: 'neutro' },
  LOCAL: { txt: 'Local', tono: 'aviso' },
};

export function MiCalendario() {
  const anio = new Date().getFullYear();
  const [festivos, setFestivos] = useState<Festivo[] | null>(null);
  const [ausencias, setAusencias] = useState<Solicitud[] | null>(null);

  useEffect(() => {
    api.get<Festivo[]>(`/ausencias/festivos?anio=${anio}`).then(setFestivos).catch(() => setFestivos([]));
    api.get<Solicitud[]>('/ausencias/solicitudes/mias')
      .then((s) => setAusencias(s.filter((x) => x.estado === 'APROBADA'))).catch(() => setAusencias([]));
  }, [anio]);

  const hoy = new Date().toISOString().slice(0, 10);
  const proximos = (festivos ?? []).filter((f) => f.fecha >= hoy);

  return (
    <div>
      <CabeceraPagina titulo={`Mi calendario ${anio}`} descripcion="Calendario laboral de la entidad y tus ausencias aprobadas." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo={`Festivos del año (${festivos?.length ?? 0})`}>
          {!festivos ? <Cargando /> : festivos.length === 0 ? (
            <p className="text-apagado">Sin festivos configurados.</p>
          ) : (
            <ul className="divide-y divide-linea">
              {festivos.map((f) => (
                <li key={f.id} className={`py-2.5 flex flex-wrap items-center justify-between gap-2 ${f.fecha < hoy ? 'opacity-50' : ''}`}>
                  <span className="text-sm">
                    <span className="num font-semibold">{f.fecha}</span>
                    <span className="text-apagado"> · {f.denominacion}</span>
                  </span>
                  <Etiqueta tono={AMBITO[f.ambito]?.tono ?? 'neutro'}>{AMBITO[f.ambito]?.txt ?? f.ambito}</Etiqueta>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <div className="grid gap-4 content-start">
          <Tarjeta titulo="Mis ausencias aprobadas">
            {!ausencias ? <Cargando /> : ausencias.length === 0 ? (
              <p className="text-apagado">No tienes ausencias aprobadas.</p>
            ) : (
              <ul className="divide-y divide-linea">
                {ausencias.map((a) => (
                  <li key={a.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="num text-sm">{a.fecha_inicio} → {a.fecha_fin}</span>
                    <Etiqueta tono="exito">{a.tipo}</Etiqueta>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="Próximo festivo">
            {proximos.length === 0 ? (
              <p className="text-apagado">No quedan festivos este año.</p>
            ) : (
              <>
                <p className="text-lg font-bold">{proximos[0]!.denominacion}</p>
                <p className="text-apagado first-letter:uppercase">{fechaLarga(proximos[0]!.fecha)}</p>
              </>
            )}
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
