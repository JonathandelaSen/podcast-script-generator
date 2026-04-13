# Podcast Script Generator

Aplicación local-first para convertir entre `1` y `5` fuentes en texto plano en un guión de podcast trazable, editable y generado fase a fase con Gemini.

## Qué hace

- Crea episodios con `topic`, tipo (`summary` o `deep_dive`), duración objetivo y notas editoriales.
- Guarda las fuentes en SQLite local usando `Drizzle`.
- Ejecuta una pipeline manual: `Fuentes -> Extracción -> Consolidación -> Outline -> Guión -> Auditoría`.
- Permite elegir el modelo de Gemini por fase.
- Guarda el contenido original generado, tus ediciones y el historial de versiones.
- Solo deja avanzar usando versiones aprobadas.

## Stack

- `Next.js 16` con App Router
- `Tailwind v4`
- `shadcn/ui` base
- `SQLite local` con `@libsql/client` + `Drizzle ORM`
- `Gemini API` con `@google/genai`

## Setup

1. Copia `.env.example` a `.env.local`.
2. Añade `GEMINI_API_KEY`.
3. Instala dependencias si hace falta con `pnpm install`.
4. Arranca la app:

```bash
pnpm dev
```

La base de datos se crea automáticamente en `data/podcast-script-generator.db`.

## Comandos útiles

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
```

## Flujo recomendado

1. Crea un episodio y pega las fuentes.
2. Genera las extracciones y corrige el JSON por fuente si hace falta.
3. Aprueba cada extracción.
4. Genera consolidación, outline, guión y auditoría, siempre aprobando la fase anterior.
5. Si la auditoría falla, vuelve al guión, edita o regenera, y audita otra vez.

## Notas

- La v1 está pensada para uso local y sin autenticación.
- Las fases intermedias se editan como JSON estructurado.
- El guión se edita como `Markdown locutable`.
