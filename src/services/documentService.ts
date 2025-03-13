import * as pdfjs from 'pdfjs-dist';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { generateEmbeddings } from './embeddingService';
import { storeEmbeddings } from './vectorStore';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    documentId: string;
    documentName: string;
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
  file: File,
  progressCallback?: (progress: number) => void
): Promise<void> => {
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
    const embeddings = await generateEmbeddings(texts, (progress) => {
      if (progressCallback) {
        // Map progress from 0-100 to 50-90
        progressCallback(50 + Math.round(progress * 0.4));
      }
    });
    
    // Store embeddings in vector store
    await storeEmbeddings(
      documentId,
      chunks.map(chunk => chunk.id),
      embeddings,
      texts,
      chunks.map(chunk => chunk.metadata)
    );
    
    if (progressCallback) {
      progressCallback(100);
    }
    
  } catch (error) {
    console.error(`Error processing PDF document ${fileName}:`, error);
    throw error;
  }
};

/**
 * Process a CSV document
 */
export const processCsvDocument = async (
  file: File,
  progressCallback?: (progress: number) => void
): Promise<void> => {
  const documentId = uuidv4();
  const fileName = file.name;
  
  return new Promise<void>((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (progressCallback) {
            progressCallback(20);
          }
          
          const { data, meta } = results;
          if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error('No data found in CSV file');
          }
          
          // Convert rows to chunks
          const chunks: DocumentChunk[] = [];
          
          // Get headers
          const headers = meta.fields || Object.keys(data[0] as object);
          
          // Process each row
          data.forEach((row: any, rowIndex) => {
            // Create a text representation of the row
            let rowText = '';
            
            // Add headers and values
            for (const header of headers) {
              if (row[header]) {
                rowText += `${header}: ${row[header]}\n`;
              }
            }
            
            if (rowText.trim()) {
              chunks.push({
                id: `${documentId}-row-${rowIndex}`,
                text: rowText.trim(),
                metadata: {
                  documentId,
                  documentName: fileName,
                  rowIndex,
                  chunkIndex: chunks.length,
                }
              });
            }
          });
          
          if (progressCallback) {
            progressCallback(40);
          }
          
          // Generate embeddings for all chunks
          const texts = chunks.map(chunk => chunk.text);
          const embeddings = await generateEmbeddings(texts, (progress) => {
            if (progressCallback) {
              // Map progress from 0-100 to 40-80
              progressCallback(40 + Math.round(progress * 0.4));
            }
          });
          
          // Store embeddings in vector store
          await storeEmbeddings(
            documentId,
            chunks.map(chunk => chunk.id),
            embeddings,
            texts,
            chunks.map(chunk => chunk.metadata)
          );
          
          if (progressCallback) {
            progressCallback(100);
          }
          
          resolve();
        } catch (error) {
          console.error(`Error processing CSV document ${fileName}:`, error);
          reject(error);
        }
      },
      error: (error) => {
        console.error(`Error parsing CSV document ${fileName}:`, error);
        reject(error);
      }
    });
  });
}; 