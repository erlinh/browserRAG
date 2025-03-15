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
let useWebGPU = true; // Default to using WebGPU if available

// Variables to track thinking content
let isThinking = false;
let thinkingBuffer = '';
let normalOutputBuffer = '';

// Check if the model is a chat model that supports chat templates
const isChatModel = (modelId: string): boolean => {
  return modelId.includes('DeepSeek') || modelId.includes('Qwen') || modelId.includes('Phi-3');
};

// Check if the model is a Pleias model
const isPleiasModel = (modelId: string): boolean => {
  return modelId.includes('Pleias');
};

/**
 * Set whether to use WebGPU (if available)
 */
export const setUseWebGPU = (enable: boolean): void => {
  useWebGPU = enable;
  // Clear model cache when changing this setting as models need to be reloaded
  clearAllModelsFromCache();
};

/**
 * Get current WebGPU usage setting
 */
export const getUseWebGPU = (): boolean => {
  return useWebGPU;
};

/**
 * Check if WebGPU or WebGL is supported
 */
export const checkBrowserCompatibility = async (): Promise<boolean> => {
  try {
    // Check for WebGPU support if enabled
    if (useWebGPU && 'gpu' in navigator) {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        console.log('WebGPU is supported and enabled');
        isBrowserCompatible = true;
        return true;
      }
    }
    
    // Fallback to check WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (gl) {
      console.log('WebGL2 is supported' + (useWebGPU ? ' (WebGPU was preferred but not available)' : ''));
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
        throw new Error('Browser does not support required graphics capabilities (WebGPU or WebGL2)');
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
          // Clamp progress value between 0 and 1
          const clampedProgress = Math.max(0, Math.min(1, progress.progress));
          progressCallback({
            status: 'loading',
            message: `Loading tokenizer (${Math.round(clampedProgress * 100)}%)`,
            progress: clampedProgress * 30,
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
    
    // Determine which device to use
    // Force WASM (CPU) for Pleias models as they don't work with WebGPU
    const device = isPleiasModel(modelId) 
      ? 'wasm' 
      : (useWebGPU && 'gpu' in navigator ? 'webgpu' : 'wasm');
    
    if (isPleiasModel(modelId) && useWebGPU && 'gpu' in navigator) {
      console.log(`Using WASM (CPU) for ${modelId} instead of WebGPU due to compatibility issues`);
      
      if (progressCallback) {
        progressCallback({
          status: 'loading',
          message: `Using CPU for ${modelId} (WebGPU not compatible)`,
          progress: 35,
          stage: 'model'
        });
      }
    }
    
    try {
      // Load model with the selected device
      const model = await AutoModelForCausalLM.from_pretrained(modelId, {
        dtype: 'q4f16',
        device: device,
        progress_callback: (progress: any) => {
          if (progressCallback && progress.progress) {
            // Clamp progress value between 0 and 1
            const clampedProgress = Math.max(0, Math.min(1, progress.progress));
            progressCallback({
              status: 'loading',
              message: `Loading LLM model (${Math.round(clampedProgress * 100)}%)`,
              progress: 30 + clampedProgress * 50,
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
          message: `LLM model loaded successfully (using ${device})`, 
          progress: 100,
          stage: 'complete'
        });
      }
    } catch (modelError) {
      // If WebGPU failed, show an appropriate error message
      if (device === 'webgpu') {
        console.warn('WebGPU initialization failed. Recommending user enable WebGPU for best performance.');
        
        if (progressCallback) {
          progressCallback({
            status: 'error',
            message: `WebGPU model loading failed. Please enable WebGPU for best performance.`,
            stage: 'error'
          });
        }
        
        throw new Error(`WebGPU model initialization failed. Please enable WebGPU for better performance: ${modelError instanceof Error ? modelError.message : String(modelError)}`);
      }
      
      // Re-throw the error for general handling
      throw modelError;
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

// Create stopping criteria function when needed
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

// Custom event to emit streamed text content
const emitStreamedTextEvent = (text: string) => {
  const event = new CustomEvent('streamedText', { 
    detail: { text }
  });
  window.dispatchEvent(event);
};

/**
 * Construct a prompt for Pleias models
 */
const constructPleiasPrompt = (prompt: string): string => {
  // For Pleias models, we need to format the prompt to include query and sources
  // This is a simplified version, assuming the prompt already has the structure we need
  return prompt.trim();
};

/**
 * Process output from Pleias models
 * Pleias output has a specific format that needs to be parsed
 */
const processPleiasOutput = (output: string): string => {
  // Only extract the meaningful content for UI display
  
  // If the output contains source_analysis_start, we are in the analysis phase
  if (output.includes('<|source_analysis_start|>')) {
    // Extract the part that comes after source_analysis_start tag
    const analysisStartIndex = output.indexOf('<|source_analysis_start|>') + '<|source_analysis_start|>'.length;
    
    // Return just the analysis part (the actual response)
    return output.substring(analysisStartIndex).trim();
  }
  
  // If we're still receiving the beginning part of the response, show a loading indicator
  if (output.includes('<|query_start|>') && !output.includes('<|source_analysis_start|>')) {
    // Still in query or source section, show that we're processing
    return "Processing your query...";
  }
  
  // Default - return the original output if we can't parse it in a specific way
  return output.trim();
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
    try {
      await initializeLLM(modelId, progressCallback);
    } catch (error) {
      // If the model failed to load and it's a Pleias model, provide a more helpful error message
      if (isPleiasModel(modelId)) {
        console.error(`Failed to load Pleias model (${modelId}):`, error);
        
        // Return a user-friendly error message
        return `Failed to load the Pleias model. These models require CPU processing and may be slower. Error details: ${error instanceof Error ? error.message : String(error)}`;
      }
      
      // Re-throw the error for non-Pleias models
      throw error;
    }
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
      
      // For regular output, add to normal buffer
      normalOutputBuffer += token;
      
      // Process the current output - helps with streaming by processing as we go
      const processedOutput = isPleiasModel(modelId) 
        ? processPleiasOutput(normalOutputBuffer)
        : normalOutputBuffer;
      
      // Log streaming for Pleias models to help debugging
      if (isPleiasModel(modelId)) {
        console.log('Processing Pleias output:', processedOutput.substring(0, Math.min(50, processedOutput.length)) + '...');
      }
      
      // First update custom event listeners (for backward compatibility)
      emitStreamedTextEvent(processedOutput);
      
      // Then call the direct callback if provided
      if (streamCallback) {
        streamCallback(processedOutput);
      }
    };
    
    // Create text streamer for token-by-token output
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: tokenCallbackFunction,
    });
    
    let enhancedPrompt = prompt;
    
    // Determine the appropriate prompt format based on the model
    if (isPleiasModel(modelId)) {
      // For Pleias models, we use a different format
      enhancedPrompt = constructPleiasPrompt(prompt);
    } else if (!prompt.includes('<think>')) {
      // Add thinking tag hint for non-Pleias models
      enhancedPrompt = `${prompt}\n\nYou can use <think>...</think> tags to show your thinking process.`;
    }
    
    let inputs;
    
    // Handle different model types appropriately
    if (isPleiasModel(modelId)) {
      // For Pleias models, use direct tokenization
      inputs = tokenizer(enhancedPrompt, { return_tensors: 'pt' });
    } else if (isChatModel(modelId)) {
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
      do_sample: isPleiasModel(modelId) ? false : true, // Use greedy decoding for Pleias
      temperature: isPleiasModel(modelId) ? 0.0 : 0.7, // Use lower temperature for Pleias
      top_p: isPleiasModel(modelId) ? 1.0 : 0.95, // Use different top_p for Pleias
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
    
    // Return the processed output, especially important for Pleias models
    return isPleiasModel(modelId)
      ? processPleiasOutput(normalOutputBuffer)
      : normalOutputBuffer;
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