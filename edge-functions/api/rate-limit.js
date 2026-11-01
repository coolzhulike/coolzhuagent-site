// edge-functions/api/rate-limit.js — 基于 EdgeOne Blob 的限流
// Blob 命名空间由平台在首次写入时自动创建，无需在控制台手动绑定。
// IP 配额使用 5 个原子占位对象；全站配额使用“锁 + 计数器”，避免高并发下超发。
import { getStore, PreconditionFailedError } from '@edgeone/pages-blob';

const STORE_NAME = 'coolzhuagent-rate-limit';
const LOCK_TTL_MS = 15000;
const LOCK_RETRIES = 8;

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

function isPreconditionFailed(err) {
  return (
    err instanceof PreconditionFailedError ||
    err?.code === 'PRECONDITION_FAILED' ||
    err?.name === 'PreconditionFailedError'
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reserveGlobal(store, day, limit) {
  const counterKey = `global/${day}`;
  const lockKey = `locks/global/${day}`;

  for (let attempt = 0; attempt < LOCK_RETRIES; attempt++) {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await store.set(lockKey, token, { onlyIfNew: true });
    } catch (err) {
      if (!isPreconditionFailed(err)) throw err;
      const current = await store.get(lockKey, { consistency: 'strong' }).catch(() => null);
      if (current) {
        const startedAt = Number(String(current).split('-')[0]);
        if (Number.isFinite(startedAt) && Date.now() - startedAt > LOCK_TTL_MS) {
          await store.delete(lockKey).catch(() => {});
        }
      }
      await sleep(40 + Math.floor(Math.random() * 80));
      continue;
    }

    try {
      const raw = await store.get(counterKey, { consistency: 'strong' });
      const count = Number(raw) || 0;
      if (count >= limit) {
        return { allowed: false, reason: 'global', globalCount: count };
      }
      const next = count + 1;
      await store.set(counterKey, String(next));
      return { allowed: true, globalCount: next };
    } finally {
      await store.delete(lockKey).catch(() => {});
    }
  }

  throw new Error('global_lock_timeout');
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

  let ipSlot = 0;
  let ipSlotKey = '';
  try {
    for (let i = 1; i <= ipLimit; i++) {
      const key = `ip/${day}/${ipHash}/${i}`;
      try {
        await store.set(key, '1', { onlyIfNew: true });
        ipSlot = i;
        ipSlotKey = key;
        break;
      } catch (err) {
        if (isPreconditionFailed(err)) continue;
        throw err;
      }
    }
  } catch (err) {
    console.error('[chat] limit store read/write failed', errorCode(err));
    return { allowed: false, reason: 'unavailable', retryAfter: 60 };
  }

  if (!ipSlot) {
    return { allowed: false, reason: 'ip', retryAfter };
  }

  let global;
  try {
    global = await reserveGlobal(store, day, globalLimit);
  } catch (err) {
    console.error('[chat] limit store read/write failed', errorCode(err));
    await store.delete(ipSlotKey).catch(() => {});
    return { allowed: false, reason: 'unavailable', retryAfter: 60 };
  }

  if (!global.allowed) {
    await store.delete(ipSlotKey).catch(() => {});
    return { allowed: false, reason: 'global', retryAfter };
  }

  return {
    allowed: true,
    remaining: Math.max(0, ipLimit - ipSlot),
    ipCount: ipSlot,
    globalCount: global.globalCount,
  };
}
