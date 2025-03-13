import {
  pipeline,
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
} from '@huggingface/transformers';

// Cache for storing loaded models and tokenizers
interface ModelCache {
  [modelId: string]: {
    model: any;
    tokenizer: any;
  }
}

// Global variables
let modelCache: ModelCache = {};
let currentModelId: string | null = null;
let isBrowserCompatible = false;
let llmIsLoading = false;
const DEFAULT_MODEL_ID = 'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX';

// Variables to track thinking content
let isThinking = false;
let thinkingBuffer = '';
let normalOutputBuffer = '';

// Check if the model is a chat model that supports chat templates
const isChatModel = (modelId: string): boolean => {
  return modelId.includes('DeepSeek') || modelId.includes('Qwen') || modelId.includes('Phi-3');
};

/**
 * Check if WebGPU or WebGL is supported
 */
export const checkBrowserCompatibility = async (): Promise<boolean> => {
  try {
    // Check for WebGPU support
    if ('gpu' in navigator) {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        console.log('WebGPU is supported');
        isBrowserCompatible = true;
        return true;
      }
    }
    
    // Fallback to check WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (gl) {
      console.log('WebGL2 is supported');
      isBrowserCompatible = true;
      return true;
    }
    
    console.warn('Neither WebGPU nor WebGL2 is supported');
    return false;
  } catch (error) {
    console.error('Error checking browser compatibility:', error);
    return false;
  }
};

/**
 * Initialize the LLM model
 */
export const initializeLLM = async (
  modelId: string = DEFAULT_MODEL_ID,
  progressCallback?: (progress: { status: string; message: string; progress?: number; stage?: string }) => void
): Promise<void> => {
  if (llmIsLoading) {
    return;
  }
  
  // If model is already loaded, use it
  if (modelCache[modelId] && modelCache[modelId].model && modelCache[modelId].tokenizer) {
    currentModelId = modelId;
    if (progressCallback) {
      progressCallback({ 
        status: 'success', 
        message: 'Model already loaded', 
        progress: 100,
        stage: 'complete'
      });
    }
    return;
  }
  
  llmIsLoading = true;
  
  try {
    if (!isBrowserCompatible) {
      const isCompatible = await checkBrowserCompatibility();
      if (!isCompatible) {
        throw new Error('Browser does not support WebGPU or WebGL2');
      }
    }
    
    if (progressCallback) {
      progressCallback({ 
        status: 'loading', 
        message: 'Loading tokenizer...', 
        progress: 0,
        stage: 'tokenizer'
      });
    }
    
    // Load tokenizer
    const tokenizer = await AutoTokenizer.from_pretrained(modelId, {
      progress_callback: (progress: any) => {
        if (progressCallback && progress.progress) {
          progressCallback({
            status: 'loading',
            message: `Loading tokenizer (${Math.round(progress.progress * 100)}%)`,
            progress: progress.progress * 30,
            stage: 'tokenizer'
          });
        }
      },
    });
    
    if (progressCallback) {
      progressCallback({ 
        status: 'loading', 
        message: 'Loading LLM model...', 
        progress: 30,
        stage: 'model'
      });
    }
    
    // Load model
    const model = await AutoModelForCausalLM.from_pretrained(modelId, {
      dtype: 'q4f16',
      device: 'webgpu',
      progress_callback: (progress: any) => {
        if (progressCallback && progress.progress) {
          progressCallback({
            status: 'loading',
            message: `Loading LLM model (${Math.round(progress.progress * 100)}%)`,
            progress: 30 + progress.progress * 50,
            stage: 'model'
          });
        }
      },
    });
    
    if (progressCallback) {
      progressCallback({ 
        status: 'loading', 
        message: 'Warming up model...', 
        progress: 80,
        stage: 'warmup'
      });
    }
    
    // Warm up the model with a small input
    const warmUpInput = tokenizer('Hello, world!');
    await model.generate({ ...warmUpInput, max_new_tokens: 1 });
    
    // Store in cache
    modelCache[modelId] = { model, tokenizer };
    currentModelId = modelId;
    
    if (progressCallback) {
      progressCallback({ 
        status: 'success', 
        message: 'LLM model loaded successfully', 
        progress: 100,
        stage: 'complete'
      });
    }
  } catch (error) {
    console.error('Failed to initialize LLM:', error);
    if (progressCallback) {
      progressCallback({
        status: 'error',
        message: `Failed to load LLM model: ${error instanceof Error ? error.message : String(error)}`,
        stage: 'error'
      });
    }
    throw error;
  } finally {
    llmIsLoading = false;
  }
};

// Simple stopping criteria function
const createStoppingCriteria = () => {
  let shouldStop = false;
  
  const stoppingCriteria = async ({ is_last_iteration }: { is_last_iteration: boolean }) => {
    return is_last_iteration || shouldStop;
  };
  
  // Add methods to control stopping
  stoppingCriteria.interrupt = () => {
    shouldStop = true;
  };
  
  stoppingCriteria.reset = () => {
    shouldStop = false;
  };
  
  return stoppingCriteria;
};

