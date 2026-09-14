import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Cargando, Tarjeta, Alerta, Etiqueta, Kpi, minAHoras, CabeceraPagina } from '../ui';
import { FicharWidget } from '../FicharWidget';

interface SaldoDia { tipo: string; denominacion: string; disponible: number }
interface JornadaHoy {
  cerradoMin: number;
  abiertaDesde: string | null;
  pausaDesde: string | null;
  teoricoMin: number;
}
interface Panel {
  sinFicha?: boolean;
  saldoHorarioMesMin: number;
  diasDisponibles: SaldoDia[];
  solicitudesPendientes: number;
  documentos: number;
  jornadaHoy: JornadaHoy;
}
interface Noti { id: string; tipo: string; mensaje: string; creado_en: string; leida_en: string | null }

/** Minutos trabajados hoy contando el tramo abierto hasta `ahora`. */
function minutosHoy(j: JornadaHoy, ahora: number): number {
  let m = j.cerradoMin;
  if (j.abiertaDesde) m += (ahora - Date.parse(j.abiertaDesde)) / 60000;
  if (j.pausaDesde) m -= (ahora - Date.parse(j.pausaDesde)) / 60000;
  return Math.max(0, Math.round(m));
}

function BarraJornada({ j }: { j: JornadaHoy }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!j.abiertaDesde) return;
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [j.abiertaDesde]);

  if (j.teoricoMin === 0) {
    return (
      <p className="text-sm text-apagado mt-5 pt-5 border-t border-linea">
        Hoy no tienes jornada teórica según el horario de la entidad. Lo que fiches se registra igualmente.
      </p>
    );
  }

  const hecho = minutosHoy(j, ahora);
  const pct = Math.min(100, Math.round((hecho / j.teoricoMin) * 100));
  const restante = Math.max(0, j.teoricoMin - hecho);
  const exceso = Math.max(0, hecho - j.teoricoMin);
  const completa = hecho >= j.teoricoMin;

  return (
    <div className="mt-5 pt-5 border-t border-linea">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2">
        <h3 className="text-sm font-semibold">Avance de la jornada</h3>
        <p className="text-sm text-apagado">
          <span className="num font-bold text-tinta">{minAHoras(hecho)}</span> de{' '}
          <span className="num">{minAHoras(j.teoricoMin)}</span>
        </p>
      </div>
      <div className="h-2.5 rounded-full bg-lienzo border border-linea overflow-hidden"
           role="progressbar" aria-label="Avance de la jornada de hoy"
           aria-valuemin={0} aria-valuemax={j.teoricoMin} aria-valuenow={Math.min(hecho, j.teoricoMin)}
           aria-valuetext={`${minAHoras(hecho)} de ${minAHoras(j.teoricoMin)}`}>
        <div className={`h-full transition-[width] ${completa ? 'bg-exito' : 'bg-marca-600'}`}
             style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-tenue mt-2">
        {completa
          ? exceso > 0 ? `Jornada cubierta · ${minAHoras(exceso)} por encima.` : 'Jornada cubierta.'
          : `Faltan ${minAHoras(restante)}.`}
        {j.abiertaDesde && !j.pausaDesde && ' Incluye el tramo en curso; el cómputo se cierra al fichar la salida.'}
        {j.pausaDesde && ' El tiempo de pausa no computa.'}
      </p>
    </div>
  );
}

