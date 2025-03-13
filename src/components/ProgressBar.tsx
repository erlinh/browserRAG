import React from 'react';
import './ProgressBar.css';

interface ProgressBarProps {
  progress: number;
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  stage?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, status, message, stage }) => {
  // Don't show if idle or 0 progress
  if (status === 'idle' || (progress === 0 && status !== 'loading')) {
    return null;
  }

  // Determine progress bar color based on status
  const getProgressColor = () => {
    switch (status) {
      case 'loading':
        return 'var(--progress-loading-color)';
      case 'success':
        return 'var(--progress-success-color)';
      case 'error':
        return 'var(--progress-error-color)';
      default:
        return 'var(--progress-loading-color)';
    }
  };

  // Get stage display name
  const getStageName = () => {
    if (!stage) return '';
    
    switch (stage) {
      case 'tokenizer':
        return 'Loading Tokenizer';
      case 'model':
        return 'Loading Model';
      case 'model-load':
        return 'Loading Model';
      case 'warmup':
        return 'Warming Up Model';
      case 'embedding':
        return 'Generating Embeddings';
      case 'retrieval':
        return 'Retrieving Context';
      case 'prompt':
        return 'Building Prompt';
      case 'generation':
        return 'Generating Response';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Error';
      default:
        return stage.charAt(0).toUpperCase() + stage.slice(1);
    }
  };

  // Calculate progress percentage with bounds checking
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const progressPercent = `${Math.round(clampedProgress)}%`;

  return (
    <div className={`progress-container ${status}`}>
      <div className="progress-info">
        <div className="progress-message">{message}</div>
        <div className="progress-percentage">{progressPercent}</div>
      </div>
      {stage && <div className="progress-stage">{getStageName()}</div>}
      <div className="progress-bar-outer">
        <div 
          className="progress-bar-inner" 
          style={{ 
            width: progressPercent,
            backgroundColor: getProgressColor()
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar; 