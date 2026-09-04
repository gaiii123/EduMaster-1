import config from '../config';
import './ModuleModals.css';

export default function ModuleSlideViewerModal({ item, onClose }) {
  const fileFullUrl = item.file_url ? `${config.apiBaseUrl}${item.file_url}` : null;
  const isPdf = item.file_url && item.file_url.toLowerCase().endsWith('.pdf');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>🖥️ {item.title}</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {item.description && (
            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.5 }}>
              {item.description}
            </p>
          )}

          {/* Slide Deck File Actions */}
          {fileFullUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.25rem',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.75rem' }}>📄</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#0369a1' }}>
                    {item.file_name || 'Lecture Presentation'}
                  </div>
                  {item.file_size && (
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.file_size}</span>
                  )}
                </div>
              </div>
              <a
                href={fileFullUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
              >
                ⬇ Download Slides
              </a>
            </div>
          )}

          {/* PDF Viewer Frame if PDF */}
          {fileFullUrl && isPdf ? (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', minHeight: 400 }}>
              <iframe
                src={fileFullUrl}
                title={item.title}
                width="100%"
                height="450px"
                style={{ border: 'none' }}
              />
            </div>
          ) : (
            item.content && (
              <div
                style={{
                  padding: '1.25rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                  color: '#1e293b',
                }}
              >
                {item.content}
              </div>
            )
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