// Create a stopping criteria function when needed
const getStoppingCriteria = (() => {
  let criteria: any = null;
  
  return () => {
    if (!criteria) {
      criteria = createStoppingCriteria();
    }
    return criteria;
  };
})();

// Custom event to emit thinking content
const emitThinkingEvent = (text: string) => {
  const event = new CustomEvent('thinking', { 
    detail: { text }
  });
  window.dispatchEvent(event);
};

/**
 * Generate response from the LLM model
 */
export const generateResponse = async (
  prompt: string,
  modelId: string = DEFAULT_MODEL_ID,
  progressCallback?: (progress: { status: string; message: string; progress?: number; stage?: string }) => void,
  streamCallback?: (token: string) => void
): Promise<string> => {
  // Check if we need to load or switch models
  if (!modelCache[modelId] || currentModelId !== modelId) {
    if (progressCallback) {
      progressCallback({ 
        status: 'loading', 
        message: 'Loading model...', 
        progress: 0,
        stage: 'model-load'
      });
    }
    await initializeLLM(modelId, progressCallback);
  }
  
  const model = modelCache[modelId].model;
  const tokenizer = modelCache[modelId].tokenizer;
  
  if (!model || !tokenizer) {
    throw new Error(`Model ${modelId} failed to load properly`);
  }
  
  try {
    // Reset state variables
    isThinking = false;
    thinkingBuffer = '';
    normalOutputBuffer = '';
    
    // Get and reset stopping criteria
    const stoppingCriteria = getStoppingCriteria();
    stoppingCriteria.reset();
    
    if (progressCallback) {
      progressCallback({ 
        status: 'loading', 
        message: 'Generating response...', 
        progress: 0,
        stage: 'generation'
      });
    }
    
    // Create a callback to capture token output
    const tokenCallbackFunction = (token: string) => {
      // Handle thinking tags
      if (token.includes('<think>')) {
        isThinking = true;
        return;
      } else if (token.includes('</think>')) {
        isThinking = false;
        // Emit complete thinking content
        emitThinkingEvent(thinkingBuffer);
        return;
      }
      
      // If we're in thinking mode, add to thinking buffer
      if (isThinking) {
        thinkingBuffer += token;
        // Emit thinking event periodically
        if (token.includes('\n') || thinkingBuffer.length > 100) {
          emitThinkingEvent(thinkingBuffer);
        }
        return;
      }
      
      // For regular output, add to normal buffer and call the stream callback
      normalOutputBuffer += token;
      
      if (streamCallback) {
        streamCallback(token);
      }
    };
    
    // Create text streamer for token-by-token output
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: tokenCallbackFunction,
    });
    
    // Add thinking tag hint to the prompt to encourage model to use thinking
    let enhancedPrompt = prompt;
    if (!prompt.includes('<think>')) {
      enhancedPrompt = `${prompt}\n\nYou can use <think>...</think> tags to show your thinking process.`;
    }
    
    let inputs;
    
    // Handle different model types appropriately
    if (isChatModel(modelId)) {
      // For chat models, use the chat template
      const messages = [
        { role: 'user', content: enhancedPrompt }
      ];
      
      inputs = tokenizer.apply_chat_template(messages, {
        add_generation_prompt: true,
        return_dict: true,
      });
    } else {
      // For non-chat models (like GPT-2), use a simple prefix format
      inputs = tokenizer(
        `Question: ${enhancedPrompt}\n\nAnswer:`,
        { return_tensors: 'pt' }
      );
    }
    
    // Generate the response - fix stopping_criteria to be an array
    const output = await model.generate({
      ...inputs,
      max_new_tokens: 1024,
      do_sample: true,
      temperature: 0.7,
      top_p: 0.95,
      stopping_criteria: [stoppingCriteria],  // Pass as array
      streamer: streamer,
    });
    
    if (progressCallback) {
      progressCallback({ 
        status: 'success', 
        message: 'Response generated successfully', 
        progress: 100,
        stage: 'complete'
      });
    }
    
    return normalOutputBuffer;
  } catch (error) {
    console.error('Error generating response:', error);
    if (progressCallback) {
      progressCallback({
        status: 'error',
        message: `Error generating response: ${error instanceof Error ? error.message : String(error)}`,
        stage: 'error'
      });
    }
    throw error;
  }
};

/**
 * Get currently loaded model ID
 */
export const getCurrentModelId = (): string | null => {
  return currentModelId;
};

/**
 * Check if a specific model is loaded
 */
export const isModelLoaded = (modelId: string): boolean => {
  return !!modelCache[modelId] && !!modelCache[modelId].model && !!modelCache[modelId].tokenizer;
};

/**
 * Clear a specific model from cache
 */
export const clearModelFromCache = (modelId: string): void => {
  if (modelCache[modelId]) {
    delete modelCache[modelId];
    if (currentModelId === modelId) {
      currentModelId = null;
    }
  }
};

/**
 * Clear all models from cache
 */
export const clearAllModelsFromCache = (): void => {
  modelCache = {};
  currentModelId = null;
}; 