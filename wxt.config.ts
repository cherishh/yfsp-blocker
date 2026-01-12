import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'YFSP Ad Blocker',
    description: '自动跳过 yfsp.tv 视频广告',
    version: '0.0.2',
    permissions: ['storage'],
    host_permissions: ['*://*.yfsp.tv/*'],
  },
});
