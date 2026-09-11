import { useEffect, useState } from 'react';
import { api } from '../api';
import { Cargando, Tarjeta, Etiqueta, CabeceraPagina } from '../ui';
import { TIPOS_RELACION, SITUACIONES, etiqueta } from '../catalogos';

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

function Dato({ etiqueta: et, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-linea last:border-0 flex flex-wrap justify-between gap-2">
      <dt className="text-sm text-apagado">{et}</dt>
      <dd className="font-semibold text-sm text-right">{valor ?? '—'}</dd>
    </div>
  );
}

export function MisDatos() {
  const [d, setD] = useState<Datos | null>(null);
  useEffect(() => {
    api.get<Datos>('/portal/mis-datos').then(setD).catch(() => setD({ persona: null, puesto: null }));
  }, []);
  if (!d) return <Cargando />;

  return (
    <div>
      <CabeceraPagina titulo="Mis datos" descripcion="Consulta de tu ficha y tu situación administrativa." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Datos personales">
          {d.persona ? (
            <dl>
              <Dato etiqueta="Nombre" valor={[d.persona.nombre, d.persona.apellido1, d.persona.apellido2].filter(Boolean).join(' ')} />
              <Dato etiqueta="Documento" valor={<span className="num">{d.persona.tipo_documento} {d.persona.num_documento}</span>} />
              <Dato etiqueta="Correo corporativo" valor={d.persona.email_corp} />
              <Dato etiqueta="Teléfono" valor={d.persona.telefono} />
            </dl>
          ) : <p className="text-apagado">Sin ficha de personal.</p>}
        </Tarjeta>

        <Tarjeta titulo="Puesto y situación">
          {d.puesto ? (
            <dl>
              <Dato etiqueta="Puesto" valor={d.puesto.puesto} />
              <Dato etiqueta="Unidad orgánica" valor={d.puesto.unidad} />
              <Dato etiqueta="Nivel de complemento de destino" valor={<span className="num">{d.puesto.nivel_cd}</span>} />
              <Dato etiqueta="Vínculo" valor={etiqueta(TIPOS_RELACION, d.puesto.tipo_codigo)} />
              <Dato etiqueta="Situación administrativa"
                    valor={<Etiqueta tono={d.puesto.situacion_codigo === 'SERV_ACTIVO' ? 'exito' : 'aviso'}>
                      {etiqueta(SITUACIONES, d.puesto.situacion_codigo)}
                    </Etiqueta>} />
              <Dato etiqueta="Toma de posesión" valor={<span className="num">{d.puesto.toma_posesion}</span>} />
            </dl>
          ) : <p className="text-apagado">Sin relación de servicio vigente.</p>}
        </Tarjeta>
      </div>

      <p className="mt-4 text-sm text-apagado">
        Estos datos son de solo lectura. Para modificarlos, dirígete a Recursos Humanos: cualquier
        cambio queda registrado en el histórico de la entidad.
      </p>
    </div>
  );
}
