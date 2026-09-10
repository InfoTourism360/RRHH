import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Cargando, Tarjeta, Alerta, Etiqueta, minAHoras } from '../ui';
import { FicharWidget } from '../FicharWidget';

interface SaldoDia { tipo: string; denominacion: string; disponible: number }
interface Panel {
  sinFicha?: boolean;
  saldoHorarioMesMin: number;
  diasDisponibles: SaldoDia[];
  solicitudesPendientes: number;
  documentos: number;
}
interface Noti { id: string; tipo: string; mensaje: string; creado_en: string; leida_en: string | null }

function Metrica({ etiqueta, valor, pie, tono }: { etiqueta: string; valor: string; pie?: string; tono?: 'ok' | 'warn' }) {
  const punto = tono === 'ok' ? 'bg-exito' : tono === 'warn' ? 'bg-aviso' : 'bg-marca-500';
  return (
    <div className="bg-white rounded-xl2 border border-linea shadow-tarjeta p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-apagado uppercase tracking-wide">
        <span className={`w-1.5 h-1.5 rounded-full ${punto}`} aria-hidden="true" />{etiqueta}
      </div>
      <div className="num text-[28px] leading-none font-bold mt-2.5">{valor}</div>
      {pie && <div className="text-xs text-tenue mt-1.5">{pie}</div>}
    </div>
  );
}

export function Inicio() {
  const [p, setP] = useState<Panel | null>(null);
  const [notis, setNotis] = useState<Noti[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { setP(await api.get<Panel>('/portal/inicio')); } catch { setError('No se pudo cargar el panel.'); }
    try { setNotis(await api.get<Noti[]>('/horario/notificaciones')); } catch { /* opcional */ }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  if (error) return <Alerta tipo="error">{error}</Alerta>;
  if (!p) return <Cargando texto="Cargando tu espacio…" />;

  if (p.sinFicha) {
    return (
      <div>
        <h1 className="text-[26px] font-extrabold mb-1">Mi espacio</h1>
        <p className="text-apagado mb-6">Autoservicio del empleado.</p>
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
      <h1 className="text-[26px] font-extrabold mb-1">Mi espacio</h1>
      <p className="text-apagado mb-6">Tu jornada, tus ausencias y tus documentos.</p>

      {sinLeer.length > 0 && (
        <div className="mb-6">
          <Alerta tipo="info">
            <strong>{sinLeer.length} aviso{sinLeer.length > 1 ? 's' : ''} sin leer.</strong>{' '}
            {sinLeer[0]!.mensaje}{' '}
            <Link to="/avisos" className="underline font-semibold">Ver todos</Link>
          </Alerta>
        </div>
      )}

      <div className="mb-6">
        <Tarjeta titulo="Fichar">
          <FicharWidget onFichado={cargar} />
        </Tarjeta>
      </div>

      <section aria-label="Mis indicadores" className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Metrica etiqueta="Saldo horario del mes" valor={minAHoras(saldo)}
                 pie="frente a la jornada teórica" tono={saldo >= 0 ? 'ok' : 'warn'} />
        <Metrica etiqueta="Solicitudes pendientes" valor={String(p.solicitudesPendientes)}
                 pie="en trámite" tono={p.solicitudesPendientes ? 'warn' : 'ok'} />
        <Metrica etiqueta="Documentos" valor={String(p.documentos)} pie="disponibles" />
        <Metrica etiqueta="Avisos sin leer" valor={String(sinLeer.length)} tono={sinLeer.length ? 'warn' : 'ok'} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
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

        <Tarjeta titulo="Accesos rápidos">
          <ul className="grid grid-cols-2 gap-3">
            {[
              ['/fichajes', 'Mis fichajes'], ['/ausencias', 'Mis ausencias'],
              ['/calendario', 'Mi calendario'], ['/documentos', 'Mis documentos'],
            ].map(([a, t]) => (
              <li key={a}>
                <Link to={a}
                  className="block rounded-lg border border-linea bg-lienzo hover:bg-marca-50 hover:border-marca-200 px-4 py-3 font-semibold text-sm transition">
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </div>
  );
}
