/**
 * 支持的域名列表
 * 添加新域名时只需在此数组中添加，content script 和 manifest 会自动更新
 */
export const SUPPORTED_DOMAINS = [
  'yfsp.tv',
  'iyf.tv',
];

/** Chrome 扩展 match patterns */
export const MATCH_PATTERNS = SUPPORTED_DOMAINS.map(
  domain => `*://*.${domain}/*`
);
