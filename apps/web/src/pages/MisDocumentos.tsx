import { useCallback, useEffect, useState } from 'react';
import { api, descargar, ApiError } from '../api';
import { Alerta, Boton, Cargando, Etiqueta, Tarjeta } from '../ui';

interface Doc {
  id: string; tipo: string; titulo: string; nombre_fichero: string;
  publicado_en: string; ultima_descarga: string | null;
}
const TIPO: Record<string, string> = {
  NOMINA: 'Nómina', CERTIFICADO: 'Certificado', COMUNICACION: 'Comunicación', OTRO: 'Otro',
};

export function MisDocumentos() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { setDocs(await api.get<Doc[]>('/portal/documentos')); } catch { setDocs([]); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  async function bajar(d: Doc) {
    setError(null);
    try { await descargar(`/portal/documentos/${d.id}/descargar`, d.nombre_fichero); await cargar(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo descargar.'); }
  }

  const pendientes = (docs ?? []).filter((d) => !d.ultima_descarga).length;

  return (
    <div>
      <h1 className="text-[26px] font-extrabold mb-1">Mis documentos</h1>
      <p className="text-apagado mb-6">Documentación personal publicada por Recursos Humanos.</p>
      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}

      <Tarjeta
        titulo={pendientes ? `Documentación (${pendientes} sin descargar)` : 'Documentación disponible'}>
        {!docs ? <Cargando /> : docs.length === 0 ? (
          <p className="text-apagado">No tienes documentos publicados.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {docs.map((d) => (
              <li key={d.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold flex flex-wrap items-center gap-2">
                    {d.titulo}
                    <Etiqueta tono="marca">{TIPO[d.tipo] ?? d.tipo}</Etiqueta>
                    {!d.ultima_descarga && <Etiqueta tono="aviso">Nuevo</Etiqueta>}
                  </p>
                  <p className="text-xs text-tenue mt-0.5">
                    Publicado el {new Date(d.publicado_en).toLocaleDateString('es-ES')}
                    {d.ultima_descarga
                      ? ` · descargado el ${new Date(d.ultima_descarga).toLocaleDateString('es-ES')}`
                      : ' · pendiente de descarga'}
                  </p>
                </div>
                <Boton onClick={() => bajar(d)}>
                  Descargar<span className="sr-only"> {d.titulo}</span>
                </Boton>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-tenue mt-4">
          Cada descarga queda registrada como acuse de recepción.
        </p>
      </Tarjeta>
    </div>
  );
}
