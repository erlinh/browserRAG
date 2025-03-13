import { ChromaClient, Collection, IncludeEnum } from 'chromadb';

// Singleton pattern for ChromaDB client
let chromaClient: ChromaClient | null = null;
let collection: Collection | null = null;
const COLLECTION_NAME = 'documents';

/**
 * Initialize the ChromaDB client and collection
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    console.log('Initializing ChromaDB...');
    
    // Create ChromaDB client
    chromaClient = new ChromaClient();
    
    // Delete collection if it exists (for clean start)
    try {
      await chromaClient.deleteCollection({ name: COLLECTION_NAME });
    } catch (error) {
      // Collection might not exist yet, which is fine
    }
    
    // Create collection
    collection = await chromaClient.createCollection({
      name: COLLECTION_NAME,
      metadata: { 
        description: 'Document embeddings for BrowserRAG' 
      }
    });
    
    console.log('ChromaDB initialized successfully');
    return Promise.resolve();
  } catch (error) {
    console.error('Failed to initialize ChromaDB:', error);
    return Promise.reject(error);
  }
};

/**
 * Store document chunk embeddings in ChromaDB
 */
export const storeEmbeddings = async (
  documentId: string,
  chunkIds: string[],
  embeddings: number[][],
  texts: string[],
  metadatas: Record<string, any>[]
): Promise<void> => {
  if (!collection) {
    throw new Error('ChromaDB collection not initialized. Call initializeDatabase first.');
  }

  try {
    // Add embeddings to collection
    await collection.add({
      ids: chunkIds,
      embeddings: embeddings,
      metadatas: metadatas,
      documents: texts
    });
    
    console.log(`Stored ${chunkIds.length} chunks for document: ${documentId}`);
  } catch (error) {
    console.error(`Failed to store embeddings for document ${documentId}:`, error);
    throw error;
  }
};

/**
 * Query the vector database for similar documents
 */
export const queryEmbeddings = async (
  queryEmbedding: number[],
  limit: number = 5
): Promise<{ id: string; text: string; score: number; metadata: Record<string, any> }[]> => {
  if (!collection) {
    throw new Error('ChromaDB collection not initialized. Call initializeDatabase first.');
  }

  try {
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances]
    });

    if (!results.documents?.[0] || !results.metadatas?.[0] || !results.distances?.[0]) {
      return [];
    }

    // Transform results to a more usable format
    return results.documents[0].map((text, index) => ({
      id: results.ids[0][index],
      text: text,
      score: results.distances[0][index],
      metadata: results.metadatas[0][index]
    }));
  } catch (error) {
    console.error('Failed to query embeddings:', error);
    throw error;
  }
}; 