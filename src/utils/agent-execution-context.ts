/**
 * Agent Execution Context Manager
 * 
 * Ensures all agents execute with a consistent datetime baseline.
 * Should be called at the start of any agent invocation or graph execution.
 */

import { getCurrentDatetimeContext, createAgentContext, type DatetimeContext } from "./datetime-context";

interface AgentExecutionContext {
  datetimeContext: DatetimeContext;
  startTime: number;
  metadata: Record<string, unknown>;
}

let currentExecutionContext: AgentExecutionContext | null = null;

/**
 * Initialize a new agent execution context
 * Call this at the START of your agent workflow or graph execution
 */
export function initializeAgentContext(customDateTime?: Date): AgentExecutionContext {
  const datetimeContext = getCurrentDatetimeContext(customDateTime);
  
  currentExecutionContext = {
    datetimeContext,
    startTime: Date.now(),
    metadata: {
      ...createAgentContext(datetimeContext),
    },
  };

  return currentExecutionContext;
}

/**
 * Get the current execution context
 * This is the same context established at the start of the workflow
 */
export function getCurrentExecutionContext(): AgentExecutionContext | null {
  return currentExecutionContext;
}

/**
 * Get datetime context for the current execution
 */
export function getExecutionDatetimeContext(): DatetimeContext | null {
  return currentExecutionContext?.datetimeContext || null;
}

/**
 * Clear the execution context (call at end of workflow)
 */
export function clearExecutionContext(): void {
  currentExecutionContext = null;
}

/**
 * Get execution elapsed time in milliseconds
 */
export function getExecutionElapsedTime(): number {
  if (!currentExecutionContext) return 0;
  return Date.now() - currentExecutionContext.startTime;
}

/**
 * Log execution status with datetime info
 */
export function logExecutionStatus(status: string, details?: Record<string, unknown>): void {
  const context = currentExecutionContext;
  if (!context) {
    console.log(`[${status}] (No context initialized)`);
    return;
  }

  const elapsed = getExecutionElapsedTime();
  console.log(
    `[${context.datetimeContext.formattedTime}] [${status}] (${elapsed}ms)`,
    details || ""
  );
}
