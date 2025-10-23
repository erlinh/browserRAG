/**
 * LMStudio Service
 * 
 * This service provides integration with LMStudio's local server.
 * LMStudio runs an OpenAI-compatible API server on localhost.
 * Default URL: http://localhost:1234/v1
 */

export interface LMStudioConfig {
  baseUrl: string;
  apiKey?: string; // Optional, LMStudio usually doesn't require one
}

export interface LMStudioModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

const DEFAULT_CONFIG: LMStudioConfig = {
  baseUrl: 'http://localhost:1234/v1',
  apiKey: '',
};

let currentConfig: LMStudioConfig = { ...DEFAULT_CONFIG };

/**
 * Set LMStudio configuration
 */
export const setLMStudioConfig = (config: Partial<LMStudioConfig>): void => {
  currentConfig = {
    ...currentConfig,
    ...config,
  };
  
  // Save to localStorage for persistence
  localStorage.setItem('lmstudio_config', JSON.stringify(currentConfig));
};

/**
 * Get LMStudio configuration
 */
export const getLMStudioConfig = (): LMStudioConfig => {
  // Try to load from localStorage
  const saved = localStorage.getItem('lmstudio_config');
  if (saved) {
    try {
      currentConfig = JSON.parse(saved);
    } catch (error) {
      console.error('Failed to parse saved LMStudio config:', error);
    }
  }
  
  return currentConfig;
};

/**
 * Test connection to LMStudio
 */
export const testLMStudioConnection = async (): Promise<{ success: boolean; message: string; models?: LMStudioModel[] }> => {
  try {
    const response = await fetch(`${currentConfig.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(currentConfig.apiKey && { 'Authorization': `Bearer ${currentConfig.apiKey}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data || [];
    
    return {
      success: true,
      message: `Connected successfully! Found ${models.length} model(s).`,
      models,
    };
  } catch (error) {
    console.error('LMStudio connection test failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * List available models from LMStudio
 */
export const listLMStudioModels = async (): Promise<LMStudioModel[]> => {
  try {
    const response = await fetch(`${currentConfig.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(currentConfig.apiKey && { 'Authorization': `Bearer ${currentConfig.apiKey}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to list LMStudio models:', error);
    throw error;
  }
};

/**
 * Generate text completion using LMStudio
 */
export const generateLMStudioCompletion = async (
  prompt: string,
  modelId?: string,
  streamCallback?: (token: string) => void,
  options?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  }
): Promise<string> => {
  try {
    const requestBody = {
      model: modelId || 'local-model',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 1024,
      top_p: options?.top_p ?? 0.95,
      stream: !!streamCallback,
    };

    const response = await fetch(`${currentConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(currentConfig.apiKey && { 'Authorization': `Bearer ${currentConfig.apiKey}` }),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`LMStudio request failed: ${response.status} ${response.statusText}`);
    }

    // Handle streaming response
    if (streamCallback && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            // SSE format: "data: {...}"
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              
              // Check for end of stream
              if (data === '[DONE]') {
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  fullResponse += content;
                  streamCallback(fullResponse);
                }
              } catch (e) {
                console.warn('Failed to parse streaming chunk:', e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return fullResponse;
    }

    // Handle non-streaming response
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('LMStudio completion error:', error);
    throw error;
  }
};

/**
 * Generate embeddings using LMStudio
 */
export const generateLMStudioEmbedding = async (
  text: string,
  modelId?: string
): Promise<number[]> => {
  try {
    const response = await fetch(`${currentConfig.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(currentConfig.apiKey && { 'Authorization': `Bearer ${currentConfig.apiKey}` }),
      },
      body: JSON.stringify({
        model: modelId || 'local-model',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`LMStudio embedding request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || [];
  } catch (error) {
    console.error('LMStudio embedding error:', error);
    throw error;
  }
};

/**
 * Generate multiple embeddings using LMStudio
 */
export const generateLMStudioEmbeddings = async (
  texts: string[],
  modelId?: string,
  progressCallback?: (progress: number) => void
): Promise<number[][]> => {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const embedding = await generateLMStudioEmbedding(texts[i], modelId);
    embeddings.push(embedding);

    if (progressCallback) {
      progressCallback(Math.round(((i + 1) / texts.length) * 100));
    }
  }

  return embeddings;
};

// Initialize config from localStorage
getLMStudioConfig();

