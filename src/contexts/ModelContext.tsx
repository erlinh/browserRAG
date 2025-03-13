import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define the available models
export interface ModelOption {
  id: string;
  name: string;
  size: string;
  quality: string;
  speed: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX',
    name: 'DeepSeek R1 Distill (Default)',
    size: '1.5B',
    quality: 'Good',
    speed: 'Medium',
  },
  {
    id: 'onnx-community/Phi-3.5-mini-instruct-onnx-web',
    name: 'Phi-3.5-mini',
    size: '3B',
    quality: 'Great',
    speed: 'Slow',
  }
];

// Define progress information interface
export interface ProgressInfo {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  progress?: number;
  stage?: string;
}

// Define context interface
interface ModelContextType {
  selectedModel: ModelOption;
  setSelectedModel: (model: ModelOption) => void;
  progressInfo: ProgressInfo;
  setProgressInfo: (info: ProgressInfo) => void;
}

// Create context with default values
const ModelContext = createContext<ModelContextType>({
  selectedModel: MODEL_OPTIONS[0], // Default model
  setSelectedModel: () => {},
  progressInfo: { status: 'idle', message: '', progress: 0 },
  setProgressInfo: () => {},
});

// Create provider component
export const ModelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODEL_OPTIONS[0]);
  const [progressInfo, setProgressInfo] = useState<ProgressInfo>({
    status: 'idle',
    message: '',
    progress: 0,
  });

  return (
    <ModelContext.Provider
      value={{
        selectedModel,
        setSelectedModel,
        progressInfo,
        setProgressInfo,
      }}
    >
      {children}
    </ModelContext.Provider>
  );
};

// Create custom hook for using this context
export const useModel = () => useContext(ModelContext); 