import React, { useState, useEffect } from 'react';
import { useProvider, ProviderType } from '../contexts/ProviderContext';
import { 
  testLMStudioConnection, 
  listLMStudioModels, 
  setLMStudioConfig,
  LMStudioModel 
} from '../services/lmstudioService';
import {
  testOllamaConnection,
  listOllamaModels,
  setOllamaConfig,
  OllamaModel
} from '../services/ollamaService';
import './ProviderSelector.css';

const ProviderSelector: React.FC = () => {
  const { provider, setProvider, config, updateConfig } = useProvider();
  const [lmstudioUrl, setLmstudioUrl] = useState(config.lmstudioUrl || 'http://localhost:1234/v1');
  const [ollamaUrl, setOllamaUrl] = useState(config.ollamaUrl || 'http://localhost:11434');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [availableLMStudioModels, setAvailableLMStudioModels] = useState<LMStudioModel[]>([]);
  const [availableOllamaModels, setAvailableOllamaModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    setLmstudioUrl(config.lmstudioUrl || 'http://localhost:1234/v1');
    setOllamaUrl(config.ollamaUrl || 'http://localhost:11434');
  }, [config.lmstudioUrl, config.ollamaUrl]);

  const handleProviderChange = (newProvider: ProviderType) => {
    setProvider(newProvider);
    setTestStatus(null);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setLmstudioUrl(newUrl);
  };

  const handleLMStudioUrlBlur = () => {
    // Update config when user finishes editing
    updateConfig({ lmstudioUrl });
    setLMStudioConfig({ baseUrl: lmstudioUrl });
  };

  const handleOllamaUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setOllamaUrl(newUrl);
  };

  const handleOllamaUrlBlur = () => {
    // Update config when user finishes editing
    updateConfig({ ollamaUrl });
    setOllamaConfig({ baseUrl: ollamaUrl });
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestStatus('Testing connection...');

    if (provider === 'lmstudio') {
      // Save the URL first
      updateConfig({ lmstudioUrl });
      setLMStudioConfig({ baseUrl: lmstudioUrl });

      try {
        const result = await testLMStudioConnection();
        
        if (result.success) {
          setTestStatus(`✓ ${result.message}`);
          if (result.models && result.models.length > 0) {
            setAvailableLMStudioModels(result.models);
            // Auto-select first model if none selected
            if (!config.selectedLMStudioModel) {
              updateConfig({ selectedLMStudioModel: result.models[0].id });
            }
          }
        } else {
          setTestStatus(`✗ ${result.message}`);
        }
      } catch (error) {
        setTestStatus(`✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsTestingConnection(false);
      }
    } else if (provider === 'ollama') {
      // Save the URL first
      updateConfig({ ollamaUrl });
      setOllamaConfig({ baseUrl: ollamaUrl });

      try {
        const result = await testOllamaConnection();
        
        if (result.success) {
          setTestStatus(`✓ ${result.message}`);
          if (result.models && result.models.length > 0) {
            setAvailableOllamaModels(result.models);
            // Auto-select first model if none selected
            if (!config.selectedOllamaModel) {
              updateConfig({ selectedOllamaModel: result.models[0].name });
            }
          }
        } else {
          setTestStatus(`✗ ${result.message}`);
        }
      } catch (error) {
        setTestStatus(`✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsTestingConnection(false);
      }
    }
  };

  const handleLoadModels = async () => {
    setIsLoadingModels(true);
    
    try {
      if (provider === 'lmstudio') {
        const models = await listLMStudioModels();
        setAvailableLMStudioModels(models);
        setTestStatus(`✓ Loaded ${models.length} model(s)`);
        // Auto-select first model if none selected
        if (models.length > 0 && !config.selectedLMStudioModel) {
          updateConfig({ selectedLMStudioModel: models[0].id });
        }
      } else if (provider === 'ollama') {
        const models = await listOllamaModels();
        setAvailableOllamaModels(models);
        setTestStatus(`✓ Loaded ${models.length} model(s)`);
        // Auto-select first model if none selected
        if (models.length > 0 && !config.selectedOllamaModel) {
          updateConfig({ selectedOllamaModel: models[0].name });
        }
      }
    } catch (error) {
      setTestStatus(`✗ Failed to load models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleModelSelect = (modelId: string, isEmbedding: boolean = false) => {
    if (provider === 'lmstudio') {
      if (isEmbedding) {
        updateConfig({ selectedLMStudioEmbeddingModel: modelId });
      } else {
        updateConfig({ selectedLMStudioModel: modelId });
      }
    } else if (provider === 'ollama') {
      if (isEmbedding) {
        updateConfig({ selectedOllamaEmbeddingModel: modelId });
      } else {
        updateConfig({ selectedOllamaModel: modelId });
      }
    }
  };

  const handleSetAsDefault = () => {
    if (provider === 'lmstudio') {
      updateConfig({
        defaultProvider: 'lmstudio',
        defaultLMStudioModel: config.selectedLMStudioModel,
        defaultLMStudioEmbeddingModel: config.selectedLMStudioEmbeddingModel,
      });
      setTestStatus('✓ Set as default! This provider and models will be used on startup.');
    } else if (provider === 'ollama') {
      updateConfig({
        defaultProvider: 'ollama',
        defaultOllamaModel: config.selectedOllamaModel,
        defaultOllamaEmbeddingModel: config.selectedOllamaEmbeddingModel,
      });
      setTestStatus('✓ Set as default! This provider and models will be used on startup.');
    }
  };

  const isDefaultProvider = config.defaultProvider === provider;

  return (
    <div className="provider-selector">
      <div className="provider-options">
        <label className="provider-option">
          <input
            type="radio"
            name="provider"
            value="browser"
            checked={provider === 'browser'}
            onChange={() => handleProviderChange('browser')}
          />
          <div className="provider-details">
            <span className="provider-name">Browser (Transformers.js)</span>
            <span className="provider-description">Run models locally in your browser</span>
          </div>
        </label>

        <label className="provider-option">
          <input
            type="radio"
            name="provider"
            value="lmstudio"
            checked={provider === 'lmstudio'}
            onChange={() => handleProviderChange('lmstudio')}
          />
          <div className="provider-details">
            <span className="provider-name">LMStudio</span>
            <span className="provider-description">Connect to local LMStudio server</span>
          </div>
        </label>

        <label className="provider-option">
          <input
            type="radio"
            name="provider"
            value="ollama"
            checked={provider === 'ollama'}
            onChange={() => handleProviderChange('ollama')}
          />
          <div className="provider-details">
            <span className="provider-name">Ollama</span>
            <span className="provider-description">Connect to local Ollama server</span>
          </div>
        </label>
      </div>

      {provider === 'lmstudio' && (
        <div className="provider-config">
          <div className="config-section">
            <label htmlFor="lmstudio-url">LMStudio API URL:</label>
            <div className="url-input-group">
              <input
                id="lmstudio-url"
                type="text"
                value={lmstudioUrl}
                onChange={handleUrlChange}
                onBlur={handleLMStudioUrlBlur}
                placeholder="http://localhost:1234/v1"
                className="url-input"
              />
              <button
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="test-button"
              >
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            {testStatus && (
              <div className={`test-status ${testStatus.startsWith('✓') ? 'success' : 'error'}`}>
                {testStatus}
              </div>
            )}
          </div>

          {availableLMStudioModels.length > 0 && (
            <div className="config-section">
              <div className="models-header">
                <label>Available Models:</label>
                <button
                  onClick={handleLoadModels}
                  disabled={isLoadingModels}
                  className="refresh-button"
                >
                  {isLoadingModels ? 'Loading...' : '↻ Refresh'}
                </button>
              </div>
              
              <div className="model-selection">
                <div className="model-group">
                  <label htmlFor="lmstudio-chat-model" className="model-label">
                    Chat Model:
                  </label>
                  <select
                    id="lmstudio-chat-model"
                    value={config.selectedLMStudioModel || ''}
                    onChange={(e) => handleModelSelect(e.target.value, false)}
                    className="model-select"
                  >
                    <option value="">Select a model...</option>
                    {availableLMStudioModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="model-group">
                  <label htmlFor="lmstudio-embedding-model" className="model-label">
                    Embedding Model (optional):
                  </label>
                  <select
                    id="lmstudio-embedding-model"
                    value={config.selectedLMStudioEmbeddingModel || ''}
                    onChange={(e) => handleModelSelect(e.target.value, true)}
                    className="model-select"
                  >
                    <option value="">Use browser embeddings</option>
                    {availableLMStudioModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.id}
                      </option>
                    ))}
                  </select>
                  <span className="helper-text">
                    Leave empty to use browser-based embeddings (recommended for compatibility)
                  </span>
                </div>
              </div>

              <div className="default-button-container">
                <button
                  onClick={handleSetAsDefault}
                  disabled={!config.selectedLMStudioModel}
                  className={`default-button ${isDefaultProvider ? 'is-default' : ''}`}
                >
                  {isDefaultProvider ? '✓ Default Provider' : 'Set as Default'}
                </button>
                {isDefaultProvider && (
                  <span className="default-info">This will be used on startup</span>
                )}
              </div>
            </div>
          )}

          <div className="provider-info">
            <h4>Setup Instructions:</h4>
            <ol>
              <li>Download and install <a href="https://lmstudio.ai/" target="_blank" rel="noopener noreferrer">LMStudio</a></li>
              <li>Load a model in LMStudio</li>
              <li>Start the local server (usually on port 1234)</li>
              <li>Click "Test Connection" above to verify</li>
            </ol>
            <p className="note">
              <strong>Note:</strong> Make sure the LMStudio server is running before testing the connection.
            </p>
          </div>
        </div>
      )}

      {provider === 'ollama' && (
        <div className="provider-config">
          <div className="config-section">
            <label htmlFor="ollama-url">Ollama API URL:</label>
            <div className="url-input-group">
              <input
                id="ollama-url"
                type="text"
                value={ollamaUrl}
                onChange={handleOllamaUrlChange}
                onBlur={handleOllamaUrlBlur}
                placeholder="http://localhost:11434"
                className="url-input"
              />
              <button
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="test-button"
              >
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            {testStatus && (
              <div className={`test-status ${testStatus.startsWith('✓') ? 'success' : 'error'}`}>
                {testStatus}
              </div>
            )}
          </div>

          {availableOllamaModels.length > 0 && (
            <div className="config-section">
              <div className="models-header">
                <label>Available Models:</label>
                <button
                  onClick={handleLoadModels}
                  disabled={isLoadingModels}
                  className="refresh-button"
                >
                  {isLoadingModels ? 'Loading...' : '↻ Refresh'}
                </button>
              </div>
              
              <div className="model-selection">
                <div className="model-group">
                  <label htmlFor="ollama-chat-model" className="model-label">
                    Chat Model:
                  </label>
                  <select
                    id="ollama-chat-model"
                    value={config.selectedOllamaModel || ''}
                    onChange={(e) => handleModelSelect(e.target.value, false)}
                    className="model-select"
                  >
                    <option value="">Select a model...</option>
                    {availableOllamaModels.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="model-group">
                  <label htmlFor="ollama-embedding-model" className="model-label">
                    Embedding Model (optional):
                  </label>
                  <select
                    id="ollama-embedding-model"
                    value={config.selectedOllamaEmbeddingModel || ''}
                    onChange={(e) => handleModelSelect(e.target.value, true)}
                    className="model-select"
                  >
                    <option value="">Use browser embeddings</option>
                    {availableOllamaModels.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <span className="helper-text">
                    Leave empty to use browser-based embeddings (recommended for compatibility)
                  </span>
                </div>
              </div>

              <div className="default-button-container">
                <button
                  onClick={handleSetAsDefault}
                  disabled={!config.selectedOllamaModel}
                  className={`default-button ${isDefaultProvider ? 'is-default' : ''}`}
                >
                  {isDefaultProvider ? '✓ Default Provider' : 'Set as Default'}
                </button>
                {isDefaultProvider && (
                  <span className="default-info">This will be used on startup</span>
                )}
              </div>
            </div>
          )}

          <div className="provider-info">
            <h4>Setup Instructions:</h4>
            <ol>
              <li>Install Ollama from <a href="https://ollama.ai/" target="_blank" rel="noopener noreferrer">ollama.ai</a></li>
              <li>Pull a model: <code>ollama pull llama2</code> (or another model)</li>
              <li>The Ollama service starts automatically (port 11434)</li>
              <li>Click "Test Connection" above to verify</li>
            </ol>
            <p className="note">
              <strong>Note:</strong> For embeddings, consider pulling <code>nomic-embed-text</code> for best results.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderSelector;

