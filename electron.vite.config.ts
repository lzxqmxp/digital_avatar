import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve('electron/main/index.ts')
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve('electron/preload/index.ts')
      }
    }
  },
  renderer: {
    server: {
      host: '0.0.0.0',
      proxy: {
        '/dylive': {
          target: 'https://live.douyin.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/dylive/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const ua = req.headers['user-agent'] || ''
              const isMobile = /mobile|android|iphone|ipad/i.test(String(ua))
              if (isMobile) {
                proxyReq.setHeader(
                  'User-Agent',
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0'
                )
              }
              proxyReq.setHeader('Referer', 'https://live.douyin.com/')
            })

            proxy.on('proxyRes', (proxyRes) => {
              const setCookie = proxyRes.headers['set-cookie']
              if (!setCookie) {
                return
              }
              const newCookie = setCookie.map((cookie) =>
                cookie
                  .replace(/; Domain=[^;]+/i, '')
                  .replace(/; SameSite=None/i, '')
                  .replace(/; Secure=true/i, '')
              )
              proxyRes.headers['set-cookie'] = newCookie
            })
          }
        },
        '/socket': {
          target: 'wss://webcast100-ws-web-lq.douyin.com',
          changeOrigin: true,
          secure: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/socket/, ''),
          configure: (proxy) => {
            proxy.on('proxyReqWs', (proxyReq, req) => {
              const ua = req.headers['user-agent'] || ''
              const isMobile = /mobile|android|iphone|ipad/i.test(String(ua))
              if (isMobile) {
                proxyReq.setHeader(
                  'User-Agent',
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0'
                )
              }
            })
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
        '@features': resolve('src/features'),
        '@runtime': resolve('runtime')
      }
    },
    plugins: [vue()]
  }
})
