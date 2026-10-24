import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, searchForWorkspaceRoot, type Plugin } from 'vite'
import { crearApi } from './server/api.ts'

// Monta /api/* en el mismo servidor de Vite; la llave se lee de .env.local y no llega al navegador.
function apiLocal(env: Record<string, string>): Plugin {
  let api: ReturnType<typeof crearApi>
  const config = (raiz: string) => ({
    apiKey: env.OPENROUTER_API_KEY,
    modeloTranscripcion: env.OPENROUTER_MODELO_TRANSCRIPCION || 'openai/whisper-large-v3-turbo',
    modeloAgente: env.OPENROUTER_MODELO_AGENTE || 'anthropic/claude-sonnet-5.5',
    vexa: { apiKey: env.VEXA_API_KEY, url: env.VEXA_API_URL || 'https://api.cloud.vexa.ai' },
    raiz,
  })
  return {
    name: 'api-local',
    configureServer(server) {
      api = crearApi(config(server.config.root))
      server.middlewares.use((req, res, next) => api(req, res, next))
    },
    configurePreviewServer(server) {
      api = crearApi(config(server.config.root))
      server.middlewares.use((req, res, next) => api(req, res, next))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), apiLocal(loadEnv(mode, process.cwd(), ''))],
  server: {
    fs: {
      // El simulador lee el catálogo directo de ../catalogo-simulado, fuera de esta carpeta.
      allow: [searchForWorkspaceRoot(process.cwd()), '../catalogo-simulado'],
    },
  },
}))