export function Inicio() {
  const [p, setP] = useState<Panel | null>(null);
  const [notis, setNotis] = useState<Noti[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    // En paralelo: antes eran dos round-trips encadenados para pintar el inicio.
    const [panel, avisos] = await Promise.all([
      api.get<Panel>('/portal/inicio').catch(() => null),
      api.get<Noti[]>('/horario/notificaciones').catch(() => [] as Noti[]),
    ]);
    if (panel) setP(panel); else setError('No se pudo cargar el panel.');
    setNotis(avisos);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  if (error) return <Alerta tipo="error">{error}</Alerta>;
  if (!p) return <Cargando texto="Cargando tu espacio…" />;

  if (p.sinFicha) {
    return (
      <div>
        <CabeceraPagina titulo="Mi espacio" descripcion="Autoservicio del empleado." />
        <Tarjeta titulo="Sin ficha de personal">
          <p className="text-apagado">
            Tu usuario no está vinculado a una ficha de personal, así que no puedes fichar ni solicitar
            ausencias. Contacta con Recursos Humanos para que te vinculen.
          </p>
        </Tarjeta>
      </div>
    );
  }

  const sinLeer = notis.filter((n) => !n.leida_en);
  const saldo = p.saldoHorarioMesMin;

  return (
    <div>
      <CabeceraPagina titulo="Mi espacio" descripcion="Tu jornada, tus ausencias y tus documentos." />

      <div className="grid gap-4 lg:grid-cols-12 mb-4">
        <div className="lg:col-span-8">
          <Tarjeta titulo="Mi jornada de hoy"
            accion={<Link to="/fichajes" className="text-sm font-semibold text-marca-700 underline">Ver mis fichajes</Link>}>
            <FicharWidget onFichado={cargar} />
            <BarraJornada j={p.jornadaHoy} />
          </Tarjeta>
        </div>

        <div className="lg:col-span-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 content-start">
          <Kpi etiqueta="Saldo horario del mes" valor={minAHoras(saldo)}
               pie="frente a la jornada teórica" tono={saldo >= 0 ? 'ok' : 'aviso'} />
          <Kpi etiqueta="Solicitudes pendientes" valor={String(p.solicitudesPendientes)}
               pie="en trámite" tono={p.solicitudesPendientes ? 'aviso' : 'ok'} />
          <Kpi etiqueta="Documentos" valor={String(p.documentos)} pie="disponibles" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Tarjeta titulo="Mis días disponibles"
            accion={<Link to="/ausencias" className="text-sm font-semibold text-marca-700 underline">Solicitar</Link>}>
            {p.diasDisponibles.length === 0 ? (
              <p className="text-apagado">Sin saldos asignados para este año.</p>
            ) : (
              <ul className="space-y-3">
                {p.diasDisponibles.map((d) => (
                  <li key={d.tipo} className="flex items-center justify-between gap-4">
                    <span>{d.denominacion}</span>
                    <Etiqueta tono={d.disponible > 0 ? 'marca' : 'neutro'}>
                      <span className="num">{d.disponible}</span> días
                    </Etiqueta>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>

        <div className="lg:col-span-4">
          <Tarjeta titulo="Avisos"
            accion={<Link to="/avisos" className="text-sm font-semibold text-marca-700 underline">Ver todos</Link>}>
            {sinLeer.length === 0 ? (
              <p className="text-apagado">No tienes avisos sin leer.</p>
            ) : (
              <>
                <p className="text-sm font-semibold mb-3">
                  <span className="num">{sinLeer.length}</span> sin leer
                </p>
                <ul className="space-y-2.5">
                  {sinLeer.slice(0, 3).map((n) => (
                    <li key={n.id} className="text-sm border-l-2 border-marca-300 pl-3">{n.mensaje}</li>
                  ))}
                </ul>
              </>
            )}
          </Tarjeta>
        </div>

        <div className="lg:col-span-3">
          <Tarjeta titulo="Accesos rápidos">
            <ul className="space-y-2">
              {[
                ['/fichajes', 'Mis fichajes'], ['/ausencias', 'Mis ausencias'],
                ['/calendario', 'Mi calendario'], ['/documentos', 'Mis documentos'],
              ].map(([a, t]) => (
                <li key={a}>
                  <Link to={a}
                    className="block rounded-lg border border-linea bg-lienzo hover:bg-marca-50 hover:border-marca-200 px-4 py-2.5 font-semibold text-sm transition">
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
