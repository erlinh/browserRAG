import {
  pipeline,
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
} from '@huggingface/transformers';

// Global variables to store the model and tokenizer
let llmModel: any = null;
let tokenizer: any = null;
let isBrowserCompatible = false;
let llmIsLoading = false;
const MODEL_ID = 'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX';

// Variables to track thinking content
let isThinking = false;
let thinkingBuffer = '';
let normalOutputBuffer = '';

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
  progressCallback?: (progress: { status: string; message: string; progress?: number }) => void
): Promise<void> => {
  if (llmIsLoading) {
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
      progressCallback({ status: 'loading', message: 'Loading tokenizer...' });
    }
    
    // Load tokenizer
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, {
      progress_callback: (progress: any) => {
        if (progressCallback && progress.progress) {
          progressCallback({
            status: 'loading',
            message: `Loading tokenizer (${Math.round(progress.progress * 100)}%)`,
            progress: progress.progress * 30,
          });
        }
      },
    });
    
    if (progressCallback) {
      progressCallback({ status: 'loading', message: 'Loading LLM model...', progress: 30 });
    }
    
    // Load model
    llmModel = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
      dtype: 'q4f16',
      device: 'webgpu',
      progress_callback: (progress: any) => {
        if (progressCallback && progress.progress) {
          progressCallback({
            status: 'loading',
            message: `Loading LLM model (${Math.round(progress.progress * 100)}%)`,
            progress: 30 + progress.progress * 50,
          });
        }
      },
    });
    
    if (progressCallback) {
      progressCallback({ status: 'loading', message: 'Warming up model...', progress: 80 });
    }
    
    // Warm up the model with a small input
    const warmUpInput = tokenizer('Hello, world!');
    await llmModel.generate({ ...warmUpInput, max_new_tokens: 1 });
    
    if (progressCallback) {
      progressCallback({ status: 'success', message: 'LLM model loaded successfully', progress: 100 });
    }
  } catch (error) {
    console.error('Failed to initialize LLM:', error);
    if (progressCallback) {
      progressCallback({
        status: 'error',
        message: `Failed to load LLM model: ${error instanceof Error ? error.message : String(error)}`,
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
  streamCallback?: (token: string) => void
): Promise<string> => {
  if (!llmModel || !tokenizer) {
    await initializeLLM();
  }
  
  try {
    // Reset state variables
    isThinking = false;
    thinkingBuffer = '';
    normalOutputBuffer = '';
    
    // Get and reset stopping criteria
    const stoppingCriteria = getStoppingCriteria();
    stoppingCriteria.reset();
    
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
    
    // Format the input for the model
    const messages = [
      { role: 'user', content: enhancedPrompt }
    ];
    
    const inputs = tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true,
    });
    
    // Generate the response
    const output = await llmModel.generate({
      ...inputs,
      max_new_tokens: 1024,
      do_sample: true,
      temperature: 0.7,
      top_p: 0.95,
      streamer,
      stopping_criteria: [stoppingCriteria], // Pass as an array
    });
    
    // Check if we have any normal output
    if (normalOutputBuffer.trim().length === 0) {
      // If no normal output but we have thinking, use the thinking content as the response
      if (thinkingBuffer.trim().length > 0) {
        console.log("No normal output, using thinking content as response");
        normalOutputBuffer = `Based on my analysis: ${thinkingBuffer.split('\n').pop() || thinkingBuffer}`;
      } else {
        normalOutputBuffer = "I couldn't generate a proper response. Please try asking in a different way.";
      }
    }
    
    return normalOutputBuffer;
  } catch (error) {
    console.error('Error generating response:', error);
    throw error;
  }
}; 