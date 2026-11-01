// edge-functions/api/health.js — 健康检查：函数存活 + Blob 可读 + FAQ 已打包
import faqData from './faq.js';
import { getLimitStore } from './rate-limit.js';

export default async function onRequest(context) {
  const store = getLimitStore(context);
  let storageOk = false;
  try {
    if (store) {
      await store.get('health_check', { consistency: 'strong' });
      storageOk = true;
    }
  } catch {
    storageOk = false;
  }
  return new Response(
    JSON.stringify({
      ok: true,
      storage: storageOk,
      faqItems: (faqData.items || []).length,
      faqVersion: faqData.updatedAt || null,
      ts: new Date().toISOString(),
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}
