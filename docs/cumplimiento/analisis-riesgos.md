# Análisis de riesgos (resumen ejecutivo)

Metodología alineada con MAGERIT. Escala de impacto/probabilidad: Baja/Media/Alta.
Este es el marco; cada entidad lo particulariza a su despliegue.

## Activos principales
- Datos de personal (identificativos, relación de servicio) — **nivel MEDIO**.
- Registros de jornada (fichajes) — **nivel MEDIO** (valor probatorio legal).
- Documentos personales (nóminas) — **nivel MEDIO/ALTO** (dato económico).
- Credenciales y secretos (hashes, semillas TOTP, claves) — **nivel ALTO**.

## Amenazas, riesgo y salvaguardas
| Amenaza | Prob. | Impacto | Salvaguarda implementada | Riesgo residual |
|---|---|---|---|---|
| Fuga de datos entre entidades | Media | Alto | RLS FORZADA por entidad + tests de aislamiento | Bajo |
| Manipulación de fichajes | Media | Alto | Append-only (trigger+REVOKE) + hash-chain | Bajo |
| Robo de credenciales | Media | Alto | Argon2id, MFA TOTP, bloqueo, sesión opaca | Bajo/Medio |
| Acceso no autorizado a funciones | Media | Medio | Roles + `requiereRol`, segregación | Bajo |
| Pérdida de datos | Baja | Alto | Copias con hash + prueba de restauración | Bajo/Medio |
| Interceptación en tránsito | Media | Alto | TLS (proxy) — *forzado pendiente en despliegue* | Medio |
| Acceso físico/lógico al servidor | Baja | Alto | Infra propia (no BaaS) — *hardening pendiente* | Medio |
| Uso de biometría (prohibido) | — | — | No existe: eliminado del diseño | Nulo |

## Tratamiento
Los riesgos residuales **Medio** se reducen con las medidas de despliegue del
[mapa Anexo II](anexo-ii-ens-mapa.md): HTTPS forzado, cifrado de volumen,
bastionado y monitorización. Revisión anual o ante cambios relevantes.
