import * as pdfjs from 'pdfjs-dist';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { generateEmbeddings } from './embeddingService';
import { generateUnifiedEmbeddings } from './unifiedLLMService';
import { storeEmbeddings } from './vectorStore';
import { DocumentInfo } from './documentManagementService';
import { addDocumentToProject } from './projectService';
import { ProviderType } from '../contexts/ProviderContext';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    documentId: string;
    documentName: string;
    projectId: string;
    chunkIndex: number;
    pageNumber?: number;
    rowIndex?: number;
  };
}

/**
 * Split text into chunks of roughly equal size
 */
const chunkText = (text: string, chunkSize: number = 1000, overlap: number = 200): string[] => {
  if (!text || text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    // Find the end of the current chunk
    let endIndex = startIndex + chunkSize;
    if (endIndex >= text.length) {
      // Last chunk
      endIndex = text.length;
    } else {
      // Try to end at a sentence or paragraph break
      const possibleBreakPoints = [
        text.lastIndexOf('. ', Math.min(endIndex, text.length)),
        text.lastIndexOf('.\n', Math.min(endIndex, text.length)),
        text.lastIndexOf('\n\n', Math.min(endIndex, text.length))
      ].filter(index => index > startIndex);

      if (possibleBreakPoints.length > 0) {
        // Use the last break point found before the endIndex
        endIndex = Math.max(...possibleBreakPoints) + 1;
      }
    }

    chunks.push(text.substring(startIndex, endIndex).trim());
    
    // Move startIndex with overlap
    startIndex = endIndex - overlap;
    
    // If we're very close to the end, just include the rest
    if (text.length - startIndex < chunkSize / 2) {
      if (startIndex < text.length) {
        chunks.push(text.substring(startIndex).trim());
      }
      break;
    }
  }

  return chunks;
};

/**
 * Process a PDF document
 */
