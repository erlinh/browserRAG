import { generateEmbedding } from './embeddingService';
import { queryEmbeddings } from './vectorStore';
import { generateResponse } from './llmService';

// Define a type for progress callback
export type ProgressCallback = (progress: { status: string; message: string; progress?: number; stage?: string }) => void;

/**
 * Query documents using RAG (Retrieval Augmented Generation)
 */
export const queryDocuments = async (
  question: string,
  modelId?: string,
  progressCallback?: ProgressCallback,
  streamCallback?: (token: string) => void
): Promise<string> => {
  try {
    // Update progress
    if (progressCallback) {
      progressCallback({ 
        status: 'loading', 
        message: 'Generating embeddings for your question...', 
        progress: 0,
        stage: 'embedding' 
      });
    }
    
    // 1. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(question);
    
    // Update progress
    if (progressCallback) {
      progressCallback({ 
        status: 'loading', 
        message: 'Retrieving relevant context from documents...', 
        progress: 20,
        stage: 'retrieval' 
      });
    }
    
    // 2. Retrieve similar chunks from the vector database
    const similarChunks = await queryEmbeddings(queryEmbedding, 5);
    
    if (similarChunks.length === 0) {
      if (progressCallback) {
        progressCallback({ 
          status: 'error', 
          message: 'No relevant context found', 
          progress: 100,
          stage: 'complete' 
        });
      }
      return "I couldn't find any relevant information in the documents to answer your question. Could you try rephrasing or asking about something else?";
    }
    
    // Update progress
    if (progressCallback) {
      progressCallback({ 
        status: 'loading', 
        message: 'Constructing prompt with retrieved context...', 
        progress: 40,
        stage: 'prompt' 
      });
    }
    
    // 3. Construct a prompt with retrieved context
    const prompt = constructRAGPrompt(question, similarChunks);
    
    // Update progress
    if (progressCallback) {
      progressCallback({ 
        status: 'loading', 
        message: 'Generating response...', 
        progress: 50,
        stage: 'generation' 
      });
    }
    
    // 4. Generate response using the LLM
    const response = await generateResponse(
      prompt,
      modelId,
      (progress) => {
        if (progressCallback) {
          // Scale the progress to be between 50-100%
          const clampedProgress = progress.progress !== undefined
            ? Math.max(0, Math.min(1, progress.progress)) // Clamp between 0 and 1
            : 0;
          
          const scaledProgress = 50 + (clampedProgress * 50);
          
          progressCallback({
            ...progress,
            progress: scaledProgress
          });
        }
      },
      streamCallback // Pass the streaming callback
    );
    
    // Update final progress
    if (progressCallback) {
      progressCallback({ 
        status: 'success', 
        message: 'Response generated successfully', 
        progress: 100,
        stage: 'complete' 
      });
    }
    
    return response;
  } catch (error) {
    console.error('Error querying documents:', error);
    if (progressCallback) {
      progressCallback({ 
        status: 'error', 
        message: `Error querying documents: ${error instanceof Error ? error.message : String(error)}`,
        stage: 'error' 
      });
    }
    throw error;
  }
};

/**
 * Construct a prompt for the RAG model
 */
const constructRAGPrompt = (
  question: string,
  contexts: Array<{ id: string; text: string; score: number; metadata: Record<string, any> }>
): string => {
  // Create a context section from the retrieved chunks
  const contextText = contexts
    .map((context, i) => {
      const documentInfo = context.metadata.documentName 
        ? `From: ${context.metadata.documentName}` 
        : '';
      const pageInfo = context.metadata.pageNumber !== undefined 
        ? `Page: ${context.metadata.pageNumber}` 
        : '';
      const rowInfo = context.metadata.rowIndex !== undefined 
        ? `Row: ${context.metadata.rowIndex}` 
        : '';
      
      const sourceInfo = [documentInfo, pageInfo, rowInfo]
        .filter(info => info !== '')
        .join(' | ');
        
      return `[Context ${i + 1}] ${sourceInfo}\n${context.text}\n`;
    })
    .join('\n');

  // Construct the full prompt
  return `You are a helpful assistant that answers questions based on the provided document contexts.
Answer the question based ONLY on the contexts below. If you can't find the answer in the contexts, say so.
Don't make up information not present in the contexts.

CONTEXTS:
${contextText}

QUESTION:
${question}

ANSWER:`;
};

/**
 * Initialize the RAG system
 */
export const initializeRAG = async (
  modelId?: string,
  progressCallback?: ProgressCallback
): Promise<void> => {
  try {
    // Initialize embedding model and LLM
    if (progressCallback) {
      progressCallback({ 
        status: 'loading', 
        message: 'Initializing RAG system...', 
        progress: 0,
        stage: 'init' 
      });
    }
    
    // The actual initialization is done lazily when needed
    if (progressCallback) {
      progressCallback({ 
        status: 'success', 
        message: 'RAG system initialized', 
        progress: 100,
        stage: 'complete' 
      });
    }
  } catch (error) {
    console.error('Failed to initialize RAG system:', error);
    if (progressCallback) {
      progressCallback({ 
        status: 'error', 
        message: `Failed to initialize RAG system: ${error instanceof Error ? error.message : String(error)}`,
        stage: 'error'
      });
    }
    throw error;
  }
}; 