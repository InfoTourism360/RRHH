import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Cargando, Tarjeta, minAHoras } from '../ui';

interface SaldoDia { tipo: string; denominacion: string; disponible: number }
interface Panel {
  sinFicha?: boolean;
  saldoHorarioMesMin: number;
  diasDisponibles: SaldoDia[];
  solicitudesPendientes: number;
  documentos: number;
}

export function Inicio() {
  const [p, setP] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Panel>('/portal/inicio').then(setP).catch(() => setError('No se pudo cargar el panel.'));
  }, []);

  if (error) return <p role="alert" className="text-error">{error}</p>;
  if (!p) return <Cargando />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mi inicio</h1>

      {p.sinFicha ? (
        <Tarjeta titulo="Sin ficha de personal">
          <p>Tu usuario no está vinculado a una ficha de personal. Contacta con Recursos Humanos.</p>
        </Tarjeta>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Tarjeta titulo="Fichar">
            <p className="mb-3 text-gray-700">Registra tu jornada de hoy.</p>
            <Link to="/fichajes" className="inline-block rounded bg-marca text-white font-semibold px-4 py-2 hover:bg-marca-oscuro">
              Ir a fichar
            </Link>
          </Tarjeta>

          <Tarjeta titulo="Saldo horario del mes">
            <p className="text-3xl font-bold" aria-label={`Saldo ${minAHoras(p.saldoHorarioMesMin)}`}>
              {minAHoras(p.saldoHorarioMesMin)}
            </p>
            <p className="text-gray-600 text-sm">respecto a la jornada teórica</p>
          </Tarjeta>

          <Tarjeta titulo="Mis días disponibles">
            <ul className="space-y-1">
              {p.diasDisponibles.map((d) => (
                <li key={d.tipo} className="flex justify-between">
                  <span>{d.denominacion}</span>
                  <span className="font-semibold">{d.disponible}</span>
                </li>
              ))}
              {p.diasDisponibles.length === 0 && <li className="text-gray-600">Sin saldos asignados.</li>}
            </ul>
            <Link to="/ausencias" className="mt-3 inline-block underline text-marca-oscuro">Solicitar ausencia</Link>
          </Tarjeta>

          <Tarjeta titulo="Mis gestiones">
            <ul className="space-y-1">
              <li className="flex justify-between"><span>Solicitudes pendientes</span><span className="font-semibold">{p.solicitudesPendientes}</span></li>
              <li className="flex justify-between"><span>Documentos disponibles</span><span className="font-semibold">{p.documentos}</span></li>
            </ul>
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
