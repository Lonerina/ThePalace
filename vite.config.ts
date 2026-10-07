import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

type ClientGeneration = 'LEGACY_V3' | 'REGISTRY_V4';

function resolveClientGeneration(mode: string): ClientGeneration {
  const fromMode =
    mode === 'legacy-v3' ? 'LEGACY_V3' :
    mode === 'registry-v4' ? 'REGISTRY_V4' :
    null;
  const fromEnv = process.env.CLIENT_GENERATION as ClientGeneration | undefined;

  if (fromEnv && fromEnv !== 'LEGACY_V3' && fromEnv !== 'REGISTRY_V4') {
    throw new Error('CLIENT_GENERATION must be LEGACY_V3 or REGISTRY_V4.');
  }
  if (fromMode && fromEnv && fromMode !== fromEnv) {
    throw new Error('Client generation mode and CLIENT_GENERATION disagree.');
  }
  const generation = fromEnv ?? fromMode;
  if (!generation) {
    throw new Error('Client generation must be selected explicitly with --mode legacy-v3/registry-v4 or CLIENT_GENERATION.');
  }
  return generation;
}

function clientGenerationPlugin(generation: ClientGeneration): Plugin {
  const virtualId = 'virtual:client-generation';
  const resolvedVirtualId = '\0virtual:client-generation';
  const implementation = generation === 'LEGACY_V3'
    ? path.resolve(__dirname, 'src/client/legacyGeneration.ts')
    : path.resolve(__dirname, 'src/client/registryV4Generation.ts');

  return {
    name: 'client-generation-gate',
    enforce: 'pre',
    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId;
      return null;
    },
    load(id) {
      if (id !== resolvedVirtualId) return null;
      return `export * from ${JSON.stringify(implementation.replace(/\\/g, '/'))};`;
    },
  };
}

export default defineConfig(({ mode }) => {
  const clientGeneration = resolveClientGeneration(mode);
  return {
    plugins: [clientGenerationPlugin(clientGeneration), react(), tailwindcss()],
    define: {
      __CLIENT_GENERATION__: JSON.stringify(clientGeneration),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
