/**
 * Datetime Context Manager
 * 
 * Ensures all agents and subagents are aware of the current datetime
 * and use it consistently for time-based queries (e.g., "latest" operations).
 */

/**
 * Represents a datetime context snapshot
 */
export interface DatetimeContext {
  isoString: string;           // ISO 8601 format: 2026-05-01T16:51:31.725+05:30
  timestamp: number;            // Unix timestamp in milliseconds
  formattedDate: string;         // Human-readable: May 1, 2026
  formattedTime: string;         // Human-readable: 4:51:31 PM IST
  timezone: string;              // Timezone identifier
  utcOffset: string;             // UTC offset: +05:30
}

/**
 * Get current datetime context snapshot
 * This should be called ONCE at the start of each agent invocation
 * to establish a baseline for all time-dependent operations.
 */
export function getCurrentDatetimeContext(customDateTime?: Date): DatetimeContext {
  const now = customDateTime || new Date();
  const isoString = now.toISOString().replace('Z', '+00:00');
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    timeZoneName: 'short',
  });

  const parts = formatter.formatToParts(now);
  const formattedDate = `${parts.find(p => p.type === 'month')?.value} ${parts.find(p => p.type === 'day')?.value}, ${parts.find(p => p.type === 'year')?.value}`;
  const formattedTime = parts
    .filter(p => ['hour', 'minute', 'second', 'dayPeriod'].includes(p.type))
    .map(p => p.value)
    .join(':')
    .replace(':undefined', '');

  const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'UTC';

  // Calculate UTC offset
  const offset = -now.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const mins = Math.abs(offset) % 60;
  const sign = offset > 0 ? '+' : '-';
  const utcOffset = `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

  return {
    isoString: `${now.toISOString().split('T')[0]}T${now.toTimeString().split(' ')[0]}${utcOffset}`,
    timestamp: now.getTime(),
    formattedDate,
    formattedTime,
    timezone: tzName,
    utcOffset,
  };
}

/**
 * Format a datetime context for agent system prompts
 * Include this in all system prompts to make agents aware of current datetime
 */
export function formatDatetimeContextForPrompt(context: DatetimeContext): string {
  return `
Current Date & Time Information:
- Current Time: ${context.formattedTime} ${context.timezone} (${context.isoString})
- ISO 8601: ${context.isoString}
- Unix Timestamp: ${context.timestamp}

IMPORTANT: When making any time-based queries or filtering (e.g., "latest", "since", "until", "most recent"), 
use this current datetime as the reference point. All subagents should use this same baseline to ensure consistency.
`;
}

/**
 * Create an agent context object that can be passed to subagents
 * This ensures all subagents receive and are aware of the same datetime baseline
 */
export function createAgentContext(datetimeContext: DatetimeContext) {
  return {
    executionTimestamp: datetimeContext.timestamp,
    executionDateTime: datetimeContext.isoString,
    executionTimezone: datetimeContext.timezone,
    contextSnapshot: datetimeContext,
  };
}

/**
 * Parse a custom datetime string and get its context
 * Useful if datetime is provided externally (e.g., from API, CLI args)
 */
export function getContextFromDateString(dateString: string): DatetimeContext {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid datetime string: ${dateString}, using current time`);
      return getCurrentDatetimeContext();
    }
    return getCurrentDatetimeContext(date);
  } catch (error) {
    console.warn(`Error parsing datetime: ${error}, using current time`);
    return getCurrentDatetimeContext();
  }
}
