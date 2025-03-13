import { generateEmbedding } from './embeddingService';
import { queryEmbeddings } from './vectorStore';
import { generateResponse } from './llmService';

/**
 * Query documents using RAG (Retrieval Augmented Generation)
 */
export const queryDocuments = async (question: string): Promise<string> => {
  try {
    // 1. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(question);
    
    // 2. Retrieve similar chunks from the vector database
    const similarChunks = await queryEmbeddings(queryEmbedding, 5);
    
    if (similarChunks.length === 0) {
      return "I couldn't find any relevant information in the documents to answer your question. Could you try rephrasing or asking about something else?";
    }
    
    // 3. Construct a prompt with retrieved context
    const prompt = constructRAGPrompt(question, similarChunks);
    
    // 4. Generate response using the LLM
    const response = await generateResponse(prompt);
    
    return response;
  } catch (error) {
    console.error('Error querying documents:', error);
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
  progressCallback?: (progress: { status: string; message: string; progress?: number }) => void
): Promise<void> => {
  try {
    // Initialize embedding model and LLM
    if (progressCallback) {
      progressCallback({ status: 'loading', message: 'Initializing RAG system...' });
    }
    
    // The actual initialization is done lazily when needed
    if (progressCallback) {
      progressCallback({ status: 'success', message: 'RAG system initialized' });
    }
  } catch (error) {
    console.error('Failed to initialize RAG system:', error);
    if (progressCallback) {
      progressCallback({ 
        status: 'error', 
        message: `Failed to initialize RAG system: ${error instanceof Error ? error.message : String(error)}`
      });
    }
    throw error;
  }
}; 