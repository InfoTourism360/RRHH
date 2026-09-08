import { useEffect, useState, useCallback } from 'react';
import { api, ApiError } from '../api';
import { Alerta, Boton, Cargando, Tarjeta } from '../ui';

interface Evento {
  id: string; tipo: string; origen: string;
  momento_servidor: string; momento_cliente: string | null;
  accion_correccion: string | null; motivo: string | null;
}

const ETIQUETA: Record<string, string> = {
  ENTRADA: 'Entrada', SALIDA: 'Salida', INICIO_PAUSA: 'Inicio de pausa', FIN_PAUSA: 'Fin de pausa',
};

function mesActual() {
  const d = new Date();
  const primero = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { primero, hoy };
}

export function MisFichajes() {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const { primero, hoy } = mesActual();

  const cargar = useCallback(async () => {
    try {
      setEventos(await api.get<Evento[]>(`/horario/fichajes?desde=${primero}&hasta=${hoy}`));
    } catch { setEventos([]); }
  }, [primero, hoy]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function fichar(tipo: string) {
    setMsg(null);
    try {
      await api.post('/horario/fichar', { tipo, origen: 'WEB' });
      setMsg({ tipo: 'exito', texto: `${ETIQUETA[tipo]} registrada correctamente.` });
      await cargar();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo fichar.' });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mis fichajes</h1>

      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}

      <div className="mb-6">
        <Tarjeta titulo="Registrar jornada">
          <div className="flex flex-wrap gap-3" role="group" aria-label="Acciones de fichaje">
            <Boton onClick={() => fichar('ENTRADA')}>Entrada</Boton>
            <Boton onClick={() => fichar('SALIDA')} variante="secundario">Salida</Boton>
            <Boton onClick={() => fichar('INICIO_PAUSA')} variante="secundario">Inicio de pausa</Boton>
            <Boton onClick={() => fichar('FIN_PAUSA')} variante="secundario">Fin de pausa</Boton>
          </div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Movimientos de este mes">
        {!eventos ? <Cargando /> : eventos.length === 0 ? (
          <p className="text-gray-600">Aún no tienes fichajes este mes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">Listado de fichajes del mes en curso, incluidas las correcciones</caption>
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th scope="col" className="py-2 pr-4">Momento</th>
                  <th scope="col" className="py-2 pr-4">Tipo</th>
                  <th scope="col" className="py-2 pr-4">Origen</th>
                  <th scope="col" className="py-2">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => {
                  const esCorr = e.origen === 'CORRECCION';
                  const cuando = new Date(e.momento_cliente ?? e.momento_servidor);
                  return (
                    <tr key={e.id} className={`border-b border-gray-200 ${esCorr ? 'bg-amber-50' : ''}`}>
                      <td className="py-2 pr-4">{cuando.toLocaleString('es-ES')}</td>
                      <td className="py-2 pr-4">{ETIQUETA[e.tipo] ?? e.tipo}</td>
                      <td className="py-2 pr-4">{esCorr ? `Corrección (${e.accion_correccion})` : e.origen}</td>
                      <td className="py-2">{e.motivo ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
