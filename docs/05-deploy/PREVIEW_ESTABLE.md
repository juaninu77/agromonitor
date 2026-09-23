# Preview estable de AgroMonitor

El entorno de pruebas vive en Vercel y funciona aunque la computadora local esté apagada.

- Proyecto Vercel: `agromonitor`, equipo `juaninu77s-projects`.
- Rama Git de pruebas: `codex/preview`.
- Enlace de la rama: https://agromonitor-git-codex-preview-juaninu77s-projects.vercel.app
- Rama Neon de pruebas: `codex-mapa-campo` (`br-muddy-bread-ahrdgo8k`).
- Base: `neondb`, proyecto Neon `sparkling-morning-18269506`.
- Producción sigue vinculada a la rama Git `main` y a su conexión propia.

## Entrar y probar

1. Abrir el enlace de pruebas. Si Vercel solicita autenticación, entrar con la cuenta que tiene acceso al proyecto.
2. Iniciar sesión en AgroMonitor. La cuenta ficticia existente es `demo.campo@example.invalid`; su contraseña se entrega por un canal privado y no se guarda en Git.
3. Seleccionar `La Alameda · DEMO` para recorrer ganado, potreros, flota y cultivos/forrajes.

Las operaciones se guardan en la rama Neon de pruebas y persisten entre despliegues. Esta rama contiene los datos demo y una copia histórica de otros registros: no es una base pública ni exclusivamente ficticia. Los cambios realizados aquí no se transfieren automáticamente a producción.

## Configuración

Las variables de Vercel con destino exclusivo `Preview` son `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `AUTH_TRUST_HOST`, `PREVIEW_DATABASE_HOST` y `APP_ENV`.

- `DATABASE_URL` usa el endpoint pooled de la rama de pruebas; `DIRECT_URL` usa su endpoint directo. Ambas conexiones requieren TLS.
- `PREVIEW_DATABASE_HOST` identifica el endpoint directo de esa rama.
- Los secretos de sesión de Preview son distintos de producción.
- NextAuth obtiene la URL del despliegue de Vercel; `AUTH_URL` de producción no se hereda en Preview.
- Las variables antiguas de Postgres compartidas con producción quedaron fuera de Preview.
- La acción automática de aprovisionamiento Neon está habilitada solo para producción. Preview utiliza la rama existente indicada arriba.
- Los previews de este proyecto comparten esta base de pruebas; no se crea automáticamente una base distinta para cada rama Git.

## Publicar una nueva versión de pruebas

1. Integrar los cambios revisados en `codex/preview` sin reescribir su historial.
2. Ejecutar `pnpm lint`, `pnpm type-check`, `pnpm test:ci` y `pnpm build` con un entorno correctamente configurado.
3. Publicar la rama y comprobar en Vercel que el nuevo despliegue está `Ready` antes de compartir el enlace.
4. Si el push no genera un despliegue, crearlo explícitamente para `codex/preview` en el entorno Preview.

GitHub Actions valida también los pushes a `codex/preview`. La validación del código y el despliegue son procesos separados: hay que revisar ambos estados.

Antes de una migración, comprobar en Neon el identificador de la rama y ejecutar `pnpm env:check` con las variables de Preview. No ejecutar seeds, resets o migraciones contra producción por usar accidentalmente un archivo de entorno local.

Para publicar en producción, compilar de nuevo desde `main` con sus variables. No promover directamente el artefacto de pruebas, porque fue construido con la configuración y la base de Preview.

## Correo

El despliegue no habilita por sí solo el envío de emails. La recuperación de contraseña sigue requiriendo configurar un proveedor/remitente y completar su integración en la aplicación.
