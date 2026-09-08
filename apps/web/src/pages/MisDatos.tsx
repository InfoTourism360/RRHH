import { useEffect, useState } from 'react';
import { api } from '../api';
import { Cargando, Tarjeta } from '../ui';

interface Datos {
  persona: {
    tipo_documento: string; num_documento: string; nombre: string;
    apellido1: string; apellido2: string | null; email_corp: string | null; telefono: string | null;
  } | null;
  puesto: {
    puesto: string; unidad: string; nivel_cd: number;
    tipo_codigo: string; situacion_codigo: string; toma_posesion: string;
  } | null;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null }) {
  return (
    <div className="py-2 border-b border-gray-100">
      <dt className="text-sm text-gray-600">{etiqueta}</dt>
      <dd className="font-medium">{valor ?? '—'}</dd>
    </div>
  );
}

export function MisDatos() {
  const [d, setD] = useState<Datos | null>(null);
  useEffect(() => { api.get<Datos>('/portal/mis-datos').then(setD).catch(() => setD({ persona: null, puesto: null })); }, []);
  if (!d) return <Cargando />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mis datos</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Datos personales">
          {d.persona ? (
            <dl>
              <Dato etiqueta="Nombre" valor={[d.persona.nombre, d.persona.apellido1, d.persona.apellido2].filter(Boolean).join(' ')} />
              <Dato etiqueta="Documento" valor={`${d.persona.tipo_documento} ${d.persona.num_documento}`} />
              <Dato etiqueta="Correo corporativo" valor={d.persona.email_corp} />
              <Dato etiqueta="Teléfono" valor={d.persona.telefono} />
            </dl>
          ) : <p className="text-gray-600">Sin ficha de personal.</p>}
        </Tarjeta>

        <Tarjeta titulo="Puesto y situación">
          {d.puesto ? (
            <dl>
              <Dato etiqueta="Puesto" valor={d.puesto.puesto} />
              <Dato etiqueta="Unidad" valor={d.puesto.unidad} />
              <Dato etiqueta="Nivel (CD)" valor={d.puesto.nivel_cd} />
              <Dato etiqueta="Relación" valor={d.puesto.tipo_codigo} />
              <Dato etiqueta="Situación administrativa" valor={d.puesto.situacion_codigo} />
              <Dato etiqueta="Toma de posesión" valor={d.puesto.toma_posesion} />
            </dl>
          ) : <p className="text-gray-600">Sin relación de servicio vigente.</p>}
          <p className="mt-3 text-sm text-gray-600">
            Para modificar tus datos, contacta con Recursos Humanos.
          </p>
        </Tarjeta>
      </div>
    </div>
  );
}
