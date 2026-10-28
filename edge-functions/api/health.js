// edge-functions/api/health.js — 健康检查：函数存活 + KV 可读 + FAQ 已打包
import faqData from './faq.js';

export default async function onRequest(context) {
  const kv = context?.env?.MY_KV ?? globalThis.MY_KV ?? globalThis.my_kv;
  let kvOk = false;
  try {
    await kv?.get('health_check');
    kvOk = !!kv;
  } catch {
    kvOk = false;
  }
  return new Response(
    JSON.stringify({
      ok: true,
      kv: kvOk,
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
