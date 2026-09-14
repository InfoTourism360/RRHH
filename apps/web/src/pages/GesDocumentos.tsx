import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { api, descargar, ApiError } from '../api';
import { Alerta, Boton, Campo, Selector, Tarjeta, Tabla, type Columna, CabeceraPagina, Cargando } from '../ui';
import { TIPOS_DOC, etiqueta } from '../catalogos';

interface Persona { id: string; nombre: string; apellido1: string; apellido2: string | null; num_documento: string }
interface Doc { id: string; tipo: string; titulo: string; nombre_fichero: string; publicado_en: string; ultima_descarga: string | null }

function leerBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function GesDocumentos() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [tipo, setTipo] = useState('NOMINA');
  const [titulo, setTitulo] = useState('');
  const [fichero, setFichero] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error' | 'aviso'; texto: string } | null>(null);

  useEffect(() => { api.get<Persona[]>('/estructura/personas').then((p) => { setPersonas(p); if (p[0]) setPersonaId(p[0].id); }).catch(() => {}); }, []);

  const cargarDocs = useCallback(async () => {
    if (!personaId) return;
    setDocs(null);
    try { setDocs(await api.get<Doc[]>(`/portal/admin/documentos?personaId=${personaId}`)); } catch { setDocs([]); }
  }, [personaId]);
  useEffect(() => { void cargarDocs(); }, [cargarDocs]);

  async function publicar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!fichero) { setMsg({ tipo: 'error', texto: 'Selecciona un fichero PDF.' }); return; }
    try {
      const contenidoBase64 = await leerBase64(fichero);
      await api.post('/portal/documentos', {
        personaId, tipo, titulo: titulo || fichero.name,
        nombreFichero: fichero.name, mime: fichero.type || 'application/pdf', contenidoBase64,
      });
      setMsg({ tipo: 'exito', texto: 'Documento publicado. El empleado podrá descargarlo (con acuse).' });
      setTitulo(''); setFichero(null);
      (document.getElementById('fichero') as HTMLInputElement | null)?.value && ((document.getElementById('fichero') as HTMLInputElement).value = '');
      await cargarDocs();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo publicar.' });
    }
  }

  async function generarNominaEjemplo() {
    if (!personaId) return;
    setMsg(null);
    try {
      await api.post('/portal/documentos/generar-nomina', { personaId });
      setMsg({
        tipo: 'aviso',
        texto: 'Nómina de ejemplo publicada. Lleva los datos de la persona, pero los importes son ficticios '
             + 'y el PDF sale marcado como tal: no la entregues como recibo de salarios.',
      });
      await cargarDocs();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo generar la nómina.' });
    }
  }

  async function bajarDoc(d: Doc) {
    setMsg(null);
    try {
      await descargar(`/portal/admin/documentos/${d.id}/descargar`, d.nombre_fichero);
    } catch (err) {
      setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo descargar el documento.' });
    }
  }

  const cols: Columna<Doc>[] = [
    { k: 'titulo', txt: 'Título' },
    { k: 'tipo', txt: 'Tipo', render: (d) => etiqueta(TIPOS_DOC, d.tipo) },
    { k: 'publicado_en', txt: 'Publicado', render: (d) => new Date(d.publicado_en).toLocaleDateString('es-ES') },
    { k: 'acuse', txt: 'Acuse de descarga', render: (d) => d.ultima_descarga ? `Descargado ${new Date(d.ultima_descarga).toLocaleDateString('es-ES')}` : 'Pendiente' },
    {
      k: 'acciones',
      txt: 'Acciones',
      render: (d) => (
        <Boton variante="secundario" onClick={() => bajarDoc(d)}>
          Descargar
        </Boton>
      ),
    },
  ];

  return (
    <div>
      <CabeceraPagina
        titulo="Documentos del personal"
        descripcion="Publica documentación personal en PDF. Cada descarga deja acuse de recepción."
      />
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Publicar documento">
          <form onSubmit={publicar} noValidate>
            <Selector etiqueta="Empleado/a" value={personaId} onChange={(e) => setPersonaId(e.target.value)} required>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} {p.apellido1} {p.apellido2 ?? ''} · {p.num_documento}</option>
              ))}
            </Selector>
            <Selector etiqueta="Tipo de documento" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_DOC.map(([c, t]) => <option key={c} value={c}>{t}</option>)}
            </Selector>
            <Campo etiqueta="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} ayuda="Si lo dejas vacío, se usa el nombre del fichero." />
            <div className="mb-4">
              <label htmlFor="fichero" className="block text-sm font-semibold mb-1.5">Fichero (PDF)</label>
              <input id="fichero" type="file" accept="application/pdf"
                     onChange={(e) => setFichero(e.target.files?.[0] ?? null)}
                     className="block w-full text-sm text-apagado file:mr-3 file:rounded-lg file:border-0 file:bg-marca-50 file:text-marca-700 file:px-4 file:py-2 file:font-semibold" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Boton type="submit">Publicar fichero</Boton>
              <Boton type="button" variante="secundario" onClick={generarNominaEjemplo}>
                Generar nómina de ejemplo (PDF)
              </Boton>
            </div>
            <p className="text-xs text-tenue mt-3">
              La nómina de ejemplo usa los datos reales de la persona, pero no calcula importes:
              los devengos y las deducciones son ficticios y el PDF sale marcado con esa advertencia.
              Sirve para ver el formato, no para entregarla.
            </p>
          </form>
        </Tarjeta>

        <Tarjeta titulo="Documentos de la persona seleccionada">
          {!docs ? <Cargando /> : <Tabla columnas={cols} filas={docs} vacio="Sin documentos publicados." />}
        </Tarjeta>
      </div>
    </div>
  );
}
