import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

const logger = new Logger('SentryService');

let isInitialized = false;

/**
 * Initialize Sentry Error Tracking if SENTRY_DSN is provided in environment variables.
 * If SENTRY_DSN is omitted, this operates in graceful dummy mode without any crashes or overhead.
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.log('Sentry DSN not provided. Error tracking running in local logging mode.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    });
    isInitialized = true;
    logger.log('Sentry real-time error tracking initialized successfully.');
  } catch (error) {
    logger.warn('Could not initialize Sentry error tracking:', error);
  }
}

/**
 * Safely captures an exception to Sentry with context metadata
 */
export function captureException(error: unknown, context?: Record<string, any>) {
  if (!isInitialized) return;

  try {
    Sentry.withScope((scope: Sentry.Scope) => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureException(error);
    });
  } catch {
    // Silently ignore tracking error
  }
}
