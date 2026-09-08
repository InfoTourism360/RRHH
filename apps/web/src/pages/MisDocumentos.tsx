import { useEffect, useState } from 'react';
import { api, descargar, ApiError } from '../api';
import { Alerta, Cargando, Tarjeta } from '../ui';

interface Doc {
  id: string; tipo: string; titulo: string; nombre_fichero: string;
  publicado_en: string; ultima_descarga: string | null;
}
const TIPO: Record<string, string> = { NOMINA: 'Nómina', CERTIFICADO: 'Certificado', COMUNICACION: 'Comunicación', OTRO: 'Otro' };

export function MisDocumentos() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try { setDocs(await api.get<Doc[]>('/portal/documentos')); } catch { setDocs([]); }
  }
  useEffect(() => { void cargar(); }, []);

  async function bajar(d: Doc) {
    setError(null);
    try {
      await descargar(`/portal/documentos/${d.id}/descargar`, d.nombre_fichero);
      await cargar(); // refresca el acuse
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo descargar.');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mis documentos</h1>
      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}
      <Tarjeta titulo="Documentación disponible">
        {!docs ? <Cargando /> : docs.length === 0 ? (
          <p className="text-gray-600">No tienes documentos publicados.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {docs.map((d) => (
              <li key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{d.titulo} <span className="text-gray-500">({TIPO[d.tipo]})</span></p>
                  <p className="text-sm text-gray-600">
                    Publicado el {new Date(d.publicado_en).toLocaleDateString('es-ES')}
                    {d.ultima_descarga
                      ? ` · Descargado el ${new Date(d.ultima_descarga).toLocaleDateString('es-ES')}`
                      : ' · No descargado'}
                  </p>
                </div>
                <button onClick={() => bajar(d)}
                        className="rounded bg-marca text-white font-semibold px-4 py-2 hover:bg-marca-oscuro">
                  Descargar <span className="sr-only">{d.titulo}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
