import { crearApp } from './http/app.js';
import { env } from './config/env.js';

const app = crearApp();
app.listen(env.PORT, () => {
  console.log(`API RRHH escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
