# BrowserRAG

BrowserRAG is an in-browser RAG (Retrieval Augmented Generation) chat application that allows users to converse with PDF and CSV documents entirely in their browser. No server required!

## 🌐 Live Demo

Try it out now: **[https://browser-rag.techie.fi/](https://browser-rag.techie.fi/)**

## Features

- 🔒 **Privacy-Focused**: All data processing happens in your browser. Your documents never leave your device.
- 📄 **Document Support**: Upload and process PDF and CSV files.
- 🔍 **Vector Search**: Uses localStorage-based vector store for efficient similarity search.
- 🧠 **Multiple AI Providers**: 
  - **Browser** (Transformers.js) - Run models directly in browser with WebGPU
  - **LMStudio** - Connect to your local LMStudio server
  - **Ollama** - Connect to your local Ollama installation
- 💬 **LLM Processing**: Choose from multiple models or use your own local models
- 🎯 **Default Settings**: Set your preferred provider and models to load automatically
- ⚙️ **Easy Configuration**: Global settings accessible from anywhere in the app
- 🚀 **Fully Client-Side**: No backend servers or API calls needed (when using browser mode)

## 🆕 What's New

### Local Model Support
- **LMStudio Integration**: Connect to your local LMStudio server for more powerful models
- **Ollama Integration**: Use Ollama's CLI-based model management
- **Flexible Configuration**: Switch between providers seamlessly
- **Default Provider**: Set your preferred provider and models to load on startup


## Getting Started

### Prerequisites

- Node.js and npm installed
- (Optional) LMStudio or Ollama for local model support

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

BrowserRAG implements a complete RAG pipeline:

1. **Document Processing**: When you upload PDF or CSV files, the app extracts text content.
2. **Chunking**: Long documents are split into manageable chunks with appropriate overlap.
3. **Embedding Generation**: Each chunk is converted to a vector embedding (browser-based by default, or via LMStudio/Ollama).
4. **Vector Storage**: Embeddings are stored in browser localStorage with an in-memory vector store.
5. **Query Processing**: When you ask a question, it's converted to an embedding and used to find similar document chunks.
6. **Context Construction**: Relevant chunks are assembled into a prompt for the LLM.
7. **Response Generation**: Generate responses using:
   - Browser models (Transformers.js with WebGPU)
   - Local LMStudio models
   - Local Ollama models

## Browser Compatibility

For optimal performance, BrowserRAG requires:

- A modern browser with WebGPU or WebGL2 support
- Chrome/Edge/Opera 113+, Firefox 94+, or Safari 16.4+
- At least 4GB of RAM for PDF and CSV processing

## Technologies Used

- **React**: Frontend UI
- **Vite**: Build system and development server
- **TypeScript**: Type-safe JavaScript
- **Transformers.js**: Run transformer models in the browser
- **LMStudio API**: OpenAI-compatible API for local models
- **Ollama API**: REST API for local model management
- **PDF.js**: PDF parsing
- **PapaParse**: CSV parsing

## License

This project is licensed under the MIT License - see the LICENSE file for details. 