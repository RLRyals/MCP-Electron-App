/**
 * Retry Strategy Utility
 * Provides retry logic with exponential backoff and circuit breaker patterns
 * for build automation operations
 */

import logger, { logWithCategory, LogCategory } from '../main/logger';
import { BuildError, ErrorHandler } from './error-handler';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier (exponential growth factor) */
  backoffMultiplier?: number;
  /** Jitter factor (0-1) to add randomness to delays */
  jitterFactor?: number;
  /** Timeout for each attempt in milliseconds */
  timeout?: number;
  /** Custom retry condition function */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /** Callback for retry attempts */
  onRetry?: (error: any, attempt: number, delay: number) => void;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  timeout: 300000, // 5 minutes
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: BuildError;
  attempts: number;
  totalDuration: number;
}

/**
 * RetryStrategy class implementing exponential backoff with jitter
 */
export class RetryStrategy {
  private options: Required<RetryOptions>;

  constructor(options: RetryOptions = {}) {
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: BuildError | undefined;
    let attempt = 0;

    while (attempt < this.options.maxAttempts) {
      attempt++;

      try {
        logWithCategory(
          'info',
          LogCategory.GENERAL,
          `Executing operation (attempt ${attempt}/${this.options.maxAttempts})`,
          context
        );

        // Execute with timeout
        const result = await this.executeWithTimeout(fn, this.options.timeout);

        const totalDuration = Date.now() - startTime;

        logWithCategory(
          'info',
          LogCategory.GENERAL,
          `Operation succeeded on attempt ${attempt}`,
          { totalDuration, context }
        );

        return {
          success: true,
          result,
          attempts: attempt,
          totalDuration,
        };
      } catch (error: any) {
        // Classify the error
        const buildError = ErrorHandler.classify(error, context);
        lastError = buildError;

        logWithCategory(
          'warn',
          LogCategory.GENERAL,
          `Operation failed on attempt ${attempt}: ${buildError.getLogMessage()}`,
          { code: buildError.code, context }
        );

        // Check if we should retry
        const shouldRetry =
          attempt < this.options.maxAttempts &&
          ErrorHandler.shouldRetry(buildError) &&
          this.options.shouldRetry(buildError, attempt);

        if (!shouldRetry) {
          logWithCategory(
            'error',
            LogCategory.GENERAL,
            'No more retries, operation failed',
            { attempts: attempt, error: buildError.getLogMessage() }
          );

          ErrorHandler.logError(buildError);

          return {
            success: false,
            error: buildError,
            attempts: attempt,
            totalDuration: Date.now() - startTime,
          };
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);

        logWithCategory(
          'info',
          LogCategory.GENERAL,
          `Retrying in ${delay}ms...`,
          { attempt, delay, context }
        );

        // Call retry callback
        this.options.onRetry(buildError, attempt, delay);

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // Max attempts reached
    const totalDuration = Date.now() - startTime;

    if (lastError) {
      ErrorHandler.logError(lastError);
    }

    return {
      success: false,
      error: lastError,
      attempts: attempt,
      totalDuration,
    };
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: initialDelay * (multiplier ^ (attempt - 1))
    const exponentialDelay =
      this.options.initialDelay * Math.pow(this.options.backoffMultiplier, attempt - 1);

    // Cap at maximum delay
    const cappedDelay = Math.min(exponentialDelay, this.options.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.options.jitterFactor * (Math.random() * 2 - 1);

    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update retry options
   */
  setOptions(options: Partial<RetryOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Circuit breaker state
 */
export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, rejecting requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Time in milliseconds to wait before attempting recovery */
  resetTimeout?: number;
  /** Number of successful calls needed to close circuit from half-open */
  successThreshold?: number;
  /** Time window in milliseconds for counting failures */
  monitoringWindow?: number;
  /** Callback when circuit opens */
  onOpen?: () => void;
  /** Callback when circuit closes */
  onClose?: () => void;
  /** Callback when circuit enters half-open state */
  onHalfOpen?: () => void;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  successThreshold: 2,
  monitoringWindow: 120000, // 2 minutes
  onOpen: () => {},
  onClose: () => {},
  onHalfOpen: () => {},
};

/**
 * Failure record
 */
interface FailureRecord {
  timestamp: number;
  error: BuildError;
}

/**
 * CircuitBreaker class to prevent cascading failures
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: FailureRecord[] = [];
  private successCount: number = 0;
  private openTimestamp: number = 0;
  private options: Required<CircuitBreakerOptions>;
  private name: string;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.options = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      // Check if we should try half-open
      if (Date.now() - this.openTimestamp >= this.options.resetTimeout) {
        this.transitionToHalfOpen();
      } else {
        throw new Error(
          `Circuit breaker "${this.name}" is OPEN. Service is temporarily unavailable.`
        );
      }
    }

    try {
      const result = await fn();

      // Record success
      this.onSuccess();

      return result;
    } catch (error: any) {
      // Classify and record failure
      const buildError = ErrorHandler.classify(error);
      this.onFailure(buildError);

      throw buildError;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      logWithCategory(
        'info',
        LogCategory.GENERAL,
        `Circuit breaker "${this.name}" success in HALF_OPEN state (${this.successCount}/${this.options.successThreshold})`
      );

      if (this.successCount >= this.options.successThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Clean up old failures
      this.cleanupOldFailures();
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: BuildError): void {
    const now = Date.now();

    // Record failure
    this.failures.push({
      timestamp: now,
      error,
    });

    logWithCategory(
      'warn',
      LogCategory.GENERAL,
      `Circuit breaker "${this.name}" recorded failure`,
      { state: this.state, failureCount: this.failures.length }
    );

    // Clean up old failures
    this.cleanupOldFailures();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open should open the circuit
      this.transitionToOpen();
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we've exceeded threshold
      if (this.failures.length >= this.options.failureThreshold) {
        this.transitionToOpen();
      }
    }
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.openTimestamp = Date.now();
    this.successCount = 0;

    logWithCategory(
      'error',
      LogCategory.GENERAL,
      `Circuit breaker "${this.name}" transitioned to OPEN state`,
      { failureCount: this.failures.length, resetTimeout: this.options.resetTimeout }
    );

    this.options.onOpen();
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successCount = 0;

    logWithCategory(
      'info',
      LogCategory.GENERAL,
      `Circuit breaker "${this.name}" transitioned to HALF_OPEN state (testing recovery)`
    );

    this.options.onHalfOpen();
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.successCount = 0;
    this.openTimestamp = 0;

    logWithCategory(
      'info',
      LogCategory.GENERAL,
      `Circuit breaker "${this.name}" transitioned to CLOSED state (service recovered)`
    );

    this.options.onClose();
  }

  /**
   * Clean up failures outside the monitoring window
   */
  private cleanupOldFailures(): void {
    const now = Date.now();
    const cutoff = now - this.options.monitoringWindow;

    this.failures = this.failures.filter((f) => f.timestamp >= cutoff);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count in current window
   */
  getFailureCount(): number {
    this.cleanupOldFailures();
    return this.failures.length;
  }

  /**
   * Get recent failures
   */
  getRecentFailures(): FailureRecord[] {
    this.cleanupOldFailures();
    return [...this.failures];
  }

  /**
   * Force reset the circuit breaker
   */
  reset(): void {
    logWithCategory(
      'info',
      LogCategory.GENERAL,
      `Circuit breaker "${this.name}" manually reset`
    );

    this.transitionToClosed();
  }

  /**
   * Check if circuit is allowing requests
   */
  isAllowingRequests(): boolean {
    if (this.state === CircuitState.OPEN) {
      // Check if we should try half-open
      if (Date.now() - this.openTimestamp >= this.options.resetTimeout) {
        return true;
      }
      return false;
    }
    return true;
  }
}

/**
 * Retry with circuit breaker
 */
export class RetryWithCircuitBreaker {
  private retryStrategy: RetryStrategy;
  private circuitBreaker: CircuitBreaker;

  constructor(
    name: string,
    retryOptions: RetryOptions = {},
    circuitBreakerOptions: CircuitBreakerOptions = {}
  ) {
    this.retryStrategy = new RetryStrategy(retryOptions);
    this.circuitBreaker = new CircuitBreaker(name, circuitBreakerOptions);
  }

  /**
   * Execute function with both retry and circuit breaker
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<RetryResult<T>> {
    // Check circuit breaker first
    if (!this.circuitBreaker.isAllowingRequests()) {
      const error = ErrorHandler.createError(
        BuildErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        new Error('Circuit breaker is open'),
        context
      );

      return {
        success: false,
        error,
        attempts: 0,
        totalDuration: 0,
      };
    }

    // Execute with retry through circuit breaker
    return this.retryStrategy.execute(
      () => this.circuitBreaker.execute(fn),
      context
    );
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.circuitBreaker.getFailureCount();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(): void {
    this.circuitBreaker.reset();
  }
}

// Import BuildErrorCode for the RetryWithCircuitBreaker class
import { BuildErrorCode } from './error-handler';
