/**
 * Ollama Service
 * 
 * This service provides integration with Ollama's local server.
 * Ollama runs a REST API server on localhost.
 * Default URL: http://localhost:11434
 */

import { ThinkingParser, emitThinkingEvent } from './thinkingParser';

export interface OllamaConfig {
  baseUrl: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: 'http://localhost:11434',
};

let currentConfig: OllamaConfig = { ...DEFAULT_CONFIG };

/**
 * Set Ollama configuration
 */
export const setOllamaConfig = (config: Partial<OllamaConfig>): void => {
  currentConfig = {
    ...currentConfig,
    ...config,
  };
  
  // Save to localStorage for persistence
  localStorage.setItem('ollama_config', JSON.stringify(currentConfig));
};

/**
 * Get Ollama configuration
 */
export const getOllamaConfig = (): OllamaConfig => {
  // Try to load from localStorage
  const saved = localStorage.getItem('ollama_config');
  if (saved) {
    try {
      currentConfig = JSON.parse(saved);
    } catch (error) {
      console.error('Failed to parse saved Ollama config:', error);
    }
  }
  
  return currentConfig;
};

/**
 * Test connection to Ollama
 */
export const testOllamaConnection = async (): Promise<{ success: boolean; message: string; models?: OllamaModel[] }> => {
  try {
    const response = await fetch(`${currentConfig.baseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const models = data.models || [];
    
    return {
      success: true,
      message: `Connected successfully! Found ${models.length} model(s).`,
      models,
    };
  } catch (error) {
    console.error('Ollama connection test failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * List available models from Ollama
 */
export const listOllamaModels = async (): Promise<OllamaModel[]> => {
  try {
    const response = await fetch(`${currentConfig.baseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Failed to list Ollama models:', error);
    throw error;
  }
};

/**
 * Generate text completion using Ollama
 */
export const generateOllamaCompletion = async (
  prompt: string,
  modelId?: string,
  streamCallback?: (token: string) => void,
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
  }
): Promise<string> => {
  try {
    const requestBody = {
      model: modelId || 'llama2',
      prompt: prompt,
      temperature: options?.temperature ?? 0.7,
      num_predict: options?.num_predict ?? 1024,
      top_p: options?.top_p ?? 0.95,
      stream: !!streamCallback,
    };

    const response = await fetch(`${currentConfig.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    // Handle streaming response
    if (streamCallback && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      // Create thinking parser
      const thinkingParser = new ThinkingParser((thinking) => {
        emitThinkingEvent(thinking);
      });

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              
              if (parsed.response) {
                fullResponse += parsed.response;
                
                // Process the response to extract thinking and normal content
                const normalContent = thinkingParser.processToken(parsed.response);
                streamCallback(normalContent);
              }
              
              // Check if generation is done
              if (parsed.done) {
                break;
              }
            } catch (e) {
              console.warn('Failed to parse streaming chunk:', e);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Return only the normal content (without thinking tags)
      return thinkingParser.getNormalBuffer();
    }

    // Handle non-streaming response
    const data = await response.json();
    return data.response || '';
  } catch (error) {
    console.error('Ollama completion error:', error);
    throw error;
  }
};

/**
 * Generate embeddings using Ollama
 */
export const generateOllamaEmbedding = async (
  text: string,
  modelId?: string
): Promise<number[]> => {
  try {
    const response = await fetch(`${currentConfig.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId || 'nomic-embed-text',
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.embedding || [];
  } catch (error) {
    console.error('Ollama embedding error:', error);
    throw error;
  }
};

/**
 * Generate multiple embeddings using Ollama
 */
export const generateOllamaEmbeddings = async (
  texts: string[],
  modelId?: string,
  progressCallback?: (progress: number) => void
): Promise<number[][]> => {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const embedding = await generateOllamaEmbedding(texts[i], modelId);
    embeddings.push(embedding);

    if (progressCallback) {
      progressCallback(Math.round(((i + 1) / texts.length) * 100));
    }
  }

  return embeddings;
};

// Initialize config from localStorage
getOllamaConfig();