export const processPdfDocument = async (
  projectId: string,
  file: File,
  progressCallback?: (progress: number) => void,
  provider: ProviderType = 'browser',
  embeddingModelId?: string
): Promise<DocumentInfo> => {
  const documentId = uuidv4();
  const fileName = file.name;
  
  try {
    // Load the PDF file
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(new Uint8Array(arrayBuffer)).promise;
    
    // Extract text from each page and collect as chunks
    const chunks: DocumentChunk[] = [];
    const numPages = pdf.numPages;
    
    for (let i = 1; i <= numPages; i++) {
      if (progressCallback) {
        progressCallback(Math.round((i - 1) / numPages * 50));
      }
      
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Combine text items into a single string
      const pageText = textContent.items
        .map((item: any) => 'str' in item ? item.str : '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Split page text into chunks
      const pageChunks = chunkText(pageText);
      
      // Create document chunks with metadata
      pageChunks.forEach((text, index) => {
        chunks.push({
          id: `${documentId}-page-${i}-chunk-${index}`,
          text: text,
          metadata: {
            documentId,
            documentName: fileName,
            projectId,
            pageNumber: i,
            chunkIndex: chunks.length,
          }
        });
      });
    }
    
    if (progressCallback) {
      progressCallback(50);
    }
    
    // Generate embeddings for all chunks
    const texts = chunks.map(chunk => chunk.text);
    const embeddings = await generateUnifiedEmbeddings(
      texts,
      { provider, embeddingModelId },
      (progress) => {
        if (progressCallback) {
          // Map progress from 0-100 to 50-90
          progressCallback(50 + Math.round(progress * 0.4));
        }
      }
    );
    
    // Store embeddings in vector database
    await storeEmbeddings(
      documentId,
      chunks.map(chunk => chunk.id),
      embeddings,
      texts,
      chunks.map(chunk => chunk.metadata)
    );
    
    // Verify embeddings were stored correctly
    const verificationResult = await import('./vectorStore').then(module => 
      module.verifyEmbeddings(documentId, projectId)
    );
    
    console.log(`Document embedding verification:`, verificationResult);
    
    if (!verificationResult.exists || verificationResult.count === 0) {
      console.error(`Failed to verify embeddings for document ${documentId}`);
      throw new Error('Document embeddings were not stored correctly. Please try again.');
    }
    
    if (progressCallback) {
      progressCallback(100);
    }
    
    // Create and store document info
    const documentInfo: DocumentInfo = {
      id: documentId,
      name: fileName,
      createdAt: new Date(),
      type: 'pdf'
    };
    
    // Add document to project
    const added = await addDocumentToProject(projectId, documentInfo);
    if (!added) {
      throw new Error(`Failed to add document ${documentId} to project ${projectId}`);
    }
    
    return documentInfo;
  } catch (error) {
    console.error(`Error processing PDF document ${fileName}:`, error);
    throw error;
  }
};

/**
 * Process a CSV document
 */
export const processCsvDocument = async (
  projectId: string,
  file: File,
  progressCallback?: (progress: number, chunkInfo?: { current: number, total: number }) => void,
  provider: ProviderType = 'browser',
  embeddingModelId?: string
): Promise<DocumentInfo> => {
  const documentId = uuidv4();
  const fileName = file.name;
  
  console.log(`Starting CSV processing for file: ${fileName}, size: ${file.size} bytes`);
  
  return new Promise<DocumentInfo>((resolve, reject) => {
    // Use incremental processing for large files
    const chunkSize = 100; // Process chunks of 100 rows at a time
    let currentChunk: DocumentChunk[] = [];
    let processedRows = 0;
    let totalRows = 0;
    let headers: string[] = [];
    let chunkCounter = 0;
    let estimatedTotalChunks = 0;
    
    console.log(`Configuring Papa.parse for CSV file: ${fileName}`);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      step: function(results, parser) {
        try {
          console.log(`Parsing CSV row, results:`, results);
          if (!results.data || typeof results.data !== 'object') {
            console.log(`Invalid CSV row data:`, results.data);
            return;
          }
          
          // Get headers if this is the first row
          if (headers.length === 0 && results.meta && results.meta.fields) {
            headers = results.meta.fields;
          }
          
          totalRows++;
          
          // Estimate total chunks based on file size and average row size
          if (totalRows === 1) {
            const avgRowSize = results.meta.cursor / totalRows;
            estimatedTotalChunks = Math.ceil(file.size / (avgRowSize * chunkSize));
          }
          
          const row = results.data as Record<string, any>;
          
          // Create a text representation of the row
          let rowText = '';
          
          // Add headers and values
          for (const header of headers) {
            if (row[header]) {
              rowText += `${header}: ${row[header]}\n`;
            }
          }
          
          if (rowText.trim()) {
            currentChunk.push({
              id: `${documentId}-row-${processedRows}`,
              text: rowText.trim(),
              metadata: {
                documentId,
                documentName: fileName,
                projectId,
                rowIndex: processedRows,
                chunkIndex: processedRows,
              }
            });
          }
          
          processedRows++;
          
          // Process in chunks to avoid overwhelming the browser
          if (currentChunk.length >= chunkSize) {
            chunkCounter++;
            
            // Pause parsing to process the current chunk
            parser.pause();
            
            const chunksToProcess = [...currentChunk];
            currentChunk = [];
            
            if (progressCallback) {
              progressCallback(0, { current: chunkCounter, total: estimatedTotalChunks });
            }
            
            // Process the chunk
            processChunk(chunksToProcess, documentId, fileName, projectId, chunkCounter, estimatedTotalChunks, progressCallback, provider, embeddingModelId)
              .then(() => {
                // Resume parsing
                parser.resume();
              })
              .catch((error) => {
                console.error(`Error processing chunk ${chunkCounter}:`, error);
                parser.abort();
                reject(error);
              });
          }
        } catch (error) {
          console.error('Error parsing CSV row:', error);
          parser.abort();
          reject(error);
        }
      },
      complete: async function(results) {
        try {
          console.log(`CSV parsing complete, results:`, results);
          // Process any remaining rows
          if (currentChunk.length > 0) {
            chunkCounter++;
            
            if (progressCallback) {
              progressCallback(0, { current: chunkCounter, total: estimatedTotalChunks });
            }
            
            await processChunk(currentChunk, documentId, fileName, projectId, chunkCounter, estimatedTotalChunks, progressCallback, provider, embeddingModelId);
          }
          
          console.log(`Processed ${processedRows} rows from ${fileName}`);
          
          // Ensure vector store is loaded with the latest data
          await import('./vectorStore').then(module => module.initializeVectorStore());
          
          // Verify embeddings were stored correctly before proceeding
          const verificationResult = await import('./vectorStore').then(module => 
            module.verifyEmbeddings(documentId, projectId)
          );
          
          console.log(`Final CSV document embedding verification:`, verificationResult);
          
          if (!verificationResult.exists || verificationResult.count === 0) {
            console.error(`Failed to verify embeddings for document ${documentId}`);
            reject(new Error('Document embeddings were not stored correctly. Please try again.'));
            return;
          }
          
          if (progressCallback) {
            progressCallback(100);
          }
          
          // Create document info
          const documentInfo: DocumentInfo = {
            id: documentId,
            name: fileName,
            createdAt: new Date(),
            type: 'csv'
          };
          
          // Add to project with await
          const added = await addDocumentToProject(projectId, documentInfo);
          if (!added) {
            reject(new Error(`Failed to add document ${documentId} to project ${projectId}`));
            return;
          }
          
          console.log(`CSV document successfully processed: ${fileName}`);
          resolve(documentInfo);
        } catch (error) {
          console.error(`Error finalizing CSV document ${fileName}:`, error);
          reject(error);
        }
      },
      error: function(error) {
        console.error(`Error parsing CSV document ${fileName}:`, error);
        console.error(`Error details:`, error.message, error.name, error.stack);
        reject(error);
      }
    });
  });
};

/**
 * Process a chunk of CSV rows
 */
async function processChunk(
  chunk: DocumentChunk[],
  documentId: string,
  fileName: string,
  projectId: string,
  chunkNumber: number,
  totalChunks: number,
  progressCallback?: (progress: number, chunkInfo?: { current: number, total: number }) => void,
  provider: ProviderType = 'browser',
  embeddingModelId?: string
): Promise<void> {
  try {
    // Generate embeddings for all texts in the chunk
    const texts = chunk.map(item => item.text);
    const embeddings = await generateUnifiedEmbeddings(
      texts,
      { provider, embeddingModelId },
      (progress) => {
        if (progressCallback) {
          progressCallback(progress, { current: chunkNumber, total: totalChunks });
        }
      }
    );
    
    // Store embeddings
    await storeEmbeddings(
      documentId,
      chunk.map(item => item.id),
      embeddings,
      texts,
      chunk.map(item => item.metadata)
    );
    
    // Verify embeddings were stored correctly
    const verificationResult = await import('./vectorStore').then(module => 
      module.verifyEmbeddings(documentId, projectId)
    );
    
    if (!verificationResult.exists) {
      console.error(`Failed to verify embeddings for chunk ${chunkNumber} of ${fileName}`);
      console.log('Verification details:', verificationResult.details);
    }
    
    console.log(`Processed chunk ${chunkNumber} of ${totalChunks} for ${fileName}`);
  } catch (error) {
    console.error(`Error processing chunk ${chunkNumber} for ${fileName}:`, error);
    throw error;
  }
} 