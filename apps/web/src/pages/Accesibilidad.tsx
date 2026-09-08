// Borrador de Declaración de Accesibilidad conforme al RD 1112/2018.
// Los campos entre corchetes los completa cada entidad al publicar.
export function Accesibilidad() {
  return (
    <main id="contenido" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8 outline-none">
      <h1 className="text-2xl font-bold mb-4">Declaración de accesibilidad</h1>
      <p className="mb-4">
        [Nombre de la entidad] se ha comprometido a hacer accesible su portal del empleado de
        conformidad con el Real Decreto 1112/2018, de 7 de septiembre, sobre accesibilidad de los
        sitios web y aplicaciones para dispositivos móviles del sector público.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Situación de cumplimiento</h2>
      <p className="mb-4">
        Este portal es <strong>parcialmente conforme</strong> con el RD 1112/2018 y la norma
        UNE-EN 301549 (WCAG 2.1 nivel AA) debido a que está en desarrollo activo. Se está
        completando la auditoría con herramientas automáticas (axe) y con navegación exclusiva por teclado.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Contenido no accesible</h2>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>Algunos documentos PDF publicados por terceros (p. ej. recibos de nómina importados) pueden no cumplir todos los criterios de accesibilidad.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">Preparación de la declaración</h2>
      <p className="mb-4">
        Declaración revisada el [fecha]. Método: autoevaluación conforme al artículo 3.1 del RD 1112/2018.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Observaciones y datos de contacto</h2>
      <p className="mb-4">
        Puede comunicar problemas de accesibilidad o solicitar información en formato accesible
        escribiendo a [correo de contacto]. También puede presentar una reclamación conforme al
        procedimiento previsto en el artículo 13 del RD 1112/2018.
      </p>

      <p className="mt-8"><a href="/" className="underline text-marca-oscuro">Volver al inicio</a></p>
    </main>
  );
}
