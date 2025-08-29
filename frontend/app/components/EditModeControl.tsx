import type { Camp } from '../services/api';

interface EditModeControlProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  selectedCampId: string | null;
  camps: Camp[];
  onSelectCamp: (campId: string) => void;
  selectedCamp: Camp | null;
  editingPolygonId: string | null;
  onToggleEditPolygon: (polygonId: string) => void;
  onDeletePolygon: (campId: string, polygonId: string) => void;
  editingCampId: string | null;
  onToggleEditCamp: (campId: string) => void;
  onDeleteCamp: (campId: string) => void;
}

export default function EditModeControl({ 
  isEditMode, 
  onToggleEditMode, 
  selectedCampId, 
  camps, 
  onSelectCamp, 
  selectedCamp,
  editingPolygonId,
  onToggleEditPolygon,
  onDeletePolygon,
  editingCampId,
  onToggleEditCamp,
  onDeleteCamp
}: EditModeControlProps) {
  return (
    <div className="leaflet-top leaflet-left" style={{ pointerEvents: 'auto', marginTop: '80px', marginRight: '10px' }}>
      <div className="leaflet-control leaflet-bar" style={{ 
        backgroundColor: 'white', 
        padding: '10px', 
        maxWidth: '300px',
        boxShadow: '0 1px 5px rgba(0,0,0,0.65)',
        direction: 'rtl',
        textAlign: 'right'
      }}>
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={onToggleEditMode}
            style={{
              padding: '8px 16px',
              backgroundColor: isEditMode ? '#dc2626' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            {isEditMode ? 'צא ממצב עריכה' : 'היכנס למצב עריכה'}
          </button>
        </div>

        {isEditMode && (
          <div>
            <div style={{ fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>
              מצב: {selectedCampId ? 'ציור פוליגונים' : 'יצירת מחנה'}
            </div>
            <div style={{ fontSize: '11px', marginBottom: '10px', color: '#666' }}>
              {selectedCampId 
                ? 'צייר פוליגונים בתוך גבולות המחנה הנבחר. הפוליגונים חייבים להיות כלולים במלואם בתוך פוליגון המחנה.'
                : 'צייר פוליגונים ליצירת מחנות. בחר מחנה למטה כדי להוסיף פוליגונים.'
              }
            </div>

            {camps.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>מחנות:</div>
                {camps.map((camp) => (
                  <div key={camp.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '4px', 
                    marginBottom: '4px',
                    backgroundColor: selectedCampId === camp.id ? '#e3f2fd' : '#f5f5f5',
                    borderRadius: '3px'
                  }}>
                    <div style={{ fontSize: '11px' }}>
                      <span style={{ fontWeight: selectedCampId === camp.id ? 'bold' : 'normal' }}>
                        {camp.name}
                      </span>
                      <span style={{ color: '#666' }}> ({camp.polygonAreas.length})</span>
                    </div>
                    <div>
                      <button
                        onClick={() => onSelectCamp(camp.id)}
                        style={{
                          padding: '2px 6px',
                          fontSize: '10px',
                          backgroundColor: selectedCampId === camp.id ? '#2563eb' : '#e5e7eb',
                          color: selectedCampId === camp.id ? 'white' : '#374151',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          marginLeft: '3px'
                        }}
                      >
                        {selectedCampId === camp.id ? 'נבחר' : 'בחר'}
                      </button>
                      <button
                        onClick={() => onToggleEditCamp(camp.id)}
                        style={{
                          padding: '2px 6px',
                          fontSize: '10px',
                          backgroundColor: editingCampId === camp.id ? '#f59e0b' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          marginLeft: '3px'
                        }}
                      >
                        {editingCampId === camp.id ? 'סיים' : 'ערוך'}
                      </button>
                      <button
                        onClick={() => onDeleteCamp(camp.id)}
                        style={{
                          padding: '2px 6px',
                          fontSize: '10px',
                          backgroundColor: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedCamp && selectedCamp.polygonAreas.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>
                  אזורים ב{selectedCamp.name}:
                </div>
                {selectedCamp.polygonAreas.map((polygon) => (
                  <div key={polygon.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '3px', 
                    marginBottom: '3px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '3px'
                  }}>
                    <div style={{ fontSize: '10px' }}>
                      <span>{polygon.name}</span>
                    </div>
                    <div>
                      <button
                        onClick={() => onToggleEditPolygon(polygon.id)}
                        style={{
                          padding: '2px 4px',
                          fontSize: '9px',
                          backgroundColor: editingPolygonId === polygon.id ? '#2563eb' : '#d1d5db',
                          color: editingPolygonId === polygon.id ? 'white' : '#374151',
                          border: 'none',
                          borderRadius: '2px',
                          cursor: 'pointer',
                          marginLeft: '3px'
                        }}
                      >
                        {editingPolygonId === polygon.id ? 'עצור' : 'ערוך'}
                      </button>
                      <button
                        onClick={() => onDeletePolygon(selectedCamp.id, polygon.id)}
                        style={{
                          padding: '2px 4px',
                          fontSize: '9px',
                          backgroundColor: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '2px',
                          cursor: 'pointer'
                        }}
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


