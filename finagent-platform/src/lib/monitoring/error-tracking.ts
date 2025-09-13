// Error tracking and monitoring utilities
export interface ErrorContext {
  userId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  loadTime: number;
  component: string;
  symbol?: string;
  timestamp: number;
}

class ErrorTracker {
  private isProduction = process.env.NODE_ENV === 'production';
  private userId?: string;

  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Log error with context for debugging and monitoring
   */
  logError(error: Error, context: ErrorContext = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userId: context.userId || this.userId,
      component: context.component,
      action: context.action,
      metadata: context.metadata,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    };

    // Always log to console in development
    if (!this.isProduction) {
      console.error('Error tracked:', errorData);
    }

    // In production, send to monitoring service
    if (this.isProduction) {
      this.sendToMonitoringService(errorData);
    }

    // Store locally for debugging
    this.storeErrorLocally(errorData);
  }

  /**
   * Log API errors with request/response context
   */
  logApiError(error: Error, endpoint: string, method: string, status?: number) {
    this.logError(error, {
      component: 'API',
      action: `${method} ${endpoint}`,
      metadata: {
        endpoint,
        method,
        status,
      },
    });
  }

  /**
   * Log chart-specific errors
   */
  logChartError(error: Error, symbol: string, action: string) {
    this.logError(error, {
      component: 'TradingViewChart',
      action,
      metadata: {
        symbol,
      },
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metrics: PerformanceMetrics) {
    const performanceData = {
      ...metrics,
      timestamp: Date.now(),
      userId: this.userId,
    };

    if (!this.isProduction) {
      console.log('Performance tracked:', performanceData);
    }

    if (this.isProduction) {
      this.sendPerformanceMetrics(performanceData);
    }
  }

  /**
   * Track chart load time
   */
  trackChartLoad(symbol: string, loadTime: number) {
    this.trackPerformance({
      component: 'TradingViewChart',
      loadTime,
      symbol,
      timestamp: Date.now(),
    });
  }

  private sendToMonitoringService(errorData: any) {
    // Placeholder for actual error reporting service
    // e.g., Sentry, Bugsnag, DataDog, etc.
    try {
      if (typeof window !== 'undefined') {
        // Client-side error reporting
        fetch('/api/monitoring/error', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(errorData),
        }).catch(err => {
          console.warn('Failed to send error to monitoring service:', err);
        });
      }
    } catch (err) {
      console.warn('Error reporting failed:', err);
    }
  }

  private sendPerformanceMetrics(performanceData: any) {
    // Placeholder for performance monitoring
    try {
      if (typeof window !== 'undefined') {
        fetch('/api/monitoring/performance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(performanceData),
        }).catch(err => {
          console.warn('Failed to send performance metrics:', err);
        });
      }
    } catch (err) {
      console.warn('Performance tracking failed:', err);
    }
  }

  private storeErrorLocally(errorData: any) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const errors = JSON.parse(localStorage.getItem('finagent_errors') || '[]');
        errors.push(errorData);
        
        // Keep only last 10 errors
        const recentErrors = errors.slice(-10);
        localStorage.setItem('finagent_errors', JSON.stringify(recentErrors));
      }
    } catch (err) {
      console.warn('Failed to store error locally:', err);
    }
  }

  /**
   * Get stored errors for debugging
   */
  getStoredErrors(): any[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return JSON.parse(localStorage.getItem('finagent_errors') || '[]');
      }
    } catch (err) {
      console.warn('Failed to retrieve stored errors:', err);
    }
    return [];
  }

  /**
   * Clear stored errors
   */
  clearStoredErrors() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('finagent_errors');
      }
    } catch (err) {
      console.warn('Failed to clear stored errors:', err);
    }
  }
}

// Singleton instance
export const errorTracker = new ErrorTracker();

// Utility functions
export const trackError = (error: Error, context?: ErrorContext) => {
  errorTracker.logError(error, context);
};

export const trackApiError = (error: Error, endpoint: string, method: string, status?: number) => {
  errorTracker.logApiError(error, endpoint, method, status);
};

export const trackChartError = (error: Error, symbol: string, action: string) => {
  errorTracker.logChartError(error, symbol, action);
};

export const trackPerformance = (metrics: PerformanceMetrics) => {
  errorTracker.trackPerformance(metrics);
};

export const trackChartLoad = (symbol: string, loadTime: number) => {
  errorTracker.trackChartLoad(symbol, loadTime);
};