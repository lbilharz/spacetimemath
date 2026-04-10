const rateCache = new Map<string, { count: number, resetAt: number }>();
let lastCleanup = Date.now();

export function checkRateLimit(key: string, limit: number = 3, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  
  // Periodically clean up expired entries to prevent memory leaks in the Vercel cold-boot container
  if (now - lastCleanup > 60 * 1000) {
    for (const [k, value] of rateCache.entries()) {
      if (now > value.resetAt) rateCache.delete(k);
    }
    lastCleanup = now;
  }

  const record = rateCache.get(key);
  
  if (!record) {
    rateCache.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (now > record.resetAt) {
    rateCache.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count += 1;
  return true;
}
