import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './Layout';
import { Cargando } from './ui';
import { Login } from './pages/Login';
import { Panel } from './pages/Panel';
import { Inicio } from './pages/Inicio';
import { MisFichajes } from './pages/MisFichajes';
import { MisAusencias } from './pages/MisAusencias';
import { MiCalendario } from './pages/MiCalendario';
import { MisDocumentos } from './pages/MisDocumentos';
import { MisDatos } from './pages/MisDatos';
import { Accesibilidad } from './pages/Accesibilidad';

export function App() {
  const { yo, cargando } = useAuth();

  if (cargando) {
    return <div className="min-h-screen grid place-items-center"><Cargando /></div>;
  }

  if (!yo) {
    return (
      <Routes>
        <Route path="/accesibilidad" element={<Accesibilidad />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const esGestion = yo.roles.some((r) => ['ADMIN_ENTIDAD', 'GESTOR_PERSONAL'].includes(r.rol));

  return (
    <Layout>
      <Routes>
        <Route path="/" element={esGestion ? <Panel /> : <Inicio />} />
        <Route path="/panel" element={<Panel />} />
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/fichajes" element={<MisFichajes />} />
        <Route path="/ausencias" element={<MisAusencias />} />
        <Route path="/calendario" element={<MiCalendario />} />
        <Route path="/documentos" element={<MisDocumentos />} />
        <Route path="/datos" element={<MisDatos />} />
        <Route path="/accesibilidad" element={<Accesibilidad />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
