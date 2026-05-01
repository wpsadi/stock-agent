import { Hono } from "hono";
import { logger } from "hono/logger";
import modelsData from "./models.json" with { type: "json" };
import { fetch } from "bun";

type RateLimitStats = {
  callCount: number;
  tokenCount: number;
  lastResetMinute: number;
  lastResetDay: number;
};

type ModelConfig = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  rateLimit: {
    callsPerMinute: number;
    tokensPerMinute: number;
    requestsPerMinute: number;
    requestsPerDay: number;
  };
};

const app = new Hono();

app.use( logger() );

const rateLimitStore = new Map<number, RateLimitStats>();
const modelConfigs: ModelConfig[] = [];

const modelsArray = modelsData as { models: ModelConfig[] };

modelsArray.models.forEach( ( model, index ) => {
  modelConfigs.push( model );
  rateLimitStore.set( index, {
    callCount: 0,
    tokenCount: 0,
    lastResetMinute: Date.now(),
    lastResetDay: Date.now(),
  } );
} );

const getTimeKey = () => Math.floor( Date.now() / 60000 );
const getDayKey = () => Math.floor( Date.now() / 86400000 );

const resetIfNeeded = ( index: number ) => {
  const stats = rateLimitStore.get( index );
  if ( !stats ) return;

  const currentMinute = getTimeKey();
  const currentDay = getDayKey();
  const lastResetMinuteKey = Math.floor( stats.lastResetMinute / 60000 );
  const lastResetDayKey = Math.floor( stats.lastResetDay / 86400000 );

  if ( currentMinute !== lastResetMinuteKey ) {
    stats.callCount = 0;
    stats.tokenCount = 0;
    stats.lastResetMinute = Date.now();
  }

  if ( currentDay !== lastResetDayKey ) {
    stats.callCount = 0;
    stats.tokenCount = 0;
    stats.lastResetDay = Date.now();
  }
};

const checkRateLimit = (
  index: number,
  estimatedTokens: number = 100
): { allowed: boolean; reason?: string } => {
  const config = modelConfigs[index];
  const stats = rateLimitStore.get( index );

  if ( !config || !stats ) {
    return { allowed: false, reason: "Instance not found" };
  }

  resetIfNeeded( index );

  if ( stats.callCount >= config.rateLimit.requestsPerMinute ) {
    return {
      allowed: false,
      reason: `RPM limit exceeded: ${stats.callCount}/${config.rateLimit.requestsPerMinute}`,
    };
  }

  if ( stats.tokenCount + estimatedTokens > config.rateLimit.tokensPerMinute ) {
    return {
      allowed: false,
      reason: `TPM limit exceeded: ${stats.tokenCount + estimatedTokens}/${config.rateLimit.tokensPerMinute}`,
    };
  }

  return { allowed: true };
};

const recordUsage = ( index: number, tokensUsed: number = 100 ) => {
  const stats = rateLimitStore.get( index );
  if ( stats ) {
    stats.callCount += 1;
    stats.tokenCount += tokensUsed;
  }
};

const getCapacity = ( index: number ): number => {
  const config = modelConfigs[index];
  const stats = rateLimitStore.get( index );
  if ( !config || !stats ) return 0;

  resetIfNeeded( index );

  const remainingCalls = config.rateLimit.requestsPerMinute - stats.callCount;
  const remainingTokens = config.rateLimit.tokensPerMinute - stats.tokenCount;

  return Math.min( remainingCalls, Math.floor( remainingTokens / 100 ) );
};

const selectBestInstance = ( estimatedTokens: number ): number => {
  let bestIndex = -1;
  let maxCapacity = -1;

  for ( let i = 0; i < modelConfigs.length; i++ ) {
    const check = checkRateLimit( i, estimatedTokens );
    if ( check.allowed ) {
      const capacity = getCapacity( i );
      if ( capacity > maxCapacity ) {
        maxCapacity = capacity;
        bestIndex = i;
      }
    }
  }

  return bestIndex;
};

app.post( "/v1/chat/completions", async ( c ) => {
  try {
    const body = await c.req.json();
    const requestBody = body as Record<string, unknown>;
    const max_tokens =
      typeof requestBody.max_tokens === "number" ? requestBody.max_tokens : 2048;
    const estimatedTokens = Math.ceil( ( max_tokens as number ) * 1.5 );

    // Select instance with best capacity
    const selectedIndex = selectBestInstance( estimatedTokens );

    if ( selectedIndex === -1 ) {
      return c.json(
        {
          error: "All model instances rate limited",
          status: "rate_limited",
        },
        429
      );
    }

    const selectedConfig = modelConfigs[selectedIndex];

    // Ensure the configuration exists (should always be true because selectedIndex is validated)
    if ( !selectedConfig ) {
      return c.json(
        {
          error: `Model configuration missing for index ${selectedIndex}`,
          status: "error",
        },
        500
      );
    }

    console.log(
      `[Instance ${selectedIndex}] Routing to ${selectedConfig.name} (${selectedConfig.id})`
    );

    const response = await fetch(
      `${selectedConfig.baseUrl}/chat/completions`,
      {
        method: "POST",
        proxy:process.env.WEB_PROXY,
        headers: {
          
          "Content-Type": "application/json",
          Authorization: `Bearer ${selectedConfig.apiKey}`,
        },
        
        
        body: JSON.stringify( {
          ...requestBody,
          model: selectedConfig.id,
          max_tokens: max_tokens,
        } ),
      }
    );

    // Record usage on successful response
    if ( response.ok ) {
      recordUsage( selectedIndex, estimatedTokens );
      console.log(
        `[Instance ${selectedIndex}] Success: ~${estimatedTokens} tokens used`
      );
    } else {
      console.error(
        `[Instance ${selectedIndex}] Error: ${response.status} ${response.statusText}`
      );
    }

    return response;
  } catch ( error ) {
    const err = error as Error;
    console.error( "POST /v1/chat/completions error:", err.message, err.stack );
    return c.json(
      {
        error: err.message || "Internal server error",
        status: "error",
      },
      500
    );
  }
} );

app.get( "/health", ( c ) => {
  return c.json( {
    status: "ok",
    timestamp: new Date().toISOString(),
    instances: modelConfigs.length,
    rateLimitStats: Object.fromEntries(
      Array.from( rateLimitStore.entries() ).map( ( [index, stats] ) => [
        `instance-${index}`,
        {
          calls: stats.callCount,
          tokens: stats.tokenCount,
        },
      ] )
    ),
  } );
} );

app.get( "/models", ( c ) => {
  const modelList = modelConfigs.map( ( m, index ) => ( {
    instance: index,
    id: m.id,
    name: m.name,
    rateLimit: m.rateLimit,
  } ) );
  return c.json( { models: modelList } );
} );

app.get( "/stats/:instanceId", ( c ) => {
  const instanceId = parseInt( c.req.param( "instanceId" ), 10 );
  const stats = rateLimitStore.get( instanceId );
  const config = modelConfigs[instanceId];

  if ( !stats || !config || isNaN( instanceId ) ) {
    return c.json( { error: "Instance not found" }, 404 );
  }

  return c.json( {
    instance: instanceId,
    usage: {
      calls: stats.callCount,
      tokens: stats.tokenCount,
    },
    limits: config.rateLimit,
    remaining: {
      calls: Math.max( 0, config.rateLimit.requestsPerMinute - stats.callCount ),
      tokens: Math.max( 0, config.rateLimit.tokensPerMinute - stats.tokenCount ),
    },
  } );
} );

export default app;
