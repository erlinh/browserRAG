# BrowserRAG

BrowserRAG is an in-browser RAG (Retrieval Augmented Generation) chat application that allows users to converse with PDF and CSV documents entirely in their browser. No server required!

## Features

- 🔒 **Privacy-Focused**: All data processing happens in your browser. Your documents never leave your device.
- 📄 **Document Support**: Upload and process PDF and CSV files.
- 🔍 **Vector Search**: Uses ChromaDB for efficient similarity search.
- 🧠 **Embeddings**: Generates text embeddings using the Xenova/all-MiniLM-L6-v2 model.
- 💬 **LLM Processing**: Uses DeepSeek-R1 model running entirely in your browser.
- 🚀 **Fully Client-Side**: No backend servers or API calls needed.

## Getting Started

### Prerequisites

- Node.js and npm installed

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/BrowserRAG.git
   cd BrowserRAG
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## How It Works

BrowserRAG implements a complete RAG pipeline in the browser:

1. **Document Processing**: When you upload PDF or CSV files, the app extracts text content.
2. **Chunking**: Long documents are split into manageable chunks with appropriate overlap.
3. **Embedding Generation**: Each chunk is converted to a vector embedding using Transformers.js and the Xenova/all-MiniLM-L6-v2 model.
4. **Vector Storage**: Embeddings are stored in an in-browser ChromaDB instance.
5. **Query Processing**: When you ask a question, it's converted to an embedding and used to find similar document chunks.
6. **Context Construction**: Relevant chunks are assembled into a prompt for the LLM.
7. **Response Generation**: DeepSeek-R1, running in the browser, generates a response based on the relevant context.

## Browser Compatibility

For optimal performance, BrowserRAG requires:

- A modern browser with WebGPU or WebGL2 support
- Chrome/Edge/Opera 113+, Firefox 94+, or Safari 16.4+
- At least 4GB of RAM for PDF and CSV processing

## Technologies Used

- **React**: Frontend UI
- **Vite**: Build system and development server
- **TypeScript**: Type-safe JavaScript
- **ChromaDB**: Vector database for storing and querying embeddings
- **Transformers.js**: Run transformer models in the browser
- **PDF.js**: PDF parsing
- **PapaParse**: CSV parsing

## License

This project is licensed under the MIT License - see the LICENSE file for details. 