import { generateEmbedding } from './embeddingService';
import { queryEmbeddings, getDocumentCount, verifyEmbeddings } from './vectorStore';
import { generateResponse } from './llmService';
import { ModelInfo } from './modelPersistenceService';
import { generateUnifiedResponse, generateUnifiedEmbedding } from './unifiedLLMService';
import { ProviderType } from '../contexts/ProviderContext';

// Define a type for progress callback
export type ProgressCallback = (stage: string, progress: number) => void;

// Check if the model is a Pleias model
const isPleiasModel = (modelId: string): boolean => {
  return modelId.includes('Pleias');
};

/**
 * Query documents using RAG (Retrieval Augmented Generation)
 */
export const queryDocuments = async (
  question: string,
  documentNames: string[],
  model: ModelInfo,
  progressCallback?: ProgressCallback,
  projectId?: string,
  streamCallback?: (token: string) => void,
  provider: ProviderType = 'browser',
  embeddingModelId?: string
): Promise<string> => {
  try {
    // Check if we have documents
    if (!documentNames || documentNames.length === 0) {
      // Instead of returning an error message, use the LLM as a general conversational AI
      if (progressCallback) {
        progressCallback('generation', 60);
      }
      
      // Create a conversational prompt
      const conversationalPrompt = constructConversationalPrompt(question);
      
      // Generate response with the unified LLM service
      const response = await generateUnifiedResponse(
        conversationalPrompt,
        {
          provider,
          modelId: model.id,
          embeddingModelId,
          progressCallback: (progress) => {
            if (progressCallback) {
              // Map the LLM progress to our progress range (60-100%)
              const mappedProgress = 60 + (progress.progress || 0) * 0.4;
              progressCallback(progress.stage || 'generation', mappedProgress);
            }
          },
          streamCallback,
        }
      );
      
      // Update progress
      if (progressCallback) {
        progressCallback('complete', 100);
      }
      
      return response;
    }

    // Log for debugging
    console.log(`Querying documents for project: ${projectId}`);
    console.log(`Available documents: ${documentNames.join(', ')}`);
    
    // Update progress
    if (progressCallback) {
      progressCallback('embedding', 0);
    }
    
    // 1. Generate embedding for the query
    const queryEmbedding = await generateUnifiedEmbedding(question, {
      provider,
      embeddingModelId,
    });
    
    // Update progress
    if (progressCallback) {
      progressCallback('retrieval', 20);
    }
    
    // Verify embeddings exist before querying
    const verificationResult = verifyEmbeddings(undefined, projectId);
    console.log(`Embedding verification result:`, verificationResult);
    
    if (!verificationResult.exists) {
      return `No document embeddings were found for this project. Please make sure your documents have been processed correctly. If you've just uploaded documents, please try refreshing the page.`;
    }
    
    // 2. Retrieve similar chunks from the vector database
    const similarChunks = await queryEmbeddings(queryEmbedding, 5, projectId);
    
    console.log(`Found ${similarChunks.length} similar chunks`);
    
    // If no chunks found, try with a larger number of results or lower threshold
    let alternateResponse = '';
    if (similarChunks.length === 0) {
      // Try again with a larger limit
      console.log('No results found with default limit, trying with larger limit...');
      const moreSimilarChunks = await queryEmbeddings(queryEmbedding, 10, projectId);
      
      if (moreSimilarChunks.length > 0) {
        console.log(`Found ${moreSimilarChunks.length} chunks with increased limit`);
        similarChunks.push(...moreSimilarChunks);
      } else {
        // Get a count of all embeddings for this project to determine if any exist
        const count = await getDocumentCount(projectId);
        
        if (count > 0) {
          // Some documents exist but no good matches were found
          alternateResponse = `I couldn't find any relevant information in the documents to answer your question.`;
        } else {
          // No documents have been properly indexed
          return `No document embeddings were found for this project. Please make sure your documents have been processed correctly.`;
        }
      }
    }
    
    // Update progress
    if (progressCallback) {
      progressCallback('processing', 40);
    }
    
    // 3. Construct a prompt with the retrieved chunks
    let prompt;
    if (isPleiasModel(model.id)) {
      prompt = constructPleiasRAGPrompt(question, similarChunks, alternateResponse);
    } else {
      prompt = constructRAGPrompt(question, similarChunks, alternateResponse);
    }
    
    // Update progress
    if (progressCallback) {
      progressCallback('generation', 60);
    }
    
    // 4. Generate response with the LLM
    const response = await generateUnifiedResponse(
      prompt,
      {
        provider,
        modelId: model.id,
        embeddingModelId,
        progressCallback: (progress) => {
          if (progressCallback) {
            // Map the LLM progress to our progress range (60-100%)
            const mappedProgress = 60 + (progress.progress || 0) * 0.4;
            progressCallback(progress.stage || 'generation', mappedProgress);
          }
        },
        streamCallback,
      }
    );
    
    // Update progress
    if (progressCallback) {
      progressCallback('complete', 100);
    }
    
    return response;
  } catch (error) {
    console.error('Error in queryDocuments:', error);
    let errorMessage = 'An unknown error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }
    
    return `An error occurred while processing your question: ${errorMessage}. Please try again or check the console for more details.`;
  }
};

/**
 * Construct a prompt for RAG with Pleias models
 */
const constructPleiasRAGPrompt = (
  question: string,
  contexts: Array<{ id: string; text: string; score: number; metadata: Record<string, any> }>,
  alternateResponse: string = ''
): string => {
  // Format contexts as sources with IDs for Pleias models
  let sourcesContent = '';
  
  // Sort contexts by score (highest first)
  contexts.sort((a, b) => b.score - a.score);
  
  // Construct sources - assign unique IDs to each chunk
  contexts.forEach((ctx, index) => {
    // Generate a hex ID that looks like the example (8 characters)
    const sourceId = (ctx.metadata.documentId || ctx.id || '')
      .substring(0, 8)
      .padEnd(8, '0')
      .replace(/[^a-f0-9]/gi, '0');
    
    sourcesContent += `<|source_start|><|source_id_start|>${sourceId}<|source_id_end|>${ctx.text.trim()}<|source_end|>\n`;
  });
  
  // Format the prompt according to Pleias model requirements
  const prompt = `
<|query_start|>${question.trim()}<|query_end|>
${sourcesContent}
<|source_analysis_start|>
`.trim();
  
  console.log('Constructed Pleias RAG prompt:', prompt.substring(0, 200) + '...');
  return prompt;
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

/**
 * Construct a prompt for general conversational interactions
 */
const constructConversationalPrompt = (
  question: string
): string => {
  return `You are a helpful AI assistant that provides informative, accurate, and friendly responses to questions.

USER QUESTION:
${question}

Please respond in a conversational and helpful manner. If you don't know the answer to a question, be honest about your limitations rather than making up information.
`;
}; 