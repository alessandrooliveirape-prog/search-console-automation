import { logEvent } from "./logger";

export type RetryOptions = {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
};

export async function withRetry<T>(
  actionName: string,
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const backoffFactor = options.backoffFactor ?? 2;

  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt <= maxRetries) {
    try {
      const startTime = Date.now();
      const result = await fn();
      const durationMs = Date.now() - startTime;
      logEvent("system", "INFO", `${actionName} Sucesso`, { durationMs, success: true });
      return result;
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries) {
        logEvent("errors", "ERROR", `${actionName} Falhou após ${maxRetries} tentativas`, {
          success: false,
          error: err,
        });
        throw err;
      }

      // Add jitter to delay
      const jitter = Math.random() * 100;
      const actualDelay = Math.min(delay * backoffFactor + jitter, maxDelayMs);

      logEvent("system", "WARN", `${actionName} Re-tentativa ${attempt}/${maxRetries} em ${Math.round(actualDelay)}ms`, {
        error: err,
      });

      await new Promise((resolve) => setTimeout(resolve, actualDelay));
      delay = actualDelay;
    }
  }

  throw new Error(`${actionName} falhou inesperadamente`);
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(failureThreshold = 5, resetTimeoutMs = 30000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  public getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
      this.state = "HALF_OPEN";
    }
    return this.state;
  }

  public async execute<T>(name: string, fn: () => Promise<T>, fallbackFn?: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === "OPEN") {
      logEvent("errors", "WARN", `CircuitBreaker [${name}] ABERTO - Usando Fallback`, { success: false });
      if (fallbackFn) return await fallbackFn();
      throw new Error(`Circuito [${name}] está ABERTO devido a falhas consecutivas.`);
    }

    try {
      const result = await fn();
      if (currentState === "HALF_OPEN") {
        this.reset();
        logEvent("system", "INFO", `CircuitBreaker [${name}] Recorvado para FECHADO`, { success: true });
      }
      return result;
    } catch (err) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = "OPEN";
        logEvent("errors", "ERROR", `CircuitBreaker [${name}] alterado para ABERTO (${this.failureCount} falhas)`, { error: err });
      }

      if (fallbackFn) {
        logEvent("system", "WARN", `CircuitBreaker [${name}] Falha na execução - Acionando Fallback`, { error: err });
        return await fallbackFn();
      }

      throw err;
    }
  }

  public reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
