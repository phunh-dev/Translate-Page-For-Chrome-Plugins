/** Limits concurrency and spaces out request starts for one provider. */
export class Limiter {
  private active = 0;
  private lastStart = 0;
  private readonly queue: (() => void)[] = [];

  constructor(
    private readonly concurrency: number,
    private readonly minIntervalMs = 0,
  ) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    const wait = this.lastStart + this.minIntervalMs - Date.now();
    this.lastStart = Math.max(Date.now(), this.lastStart + this.minIntervalMs);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

/** Providers that hit a rate limit are skipped until their cooldown expires. */
export class Cooldowns {
  private readonly until = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  mark(id: string, ms: number): void {
    this.until.set(id, this.now() + ms);
  }

  isCoolingDown(id: string): boolean {
    const until = this.until.get(id);
    if (until === undefined) return false;
    if (until <= this.now()) {
      this.until.delete(id);
      return false;
    }
    return true;
  }
}
