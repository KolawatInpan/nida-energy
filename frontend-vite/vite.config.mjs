import path from 'path';
import fs from 'fs/promises';
import { defineConfig, loadEnv, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      {
        name: 'treat-js-files-as-jsx',
        async transform(code, id) {
          if (!/\/src\/.*\.js$/.test(id)) {
            return null;
          }

          return transformWithEsbuild(code, id, {
            loader: 'jsx',
            jsx: 'automatic',
          });
        },
      },
      react({
        include: /\.[jt]sx?$/,
      }),
    ],
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.js$/,
      exclude: [],
    },
    optimizeDeps: {
      force: true,
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
        plugins: [
          {
            name: 'load-src-js-as-jsx',
            setup(build) {
              build.onLoad({ filter: /src\/.*\.js$/ }, async (args) => {
                const contents = await fs.readFile(args.path, 'utf8');
                return {
                  contents,
                  loader: 'jsx',
                };
              });
            },
          },
        ],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), './src'),
      },
    },
    define: {
      'process.env': env,
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
          modifyVars: {
            '@font-family': 'Chulabhorn',
            '@font-size-base': '20px',
            '@primary-color': '#1F3D7D',
            '@btn-primary-color': '#fff',
            '@btn-primary-bg': '#F36B21',
            '@btn-font-style': 'medium',
            '@border-radius-base': '8px',
            '@btn-height-sm': '100%',
          },
        },
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});