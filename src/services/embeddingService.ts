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
  const batchSize = 16; // Process in batches to avoid memory issues

  try {
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Generate embeddings for batch
      const outputs = await Promise.all(batch.map(text => embeddingModel(text, { pooling: 'mean', normalize: true })));
      
      // Convert to array of numbers from tensor and add to results
      embeddings.push(...outputs.map(output => output.tolist()[0]));
      
      // Report progress
      if (progressCallback) {
        progressCallback(Math.round((i + batch.length) / texts.length * 100));
      }
    }
    
    return embeddings;
  } catch (error) {
    console.error('Failed to generate embeddings:', error);
    throw error;
  }
}; 