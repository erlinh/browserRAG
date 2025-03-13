import { useState } from 'react';
import { Project } from '../services/projectService';
import './ProjectSelector.css';

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string, description: string) => void;
  onDeleteProject: (projectId: string) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject
}) => {
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim(), newProjectDescription.trim());
      setNewProjectName('');
      setNewProjectDescription('');
      setIsCreatingProject(false);
    }
  };

  const handleDeleteProject = (projectId: string) => {
    onDeleteProject(projectId);
    setShowConfirmDelete(null);
    
    // If we deleted the selected project, clear the selection
    if (selectedProjectId === projectId) {
      // The parent component should handle selecting a new project
    }
  };

  return (
    <div className="project-selector">
      <div className="project-selector-header">
        <h2>Projects</h2>
        <button 
          className="create-project-button"
          onClick={() => setIsCreatingProject(true)}
        >
          New Project
        </button>
      </div>

      {isCreatingProject && (
        <div className="create-project-form">
          <input
            type="text"
            placeholder="Project Name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="project-input"
          />
          <textarea
            placeholder="Project Description (optional)"
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
            className="project-textarea"
          />
          <div className="project-form-actions">
            <button 
              className="cancel-button"
              onClick={() => {
                setIsCreatingProject(false);
                setNewProjectName('');
                setNewProjectDescription('');
              }}
            >
              Cancel
            </button>
            <button 
              className="create-button"
              onClick={handleCreateProject}
              disabled={!newProjectName.trim()}
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="projects-list">
        {projects.length === 0 ? (
          <div className="no-projects">
            <p>No projects yet. Create your first project to get started!</p>
          </div>
        ) : (
          <ul>
            {projects.map((project) => (
              <li 
                key={project.id} 
                className={`project-item ${selectedProjectId === project.id ? 'selected' : ''}`}
              >
                <div 
                  className="project-item-content"
                  onClick={() => onSelectProject(project.id)}
                >
                  <div className="project-info">
                    <h3 className="project-name">{project.name}</h3>
                    {project.description && (
                      <p className="project-description">{project.description}</p>
                    )}
                    <p className="project-date">
                      Created: {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                {showConfirmDelete === project.id ? (
                  <div className="delete-confirmation">
                    <p>Delete this project and all its data?</p>
                    <div className="delete-actions">
                      <button 
                        className="cancel-delete"
                        onClick={() => setShowConfirmDelete(null)}
                      >
                        Cancel
                      </button>
                      <button 
                        className="confirm-delete"
                        onClick={() => handleDeleteProject(project.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    className="delete-project-button"
                    onClick={() => setShowConfirmDelete(project.id)}
                    aria-label="Delete project"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ProjectSelector; 