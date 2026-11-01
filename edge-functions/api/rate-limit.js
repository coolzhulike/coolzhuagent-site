// edge-functions/api/rate-limit.js — 基于 EdgeOne Blob 的限流
// Blob 命名空间由平台在首次写入时自动创建，无需在控制台手动绑定。
//
// 为什么不用“计数器 + 锁”：
// Blob SDK 的 onlyIfNew 条件写在底层对象存储中并不生效（官方类型定义已标注
// deprecated），因此无法用它实现原子锁。这里改用“每次请求写一个唯一标记，
// 再用强一致 list 统计标记数量”的方式：
//   - 顺序请求：第 N 次请求写入后统计到 N，超过配额即拒绝；
//   - 并发请求：每个请求的标记都会被计入，因此放行数不会超过配额；
//   - 被拒绝的请求会删除自己的标记，不占用后续配额。
// 并发突发时可能少放行（fail closed），但不会超发。
import { getStore } from '@edgeone/pages-blob';

const STORE_NAME = 'coolzhuagent-rate-limit';
const MAX_LIST = 1000;

let cachedStore = null;

export function getLimitStore(context) {
  const injected = context?.env?.LIMIT_STORE;
  if (injected && typeof injected.set === 'function') return injected;
  if (cachedStore) return cachedStore;
  try {
    cachedStore = getStore({ name: STORE_NAME, consistency: 'strong' });
    return cachedStore;
  } catch (err) {
    console.error('[chat] limit store init failed', errorCode(err));
    return null;
  }
}

function errorCode(err) {
  return String(err?.code || err?.name || 'unknown').slice(0, 80);
}

async function countMarkers(store, prefix, limit) {
  const { blobs } = await store.list({
    prefix,
    limit: Math.min(limit + 1, MAX_LIST),
    consistency: 'strong',
  });
  return blobs.length;
}

function markerId() {
  if (typeof crypto?.randomUUID === 'function') {
    return `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function reserveRequest({
  store,
  day,
  ipHash,
  ipLimit,
  globalLimit,
  retryAfter,
}) {
  if (!store) {
    return { allowed: false, reason: 'unavailable', retryAfter: 60 };
  }

  const id = markerId();
  const ipKey = `ip/${day}/${ipHash}/${id}`;
  const globalKey = `global/${day}/${id}`;
  let ipWritten = false;
  let globalWritten = false;

  try {
    // 1. 先写本 IP 的请求标记，再统计该 IP 当天的标记数。
    await store.set(ipKey, '1');
    ipWritten = true;
    const ipCount = await countMarkers(store, `ip/${day}/${ipHash}/`, ipLimit);
    if (ipCount > ipLimit) {
      await store.delete(ipKey).catch(() => {});
      return { allowed: false, reason: 'ip', retryAfter };
    }

    // 2. 再写全站标记并统计。若全站已满，撤销本 IP 标记。
    await store.set(globalKey, '1');
    globalWritten = true;
    const globalCount = await countMarkers(store, `global/${day}/`, globalLimit);
    if (globalCount > globalLimit) {
      await store.delete(globalKey).catch(() => {});
      await store.delete(ipKey).catch(() => {});
      return { allowed: false, reason: 'global', retryAfter };
    }

    return {
      allowed: true,
      remaining: Math.max(0, ipLimit - ipCount),
      ipCount,
      globalCount,
    };
  } catch (err) {
    console.error('[chat] limit store read/write failed', errorCode(err));
    if (globalWritten) await store.delete(globalKey).catch(() => {});
    if (ipWritten) await store.delete(ipKey).catch(() => {});
    return { allowed: false, reason: 'unavailable', retryAfter: 60 };
  }
}
