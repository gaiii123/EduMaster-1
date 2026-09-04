import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ModuleModals.css';

export default function ModuleNoteModal({ item, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>📝 {item.title}</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body" style={{ lineHeight: 1.7, color: '#1e293b' }}>
          {item.description && (
            <p style={{ color: '#64748b', fontSize: '0.95rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              {item.description}
            </p>
          )}

          <div className="note-content" style={{ marginTop: '0.5rem' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {item.content || 'No content provided for this note.'}
            </ReactMarkdown>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done Reading
          </button>
        </div>
      </div>
    </div>
  );
}
