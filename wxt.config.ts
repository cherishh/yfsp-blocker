import { defineConfig } from 'wxt';
import { MATCH_PATTERNS } from './domains';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'YFSP Ad Blocker',
    description: '自动跳过 yfsp.tv / iyf.tv 视频广告',
    version: '0.0.4',
    permissions: ['storage'],
    host_permissions: MATCH_PATTERNS,
  },
});
