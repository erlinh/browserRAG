import { pipeline } from '@huggingface/transformers';

let embeddingModel: any = null;
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

/**
 * Initialize the embedding model
 */
export const initializeEmbeddingModel = async (
  progressCallback?: (progress: { status: string; message: string; progress?: number }) => void
): Promise<void> => {
  try {
    if (progressCallback) {
      progressCallback({ status: 'loading', message: 'Loading embedding model...' });
    }
    
    // Create a feature-extraction pipeline
    embeddingModel = await pipeline('feature-extraction', MODEL_NAME);
    
    if (progressCallback) {
      progressCallback({ status: 'success', message: 'Embedding model loaded successfully' });
    }
  } catch (error) {
    console.error('Failed to initialize embedding model:', error);
    if (progressCallback) {
      progressCallback({ 
        status: 'error', 
        message: `Failed to load embedding model: ${error instanceof Error ? error.message : String(error)}`
      });
    }
    throw error;
  }
};

/**
 * Generate embedding for a text
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!embeddingModel) {
    await initializeEmbeddingModel();
  }

  try {
    // Generate embedding
    const output = await embeddingModel(text, { pooling: 'mean', normalize: true });
    
    // Convert to array of numbers from tensor
    return output.tolist()[0];
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw error;
  }
};

/**
 * Generate embeddings for multiple texts
 */
export const generateEmbeddings = async (
  texts: string[],
  progressCallback?: (progress: number) => void
): Promise<number[][]> => {
  if (!embeddingModel) {
    await initializeEmbeddingModel();
  }

  const embeddings: number[][] = [];
  // Smaller batch size for even better memory management
  const batchSize = 3; 

  try {
    let lastYieldTime = Date.now();
    const YIELD_INTERVAL = 50; // Yield every 50ms

    for (let i = 0; i < texts.length; i += batchSize) {
      // Yield to the browser's event loop if we've been processing for too long
      const now = Date.now();
      if (now - lastYieldTime > YIELD_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, 0));
        lastYieldTime = Date.now();
      }
      
      const batch = texts.slice(i, i + batchSize);
      
      // Process embeddings one by one to avoid memory pressure
      const batchEmbeddings: number[][] = [];
      for (let j = 0; j < batch.length; j++) {
        // Clear any previous tensor objects from memory
        if (typeof window.gc === 'function') {
          try {
            // Force garbage collection if available
            window.gc();
          } catch (e) {
            // Ignore error if gc is not available
          }
        }
        
        const output = await embeddingModel(batch[j], { pooling: 'mean', normalize: true });
        const embedding = output.tolist()[0];
        
        // Help with memory cleanup
        if (output.dispose) {
          try {
            output.dispose();
          } catch (e) {
            // Ignore error if dispose is not available
          }
        }
        
        batchEmbeddings.push(embedding);
        
        // Yield to the browser's event loop between individual embeddings if needed
        const currentTime = Date.now();
        if (currentTime - lastYieldTime > YIELD_INTERVAL) {
          await new Promise(resolve => setTimeout(resolve, 0));
          lastYieldTime = currentTime;
        }
      }
      
      // Add batch results to overall results
      embeddings.push(...batchEmbeddings);
      
      // Report progress
      if (progressCallback) {
        progressCallback(Math.round((i + batch.length) / texts.length * 100));
      }
      
      // Yield to allow browser to process UI updates
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    
    return embeddings;
  } catch (error) {
    console.error('Failed to generate embeddings:', error);
    throw error;
  }
};

// Declare the global gc function for TypeScript
declare global {
  interface Window {
    gc?: () => void;
  }
} 