// Borrador de Declaración de Accesibilidad conforme al RD 1112/2018.
// Los campos entre corchetes los completa cada entidad al publicar.
export function Accesibilidad() {
  return (
    <main id="contenido" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-10 outline-none">
      <article className="bg-white rounded-xl2 border border-linea shadow-tarjeta p-7 sm:p-9">
        <p className="text-xs font-semibold text-apagado uppercase tracking-wide mb-2">RD 1112/2018</p>
        <h1 className="text-2xl font-extrabold mb-4">Declaración de accesibilidad</h1>
        <p className="mb-4 text-apagado">
          [Nombre de la entidad] se ha comprometido a hacer accesible su portal del empleado de
          conformidad con el Real Decreto 1112/2018, de 7 de septiembre, sobre accesibilidad de los
          sitios web y aplicaciones para dispositivos móviles del sector público.
        </p>

        <h2 className="text-lg font-bold mt-7 mb-2">Situación de cumplimiento</h2>
        <p className="mb-4 text-apagado">
          Este portal es <strong className="text-tinta">parcialmente conforme</strong> con el RD 1112/2018 y la
          norma UNE-EN 301549 (WCAG 2.1 nivel AA), al encontrarse en desarrollo activo. Se está
          completando la auditoría con herramientas automáticas y con navegación exclusiva por teclado.
        </p>

        <h2 className="text-lg font-bold mt-7 mb-2">Contenido no accesible</h2>
        <ul className="list-disc pl-5 mb-4 space-y-1 text-apagado">
          <li>
            Algunos documentos PDF publicados por terceros (por ejemplo, recibos de nómina importados
            del sistema de nómina externo) pueden no cumplir todos los criterios de accesibilidad.
          </li>
        </ul>

        <h2 className="text-lg font-bold mt-7 mb-2">Preparación de la declaración</h2>
        <p className="mb-4 text-apagado">
          Declaración revisada el [fecha]. Método: autoevaluación conforme al artículo 3.1 del RD 1112/2018.
        </p>

        <h2 className="text-lg font-bold mt-7 mb-2">Observaciones y datos de contacto</h2>
        <p className="mb-6 text-apagado">
          Puede comunicar problemas de accesibilidad o solicitar información en formato accesible
          escribiendo a [correo de contacto]. También puede presentar una reclamación conforme al
          procedimiento previsto en el artículo 13 del RD 1112/2018.
        </p>

        <a href="/" className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold bg-marca-600 text-white hover:bg-marca-700 transition">
          Volver al inicio
        </a>
      </article>
    </main>
  );
}
