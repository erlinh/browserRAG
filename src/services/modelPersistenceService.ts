// Model persistence service
// This service handles saving and loading model information and preferences

// Model information structure
export interface ModelInfo {
  id: string;
  name: string;
  type: string;
  path?: string;
  isDownloaded: boolean;
  lastUsed?: Date;
  downloadedAt?: Date;
}

// Storage keys
const MODELS_STORAGE_KEY = 'browserrag_models';
const SELECTED_MODEL_KEY = 'browserrag_selected_model';

// In-memory cache
let models: ModelInfo[] = [];
let selectedModelId: string | null = null;

/**
 * Initialize model data from local storage
 */
export const initializeModelData = (): void => {
  try {
    // Load models
    const storedModels = localStorage.getItem(MODELS_STORAGE_KEY);
    if (storedModels) {
      models = JSON.parse(storedModels);
      // Convert string dates back to Date objects
      models.forEach(model => {
        if (model.lastUsed) model.lastUsed = new Date(model.lastUsed);
        if (model.downloadedAt) model.downloadedAt = new Date(model.downloadedAt);
      });
    }

    // Load selected model
    const storedSelectedModel = localStorage.getItem(SELECTED_MODEL_KEY);
    if (storedSelectedModel) {
      selectedModelId = storedSelectedModel;
    }

    console.log('Model data loaded from local storage');
  } catch (error) {
    console.error('Error loading model data from local storage:', error);
    // Initialize with empty data if there's an error
    models = [];
    selectedModelId = null;
  }
};

/**
 * Save model data to local storage
 */
const saveToLocalStorage = (): void => {
  try {
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(models));
    if (selectedModelId) {
      localStorage.setItem(SELECTED_MODEL_KEY, selectedModelId);
    } else {
      localStorage.removeItem(SELECTED_MODEL_KEY);
    }
  } catch (error) {
    console.error('Error saving model data to local storage:', error);
  }
};

/**
 * Add or update a model
 */
export const saveModel = (model: ModelInfo): void => {
  const existingIndex = models.findIndex(m => m.id === model.id);
  
  if (existingIndex >= 0) {
    // Update existing model
    models[existingIndex] = {
      ...models[existingIndex],
      ...model
    };
  } else {
    // Add new model
    models.push(model);
  }
  
  saveToLocalStorage();
};

/**
 * Get all models
 */
export const getAllModels = (): ModelInfo[] => {
  return [...models];
};

/**
 * Get a model by ID
 */
export const getModelById = (modelId: string): ModelInfo | null => {
  return models.find(m => m.id === modelId) || null;
};

/**
 * Delete a model
 */
export const deleteModel = (modelId: string): boolean => {
  const initialLength = models.length;
  models = models.filter(m => m.id !== modelId);
  
  if (models.length < initialLength) {
    // If we deleted the selected model, clear the selection
    if (selectedModelId === modelId) {
      selectedModelId = null;
    }
    
    saveToLocalStorage();
    return true;
  }
  
  return false;
};

/**
 * Set the selected model
 */
export const setSelectedModel = (modelId: string): boolean => {
  const model = getModelById(modelId);
  if (!model) return false;
  
  selectedModelId = modelId;
  
  // Update last used timestamp
  model.lastUsed = new Date();
  
  saveToLocalStorage();
  return true;
};

/**
 * Get the selected model
 */
export const getSelectedModel = (): ModelInfo | null => {
  if (!selectedModelId) return null;
  return getModelById(selectedModelId);
};

/**
 * Mark a model as downloaded
 */
export const markModelAsDownloaded = (modelId: string, path?: string): boolean => {
  const model = getModelById(modelId);
  if (!model) return false;
  
  model.isDownloaded = true;
  model.downloadedAt = new Date();
  if (path) model.path = path;
  
  saveToLocalStorage();
  return true;
};

/**
 * Get all downloaded models
 */
export const getDownloadedModels = (): ModelInfo[] => {
  return models.filter(m => m.isDownloaded);
}; 