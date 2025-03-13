import { generateEmbedding } from './embeddingService';
import { queryEmbeddings, getDocumentCount } from './vectorStore';
import { generateResponse } from './llmService';
import { ModelInfo } from './modelPersistenceService';

// Define a type for progress callback
export type ProgressCallback = (stage: string, progress: number) => void;

/**
 * Query documents using RAG (Retrieval Augmented Generation)
 */
export const queryDocuments = async (
  question: string,
  documentNames: string[],
  model: ModelInfo,
  progressCallback?: ProgressCallback,
  projectId?: string
): Promise<string> => {
  try {
    // Check if we have documents
    if (!documentNames || documentNames.length === 0) {
      return `There are no documents uploaded to this project yet. Please upload some documents first.`;
    }

    // Log for debugging
    console.log(`Querying documents for project: ${projectId}`);
    console.log(`Available documents: ${documentNames.join(', ')}`);
    
    // Update progress
    if (progressCallback) {
      progressCallback('embedding', 0);
    }
    
    // 1. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(question);
    
    // Update progress
    if (progressCallback) {
      progressCallback('retrieval', 20);
    }
    
    // 2. Retrieve similar chunks from the vector database
    const similarChunks = await queryEmbeddings(queryEmbedding, 5, projectId);
    
    console.log(`Found ${similarChunks.length} similar chunks`);
    
    // If no chunks found, try with a larger number of results or lower threshold
    let alternateResponse = '';
    if (similarChunks.length === 0) {
      // Get a count of all embeddings for this project to determine if any exist
      const totalDocCount = await getDocumentCount(projectId);
      
      if (totalDocCount === 0) {
        alternateResponse = `I couldn't find any indexed content for your documents. This might indicate that your documents weren't properly processed. Try re-uploading them or checking if they contain extractable text.`;
      } else {
        // Try increasing the number of results to see if we get any matches at all
        const moreSimilarChunks = await queryEmbeddings(queryEmbedding, 10, projectId);
        
        if (moreSimilarChunks.length > 0) {
          // We got some results with a larger limit, but they might not be very relevant
          console.log(`Found ${moreSimilarChunks.length} chunks with expanded search`);
          similarChunks.push(...moreSimilarChunks);
          alternateResponse = `I found some information in your documents, but it might not be directly relevant to your question.`;
        } else {
          // Still no results, provide a helpful message
          alternateResponse = `I couldn't find any relevant information in your documents to answer that question. Your documents contain ${totalDocCount} indexed chunks, but none seem to match your query about "${question}". Try rephrasing your question or asking about different topics covered in your documents.`;
        }
      }
    }
    
    if (similarChunks.length === 0) {
      if (progressCallback) {
        progressCallback('complete', 100);
      }
      return alternateResponse;
    }
    
    // Update progress
    if (progressCallback) {
      progressCallback('generation', 40);
    }
    
    // 3. Construct prompt with retrieved context
    const prompt = constructRAGPrompt(question, similarChunks, alternateResponse);
    
    // Update progress
    if (progressCallback) {
      progressCallback('generation', 60);
    }
    
    // 4. Generate response using LLM
    const response = await generateResponse(prompt, model.id);
    
    // Update progress
    if (progressCallback) {
      progressCallback('complete', 100);
    }
    
    return response;
  } catch (error) {
    console.error('Error in RAG pipeline:', error);
    throw error;
  }
};

/**
 * Construct a prompt for RAG
 */
const constructRAGPrompt = (
  question: string,
  contexts: Array<{ id: string; text: string; score: number; metadata: Record<string, any> }>,
  alternateResponse: string = ''
): string => {
  // Sort contexts by score (highest first)
  contexts.sort((a, b) => b.score - a.score);
  
  // Extract document names and page numbers
  const contextSources = contexts.map(ctx => {
    const docName = ctx.metadata.documentName || 'Unknown';
    const pageNum = ctx.metadata.pageNumber;
    const rowIndex = ctx.metadata.rowIndex;
    
    if (pageNum) {
      return `${docName} (Page ${pageNum})`;
    } else if (rowIndex !== undefined) {
      return `${docName} (Row ${rowIndex + 1})`;
    } else {
      return docName;
    }
  });
  
  // Create a set of unique sources
  const uniqueSources = [...new Set(contextSources)];
  
  // Combine all context texts
  const combinedContext = contexts.map(ctx => ctx.text).join('\n\n');
  
  // Log scores for debugging
  console.log(`Context scores: ${contexts.map(c => c.score.toFixed(3)).join(', ')}`);
  
  // Add note about match quality if relevant
  let matchQualityNote = '';
  if (alternateResponse) {
    matchQualityNote = `Note: The retrieved information may not be a perfect match for the question. ${alternateResponse}`;
  }
  
  // Construct the prompt
  return `You are a helpful assistant that answers questions based on the provided context from documents.

CONTEXT:
${combinedContext}

SOURCES:
${uniqueSources.join(', ')}

USER QUESTION:
${question}

${matchQualityNote}

Please provide a comprehensive answer to the question based ONLY on the information in the CONTEXT. 
If the context doesn't contain enough information to answer the question fully, acknowledge what you can answer and what information is missing.
Include relevant source documents in your answer when appropriate.
`;
};

/**
 * Initialize the RAG system
 */
export const initializeRAG = async (
  model: ModelInfo,
  progressCallback?: ProgressCallback
): Promise<void> => {
  try {
    // Update progress
    if (progressCallback) {
      progressCallback('initialization', 0);
    }
    
    // Perform any necessary initialization
    
    // Update progress
    if (progressCallback) {
      progressCallback('complete', 100);
    }
  } catch (error) {
    console.error('Error initializing RAG:', error);
    throw error;
  }
}; 