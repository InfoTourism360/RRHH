import { useEffect, useState, useCallback } from 'react';
import { api, ApiError } from '../api';
import { Alerta, Boton, Cargando, Tarjeta, Tabla, Modal, Campo, type Columna, CabeceraPagina } from '../ui';

interface Pendiente {
  id: string; persona_id: string; nombre: string; apellido1: string;
  tipo: string; fecha_inicio: string; fecha_fin: string; dias_computados: string;
}

export function GesAusencias() {
  const [filas, setFilas] = useState<Pendiente[] | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [deneg, setDeneg] = useState<Pendiente | null>(null);
  const [motivo, setMotivo] = useState('');

  const cargar = useCallback(async () => {
    try { setFilas(await api.get<Pendiente[]>('/ausencias/solicitudes/pendientes')); }
    catch { setFilas([]); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  async function aprobar(id: string) {
    setMsg(null);
    try { await api.post(`/ausencias/solicitudes/${id}/aprobar`); setMsg({ tipo: 'exito', texto: 'Solicitud aprobada.' }); await cargar(); }
    catch (e) { setMsg({ tipo: 'error', texto: e instanceof ApiError ? e.message : 'Error al aprobar.' }); }
  }
  async function confirmarDenegar() {
    if (!deneg) return;
    try {
      await api.post(`/ausencias/solicitudes/${deneg.id}/denegar`, { motivo });
      setMsg({ tipo: 'exito', texto: 'Solicitud denegada.' }); setDeneg(null); setMotivo(''); await cargar();
    } catch (e) { setMsg({ tipo: 'error', texto: e instanceof ApiError ? e.message : 'Error al denegar.' }); }
  }

  const cols: Columna<Pendiente>[] = [
    { k: 'persona', txt: 'Empleado/a', render: (f) => `${f.nombre} ${f.apellido1}` },
    { k: 'tipo', txt: 'Tipo' },
    { k: 'periodo', txt: 'Periodo', render: (f) => `${f.fecha_inicio} → ${f.fecha_fin}` },
    { k: 'dias_computados', txt: 'Días', alinear: 'der' },
    {
      k: 'acc', txt: 'Acción', render: (f) => (
        <div className="flex gap-2 justify-end">
          <Boton variante="primario" onClick={() => aprobar(f.id)}>Aprobar</Boton>
          <Boton variante="secundario" onClick={() => setDeneg(f)}>Denegar</Boton>
        </div>
      ), alinear: 'der',
    },
  ];

  return (
    <div>
      <CabeceraPagina titulo="Aprobación de ausencias" descripcion="Solicitudes pendientes de validación en tu ámbito." />
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}

      <Tarjeta titulo="Pendientes">
        {!filas ? <Cargando /> : <Tabla columnas={cols} filas={filas} vacio="No hay solicitudes pendientes. ✨" />}
      </Tarjeta>

      {deneg && (
        <Modal titulo="Denegar solicitud" onCerrar={() => setDeneg(null)}>
          <p className="text-sm text-apagado mb-4">
            {deneg.nombre} {deneg.apellido1} · {deneg.tipo} · {deneg.fecha_inicio} → {deneg.fecha_fin}
          </p>
          <Campo etiqueta="Motivo de la denegación" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                 ayuda="Se comunicará al empleado. Obligatorio." required />
          <div className="flex gap-2 justify-end mt-2">
            <Boton variante="secundario" onClick={() => setDeneg(null)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={confirmarDenegar} disabled={motivo.trim().length < 3}>Denegar</Boton>
          </div>
        </Modal>
      )}
    </div>
  );
}
