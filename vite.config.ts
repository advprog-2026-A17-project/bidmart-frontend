import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
function parseEnvValue(filePath: string, key: string): string | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    const equalsIndex = trimmedLine.indexOf('=')
    if (equalsIndex < 0) {
      continue
    }

    const entryKey = trimmedLine.slice(0, equalsIndex).trim()
    if (entryKey !== key) {
      continue
    }

    const entryValue = trimmedLine.slice(equalsIndex + 1).trim()
    return entryValue === '' ? undefined : entryValue
  }

  return undefined
}

export default defineConfig(() => {
  const projectRoot = process.cwd()
  const centralEnvPath = path.resolve(projectRoot, '../bidmart-infrastructure/.env')
  const localEnvPath = path.resolve(projectRoot, '.env')
  const apiBaseUrl = process.env.VITE_API_BASE_URL?.trim()
    || parseEnvValue(centralEnvPath, 'VITE_API_BASE_URL')
    || parseEnvValue(localEnvPath, 'VITE_API_BASE_URL')
    || 'http://localhost:8000'

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})