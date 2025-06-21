import { MapContainer, TileLayer, Marker, Popup, Polygon, FeatureGroup, Rectangle } from 'react-leaflet';
import type { LatLngExpression, LatLngBounds } from 'leaflet';
import { useEffect, useState, useRef } from 'react';
import { EditControl } from 'react-leaflet-draw';
import Swal from 'sweetalert2';
import { api, type Camp, type RectangleArea } from '../services/api';
import InventoryManagement from './InventoryManagement';

// Function to fix default markers and load CSS - only runs in browser
const setupLeaflet = () => {
  if (typeof window !== 'undefined') {
    // Import Leaflet CSS and Leaflet Draw CSS
    import('leaflet/dist/leaflet.css');
    import('leaflet-draw/dist/leaflet.draw.css');
    
    // Dynamically import Leaflet and marker icons only in browser
    Promise.all([
      import('leaflet'),
      import('leaflet/dist/images/marker-icon-2x.png'),
      import('leaflet/dist/images/marker-icon.png'),
      import('leaflet/dist/images/marker-shadow.png')
    ]).then(([L, markerIcon2x, markerIcon, markerShadow]) => {
      delete (L.default.Icon.Default.prototype as any)._getIconUrl;
      L.default.Icon.Default.mergeOptions({
        iconUrl: markerIcon.default,
        iconRetinaUrl: markerIcon2x.default,
        shadowUrl: markerShadow.default,
      });

      // Fix for leaflet-draw rectangle issue
      // This patches the _readableArea function that has a bug in leaflet-draw
      if (typeof window !== 'undefined' && (window as any).L && (window as any).L.GeometryUtil) {
        const L = (window as any).L;
        if (L.GeometryUtil && L.GeometryUtil.readableArea) {
          const originalReadableArea = L.GeometryUtil.readableArea;
          L.GeometryUtil.readableArea = function(area: number, isMetric: any, precision: any) {
            let areaStr, units;
            const defaultPrecision = {km: 2, ha: 2, m: 0, mi: 2, ac: 2, yd: 0, ft: 0, nm: 2};
            precision = L.Util.extend({}, defaultPrecision, precision);
            
            if (isMetric) {
              units = ['ha', 'm'];
              const type = typeof isMetric;
              if (type === 'string') {
                units = [isMetric];
              } else if (type !== 'boolean') {
                units = isMetric;
              }

              if (area >= 1000000 && units.indexOf('km') !== -1) {
                areaStr = L.GeometryUtil.formattedNumber(area * 0.000001, precision.km) + ' קמ"ר';
              } else if (area >= 10000 && units.indexOf('ha') !== -1) {
                areaStr = L.GeometryUtil.formattedNumber(area * 0.0001, precision.ha) + ' הקטר';
              } else {
                areaStr = L.GeometryUtil.formattedNumber(area, precision.m) + ' מ"ר';
              }
            } else {
              area /= 0.836127; // Square yards in 1 meter

              if (area >= 3097600) { //3 097 600 square yards in 1 square mile
                areaStr = L.GeometryUtil.formattedNumber(area / 3097600, precision.mi) + ' מיל²';
              } else if (area >= 4840) { //4840 square yards in 1 acre
                areaStr = L.GeometryUtil.formattedNumber(area / 4840, precision.ac) + ' אקר';
              } else {
                areaStr = L.GeometryUtil.formattedNumber(area, precision.yd) + ' יארד²';
              }
            }

            return areaStr;
          };
        }
      }
    }).catch(console.error);
  }
};

// Types are now imported from the API service

interface MapProps {
  center?: LatLngExpression;
  zoom?: number;
  style?: React.CSSProperties;
}

// Enhanced EditableRectangle component with rotation support
interface EditableRectangleProps {
  rectangle: RectangleArea;
  isEditing: boolean;
  onUpdate: (updatedRectangle: RectangleArea) => void;
  onDelete: () => void;
  campName: string;
  campId: string;
  onInventoryUpdated: () => void;
}

function EditableRectangle({ rectangle, isEditing, onUpdate, onDelete, campName, campId, onInventoryUpdated }: EditableRectangleProps) {
  
  // Convert bounds to corner coordinates for rotation
  const getRotatedCorners = (bounds: LatLngBounds, rotation: number, center?: [number, number]): LatLngExpression[] => {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const nw = [ne.lat, sw.lng] as [number, number];
    const se = [sw.lat, ne.lng] as [number, number];
    
    const centerPoint = center || [(sw.lat + ne.lat) / 2, (sw.lng + ne.lng) / 2];
    
    if (rotation === 0) {
      return [
        [sw.lat, sw.lng] as LatLngExpression,
        nw as LatLngExpression,
        [ne.lat, ne.lng] as LatLngExpression,
        se as LatLngExpression
      ];
    }
    
    // Apply rotation around center point
    const rotatePoint = (point: [number, number], center: [number, number], angle: number): [number, number] => {
      const cos = Math.cos(angle * Math.PI / 180);
      const sin = Math.sin(angle * Math.PI / 180);
      const dx = point[1] - center[1];
      const dy = point[0] - center[0];
      return [
        center[0] + dx * cos - dy * sin,
        center[1] + dx * sin + dy * cos
      ];
    };
    
    return [
      rotatePoint([sw.lat, sw.lng], centerPoint, rotation) as LatLngExpression,
      rotatePoint(nw, centerPoint, rotation) as LatLngExpression,
      rotatePoint([ne.lat, ne.lng], centerPoint, rotation) as LatLngExpression,
      rotatePoint(se, centerPoint, rotation) as LatLngExpression
    ];
  };

  const corners = getRotatedCorners(rectangle.bounds, rectangle.rotation, rectangle.center);

  return (
    <Polygon
      positions={corners}
      color="#ff7800"
      fillColor="#ff7800"
      fillOpacity={0.4}
      weight={2}
      interactive={true}
    >
      <Popup maxWidth={400}>
        <div style={{ minWidth: '300px', direction: 'rtl', textAlign: 'right' }}>
          <div className="border-b pb-2 mb-3">
            <strong>אזור: {rectangle.name}</strong>
            <br />
            <em>במחנה: {campName}</em>
            <br />
            <small>סיבוב: {rectangle.rotation}°</small>
          </div>

          {/* Inventory Section */}
          <div className="mb-3">
            <InventoryManagement
              campId={campId}
              rectangleId={rectangle.id}
              currentInventory={rectangle.inventoryItems || []}
              onInventoryUpdated={onInventoryUpdated}
            />
          </div>

          {isEditing && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <div>
                <label className="block text-xs text-gray-600">סיבוב:</label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={rectangle.rotation}
                  onChange={(e) => onUpdate({ ...rectangle, rotation: parseInt(e.target.value) })}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-xs text-gray-500">{rectangle.rotation}°</div>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                השתמש בכלי העריכה בסרגל הכלים כדי לשנות גודל/להזיז את המלבן הזה
              </div>
              <button
                onClick={onDelete}
                className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 w-full"
              >
                מחק אזור
              </button>
            </div>
          )}
        </div>
      </Popup>
    </Polygon>
  );
}

// Custom control component for edit mode
interface EditModeControlProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  selectedCampId: string | null;
  camps: Camp[];
  onSelectCamp: (campId: string) => void;
  selectedCamp: Camp | null;
  editingRectangleId: string | null;
  onToggleEditRectangle: (rectangleId: string) => void;
  onDeleteRectangle: (campId: string, rectangleId: string) => void;
  editingCampId: string | null;
  onToggleEditCamp: (campId: string) => void;
  onDeleteCamp: (campId: string) => void;
}

function EditModeControl({ 
  isEditMode, 
  onToggleEditMode, 
  selectedCampId, 
  camps, 
  onSelectCamp, 
  selectedCamp,
  editingRectangleId,
  onToggleEditRectangle,
  onDeleteRectangle,
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
              מצב: {selectedCampId ? 'ציור מלבנים' : 'יצירת מחנה'}
            </div>
            <div style={{ fontSize: '11px', marginBottom: '10px', color: '#666' }}>
              {selectedCampId 
                ? 'צייר מלבנים בתוך גבולות המחנה הנבחר. המלבנים חייבים להיות כלולים במלואם בתוך פוליגון המחנה.'
                : 'צייר פוליגונים ליצירת מחנות. בחר מחנה למטה כדי להוסיף מלבנים.'
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
                      <span style={{ color: '#666' }}> ({camp.rectangleAreas.length})</span>
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

            {selectedCamp && selectedCamp.rectangleAreas.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>
                  אזורים ב{selectedCamp.name}:
                </div>
                {selectedCamp.rectangleAreas.map((rect) => (
                  <div key={rect.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '3px', 
                    marginBottom: '3px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '3px'
                  }}>
                    <div style={{ fontSize: '10px' }}>
                      <span>{rect.name}</span>
                      <span style={{ color: '#666' }}> ({rect.rotation}°)</span>
                    </div>
                    <div>
                      <button
                        onClick={() => onToggleEditRectangle(rect.id)}
                        style={{
                          padding: '2px 4px',
                          fontSize: '9px',
                          backgroundColor: editingRectangleId === rect.id ? '#2563eb' : '#d1d5db',
                          color: editingRectangleId === rect.id ? 'white' : '#374151',
                          border: 'none',
                          borderRadius: '2px',
                          cursor: 'pointer',
                          marginLeft: '3px'
                        }}
                      >
                        {editingRectangleId === rect.id ? 'עצור' : 'ערוך'}
                      </button>
                      <button
                        onClick={() => onDeleteRectangle(selectedCamp.id, rect.id)}
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

// Alternative winding number algorithm for point in polygon
const isPointInPolygonWindingNumber = (point: LatLngExpression, polygon: LatLngExpression[]): boolean => {
  const [px, py] = point as [number, number];
  let wn = 0; // winding number
  
  const n = polygon.length;
  if (n < 3) return false;
  
  for (let i = 0; i < n; i++) {
    const [x1, y1] = polygon[i] as [number, number];
    const [x2, y2] = polygon[(i + 1) % n] as [number, number];
    
    if (y1 <= py) {
      if (y2 > py) { // upward crossing
        if (isLeft(x1, y1, x2, y2, px, py) > 0) { // point left of edge
          wn++;
        }
      }
    } else {
      if (y2 <= py) { // downward crossing
        if (isLeft(x1, y1, x2, y2, px, py) < 0) { // point right of edge
          wn--;
        }
      }
    }
  }
  
  return wn !== 0;
};

// Helper function for winding number algorithm
const isLeft = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): number => {
  return ((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0));
};

// Point in polygon check using ray casting algorithm with fallback
const isPointInPolygon = (point: LatLngExpression, polygon: LatLngExpression[]): boolean => {
  const [lat, lng] = point as [number, number];
  
  const n = polygon.length;
  if (n < 3) return false; // Need at least 3 vertices for a polygon
  
  // Try winding number algorithm first (more reliable)
  const windingResult = isPointInPolygonWindingNumber(point, polygon);
  
  // Ray casting as backup
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i] as [number, number];
    const [xj, yj] = polygon[j] as [number, number];
    
    // Check if point is exactly on vertex
    if (Math.abs(lat - yi) < 1e-10 && Math.abs(lng - xi) < 1e-10) {
      return true;
    }
    
    // Ray casting: check if horizontal ray from point crosses edge
    if (((yi > lat) !== (yj > lat))) {
      // Calculate x-coordinate of intersection of the ray with the edge
      const intersectionX = xi + (lat - yi) / (yj - yi) * (xj - xi);
      
      // If intersection is to the right of the point, toggle inside
      if (lng < intersectionX) {
        inside = !inside;
      }
    }
  }
  
  // Additional debugging - compare both algorithms
  if (windingResult !== inside) {
    console.warn('Algorithm mismatch!', {
      point: [lat, lng],
      polygon: polygon,
      windingResult: windingResult,
      raycastResult: inside
    });
  }
  
  // Use winding number result as it's more robust
  return windingResult;
};

// Check if rectangle bounds are within polygon
const isRectangleInPolygon = (bounds: LatLngBounds, polygon: LatLngExpression[]): boolean => {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const nw = [ne.lat, sw.lng] as LatLngExpression;
  const se = [sw.lat, ne.lng] as LatLngExpression;
  
  // Calculate rectangle dimensions
  const width = Math.abs(ne.lng - sw.lng);
  const height = Math.abs(ne.lat - sw.lat);
  const isVerySmall = width < 0.001 && height < 0.001; // Very small rectangle threshold
  
  // For very small rectangles (like single points), just check the center
  if (isVerySmall) {
    const centerLat = (sw.lat + ne.lat) / 2;
    const centerLng = (sw.lng + ne.lng) / 2;
    const centerInside = isPointInPolygon([centerLat, centerLng], polygon);
    console.log('Very small rectangle, checking center only:', { center: [centerLat, centerLng], inside: centerInside });
    return centerInside;
  }
  
  // Check all four corners of the rectangle
  const corners = [
    [sw.lat, sw.lng] as LatLngExpression,
    nw,
    [ne.lat, ne.lng] as LatLngExpression,
    se
  ];
  
  // All corners must be inside the polygon
  const cornerResults = corners.map(corner => ({
    point: corner,
    inside: isPointInPolygon(corner, polygon)
  }));
  
  const allCornersInside = cornerResults.every(result => result.inside);
  
  // Debug logging for corners
  if (!allCornersInside) {
    console.log('Corner check failed:', cornerResults);
  }
  
  // For rectangles of normal size, also check center point as minimum requirement
  const centerLat = (sw.lat + ne.lat) / 2;
  const centerLng = (sw.lng + ne.lng) / 2;
  const centerInside = isPointInPolygon([centerLat, centerLng], polygon);
  
  // If all corners are inside, the rectangle is definitely inside
  if (allCornersInside) {
    return true;
  }
  
  // If center is not inside, rectangle is definitely not inside
  if (!centerInside) {
    return false;
  }
  
  // For edge cases, be more lenient - if center is inside and most corners are inside
  const cornersInside = cornerResults.filter(result => result.inside).length;
  const mostCornersInside = cornersInside >= Math.ceil(corners.length * 0.75); // 75% threshold
  
  return centerInside && mostCornersInside;
};

export default function Map({ 
  center = [31.364, 34.997], // Center of Israel from tile server metadata
  zoom = 10,
  style = { height: '500px', width: '100%' }
}: MapProps) {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);
  const [editingRectangleId, setEditingRectangleId] = useState<string | null>(null);
  const [editingCampId, setEditingCampId] = useState<string | null>(null);
  const featureGroupRef = useRef<any>(null);
  const originalBoundsRef = useRef<{[key: string]: any}>({});
  const layerToRectangleRef = useRef<{[key: string]: {campId: string, rectangleId: string}}>({});
  const layerToCampRef = useRef<{[key: string]: string}>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add custom CSS for leaflet-draw tooltips to make them less intrusive
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = `
        .leaflet-draw-tooltip {
          pointer-events: none !important;
          z-index: 1000 !important;
          opacity: 0.8 !important;
          font-size: 12px !important;
          background: rgba(0, 0, 0, 0.8) !important;
          color: white !important;
          border-radius: 4px !important;
          padding: 4px 8px !important;
          border: none !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
          transform: translateY(-10px) !important;
        }
        .leaflet-draw-tooltip:before {
          display: none !important;
        }
        .leaflet-draw-tooltip-single {
          margin-top: 8px !important;
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

  // Show notification function using SweetAlert2 toast
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    Swal.fire({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true,
      icon: type === 'success' ? 'success' : 'error',
      title: message,
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      }
    });
  };

  // Load camps from API when component mounts
  useEffect(() => {
    const loadCamps = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const loadedCamps = await api.getCamps();
        setCamps(loadedCamps);
      } catch (err) {
        console.error('Failed to load camps:', err);
        setError('נכשל בטעינת המחנות ממסד הנתונים');
      } finally {
        setIsLoading(false);
      }
    };

    loadCamps();
  }, []);

  // Setup Leaflet when component mounts
  useEffect(() => {
    setupLeaflet();
    
    // Set up event listeners for edit start
    const setupEditListeners = () => {
      if (featureGroupRef.current && featureGroupRef.current._map) {
        const map = featureGroupRef.current._map;
        
        // Listen for edit start events
        map.on('draw:editstart', (e: any) => {
          console.log('Edit started');
          // Store original bounds for all layers in the feature group
          if (featureGroupRef.current) {
            featureGroupRef.current.eachLayer((layer: any) => {
              if (layer.getBounds) {
                const layerId = layer._leaflet_id;
                originalBoundsRef.current[layerId] = layer.getBounds();
              }
            });
          }
        });
      }
    };
    
    // Setup Hebrew localization for leaflet-draw
    const setupHebrewLocalization = () => {
      if (typeof window !== 'undefined' && (window as any).L && (window as any).L.drawLocal) {
        const L = (window as any).L;
        
        // Customize tooltip text to Hebrew and make it less intrusive
        L.drawLocal.draw.handlers.rectangle.tooltip = {
          start: 'לחץ וגרור כדי לצייר מלבן'
        };
        
        L.drawLocal.draw.handlers.polygon.tooltip = {
          start: 'לחץ כדי להתחיל לצייר פוליגון',
          cont: 'לחץ כדי להמשיך לצייר פוליגון', 
          end: 'לחץ על הנקודה הראשונה כדי לסגור את הפוליגון'
        };

        L.drawLocal.draw.handlers.circle.tooltip = {
          start: 'לחץ וגרור כדי לצייר עיגול'
        };

        L.drawLocal.draw.handlers.marker.tooltip = {
          start: 'לחץ על המפה כדי להציב סמן'
        };

        L.drawLocal.draw.handlers.polyline.tooltip = {
          start: 'לחץ כדי להתחיל לצייר קו',
          cont: 'לחץ כדי להמשיך לצייר קו',
          end: 'לחץ על הנקודה האחרונה כדי לסיים את הקו'
        };

        // Also customize toolbar button text
        if (L.drawLocal.draw.toolbar.buttons) {
          L.drawLocal.draw.toolbar.buttons = {
            ...L.drawLocal.draw.toolbar.buttons,
            polygon: 'צייר פוליגון',
            rectangle: 'צייר מלבן',
            circle: 'צייר עיגול',
            marker: 'הוסף סמן',
            polyline: 'צייר קו'
          };
        }

        // Customize toolbar actions text
        L.drawLocal.draw.toolbar.actions = {
          title: 'בטל ציור',
          text: 'בטל'
        };

        L.drawLocal.draw.toolbar.finish = {
          title: 'סיים ציור',
          text: 'סיים'
        };

        L.drawLocal.draw.toolbar.undo = {
          title: 'מחק נקודה אחרונה',
          text: 'מחק נקודה אחרונה'
        };

        console.log('Hebrew localization applied to leaflet-draw');
      }
    };
    
    // Additional fix for leaflet-draw rectangle bug
    // This runs after the component mounts to ensure leaflet-draw is loaded
    const fixLeafletDraw = () => {
      if (typeof window !== 'undefined' && (window as any).L && (window as any).L.GeometryUtil) {
        const L = (window as any).L;
        if (L.GeometryUtil && L.GeometryUtil.readableArea) {
          const originalFunction = L.GeometryUtil.readableArea;
          L.GeometryUtil.readableArea = function(area: number, isMetric: any, precision: any) {
            let areaStr, units;
            const defaultPrecision = {km: 2, ha: 2, m: 0, mi: 2, ac: 2, yd: 0, ft: 0, nm: 2};
            precision = L.Util.extend({}, defaultPrecision, precision);
            
            if (isMetric) {
              units = ['ha', 'm'];
              const type = typeof isMetric;
              if (type === 'string') {
                units = [isMetric];
              } else if (type !== 'boolean') {
                units = isMetric;
              }

              if (area >= 1000000 && units.indexOf('km') !== -1) {
                areaStr = L.GeometryUtil.formattedNumber(area * 0.000001, precision.km) + ' קמ"ר';
              } else if (area >= 10000 && units.indexOf('ha') !== -1) {
                areaStr = L.GeometryUtil.formattedNumber(area * 0.0001, precision.ha) + ' הקטר';
              } else {
                areaStr = L.GeometryUtil.formattedNumber(area, precision.m) + ' מ"ר';
              }
            } else {
              area /= 0.836127;
              if (area >= 3097600) {
                areaStr = L.GeometryUtil.formattedNumber(area / 3097600, precision.mi) + ' מיל²';
              } else if (area >= 4840) {
                areaStr = L.GeometryUtil.formattedNumber(area / 4840, precision.ac) + ' אקר';
              } else {
                areaStr = L.GeometryUtil.formattedNumber(area, precision.yd) + ' יארד²';
              }
            }
            return areaStr;
          };
        }
      }
    };
    
    // Try to fix immediately and also after delays to ensure libraries are loaded
    fixLeafletDraw();
    setupHebrewLocalization();
    
    const timeoutId1 = setTimeout(() => {
      fixLeafletDraw();
      setupHebrewLocalization();
      setupEditListeners();
    }, 1000);
    
    const timeoutId2 = setTimeout(() => {
      setupHebrewLocalization();
    }, 2000);
    
    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      // Clean up event listeners
      if (featureGroupRef.current && featureGroupRef.current._map) {
        const map = featureGroupRef.current._map;
        map.off('draw:editstart');
      }
    };
  }, []);

  // Use the direct tileserver URL (we found the endpoint!)
  // The tileserver is serving israel tiles at: http://localhost:8080/styles/basic-preview/{z}/{x}/{y}.png
  // Add cache-busting parameter to ensure fresh tiles
  const tileUrl = 'http://localhost:8080/styles/basic-preview/{z}/{x}/{y}.png?v=' + Date.now();



  // Handle when a new polygon (camp) is created
  const handleCampCreated = async (e: any) => {
    const { layer } = e;
    const positions = layer.getLatLngs()[0].map((latlng: any) => [latlng.lat, latlng.lng] as LatLngExpression);
    
    // Prompt user for camp name using SweetAlert2
    const { value: campName } = await Swal.fire({
      title: 'מחנה חדש',
      text: 'הכנס שם למחנה הזה:',
      input: 'text',
      inputPlaceholder: 'שם המחנה...',
      showCancelButton: true,
      confirmButtonText: 'צור מחנה',
      cancelButtonText: 'ביטול',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'אנא הכנס שם למחנה!';
        }
        return null;
      }
    });

    if (campName && campName.trim()) {
      try {
        const newCamp = {
          id: Date.now().toString(), // Simple ID generation
          name: campName.trim(),
          positions: positions
        };
        
        const createdCamp = await api.createCamp(newCamp);
        setCamps(prev => [...prev, createdCamp]);
        
        // Show success notification
        showNotification(`מחנה "${campName.trim()}" נוצר בהצלחה!`, 'success');
      } catch (err) {
        console.error('Failed to create camp:', err);
        showNotification(`נכשל ביצירת המחנה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`, 'error');
      }
    }
    
    // Remove the layer from map since we'll render it with React
    if (featureGroupRef.current) {
      featureGroupRef.current.removeLayer(layer);
    }
  };

  // Handle when a rectangle area is created within a camp
  const handleRectangleCreated = async (e: any) => {
    if (!selectedCampId) {
      showNotification('אנא בחר מחנה תחילה כדי להוסיף אזורי מלבן', 'error');
      return;
    }

    const selectedCamp = camps.find(camp => camp.id === selectedCampId);
    if (!selectedCamp) {
      showNotification('המחנה הנבחר לא נמצא', 'error');
      return;
    }

    const { layer } = e;
    const bounds = layer.getBounds();
    
    // Check if the rectangle is within the camp's polygon bounds
    const rectangleInPolygon = isRectangleInPolygon(bounds, selectedCamp.positions);
    
    // Debug logging
    console.log('Rectangle bounds check:', {
      rectangleBounds: {
        sw: [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
        ne: [bounds.getNorthEast().lat, bounds.getNorthEast().lng]
      },
      campPositions: selectedCamp.positions,
      isInside: rectangleInPolygon
    });
    
    if (!rectangleInPolygon) {
      showNotification(`המלבן חייב להיות מצויר במלואו בתוך גבולות המחנה "${selectedCamp.name}". אנא נסה לצייר מלבן קטן יותר או למקם אותו במלואו בתוך שטח המחנה.`, 'error');
      // Remove the layer from the map
      if (featureGroupRef.current) {
        featureGroupRef.current.removeLayer(layer);
      }
      return;
    }
    
    const center = bounds.getCenter();
    
    // Prompt user for rectangle area name using SweetAlert2
    const { value: areaName } = await Swal.fire({
      title: 'אזור חדש',
      text: 'הכנס שם לאזור הזה:',
      input: 'text',
      inputPlaceholder: 'שם האזור...',
      showCancelButton: true,
      confirmButtonText: 'צור אזור',
      cancelButtonText: 'ביטול',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'אנא הכנס שם לאזור!';
        }
        return null;
      }
    });

    if (areaName && areaName.trim()) {
      try {
        const newRectangle: RectangleArea = {
          id: Date.now().toString(),
          name: areaName.trim(),
          bounds: bounds,
          rotation: 0,
          center: [center.lat, center.lng],
          width: Math.abs(bounds.getNorthEast().lng - bounds.getSouthWest().lng),
          height: Math.abs(bounds.getNorthEast().lat - bounds.getSouthWest().lat)
        };

        const updatedCamp = await api.addRectangleTocamp(selectedCampId, newRectangle);
        setCamps(prev => prev.map(camp => 
          camp.id === selectedCampId ? updatedCamp : camp
        ));
        
        // Store mapping for editing - keep the layer in the feature group for editing
        const layerId = layer._leaflet_id;
        layerToRectangleRef.current[layerId] = {
          campId: selectedCampId,
          rectangleId: newRectangle.id
        };
        
        // Keep the layer in the feature group for editing capability
        // But hide it since we'll render it with React
        layer.setStyle({ opacity: 0, fillOpacity: 0 });
        
        showNotification(`אזור "${areaName.trim()}" נוסף בהצלחה!`, 'success');
      } catch (err) {
        console.error('Failed to add rectangle:', err);
        showNotification(`נכשל בהוספת האזור: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`, 'error');
        
        // Remove the layer from the map on error
        if (featureGroupRef.current) {
          featureGroupRef.current.removeLayer(layer);
        }
      }
    } else {
      // Remove the layer if user cancels
      if (featureGroupRef.current) {
        featureGroupRef.current.removeLayer(layer);
      }
    }
  };



    // Handle when a polygon is edited
  const handleEdited = (e: any) => {
    const layers = e.layers;
    
    layers.eachLayer((layer: any) => {
      const layerId = layer._leaflet_id;
      const rectangleMapping = layerToRectangleRef.current[layerId];
      
      if (rectangleMapping && layer.getBounds) {
        // This is a rectangle that was edited
        const newBounds = layer.getBounds();
        const selectedCamp = camps.find(camp => camp.id === rectangleMapping.campId);
        
        // Validate that the rectangle is still within the camp bounds
        if (selectedCamp && !isRectangleInPolygon(newBounds, selectedCamp.positions)) {
          // Invalid edit - revert
          const originalBounds = originalBoundsRef.current[layerId];
          if (originalBounds) {
            layer.setBounds(originalBounds);
            
            // Show notification using SweetAlert2 toast
            showNotification(`המלבן חייב להישאר בתוך גבולות המחנה "${selectedCamp.name}".`, 'error');
          }
          return;
        }
        
        // Valid edit - update React state
        if (selectedCamp) {
          const newCenter = newBounds.getCenter();
          const updatedRectangle = {
            bounds: newBounds,
            center: [newCenter.lat, newCenter.lng] as [number, number],
            width: Math.abs(newBounds.getNorthEast().lng - newBounds.getSouthWest().lng),
            height: Math.abs(newBounds.getNorthEast().lat - newBounds.getSouthWest().lat)
          };
          
          setCamps(prev => prev.map(camp => 
            camp.id === rectangleMapping.campId 
              ? { 
                  ...camp, 
                  rectangleAreas: camp.rectangleAreas.map(rect => 
                    rect.id === rectangleMapping.rectangleId 
                      ? { ...rect, ...updatedRectangle }
                      : rect
                  ) 
                }
              : camp
          ));
          
          // Clean up original bounds
          delete originalBoundsRef.current[layerId];
        }
      } else if (layer.getLatLngs) {
        // This might be a camp polygon being edited
        const layerId = layer._leaflet_id;
        const campId = layerToCampRef.current[layerId];
        
        if (campId) {
          // This is a camp polygon that was edited
          const newPositions = layer.getLatLngs()[0].map((latlng: any) => [latlng.lat, latlng.lng] as LatLngExpression);
          
          // Validate that all existing rectangles still fit within the new camp bounds
          const camp = camps.find(c => c.id === campId);
          if (camp) {
            const invalidRectangles = camp.rectangleAreas.filter(rect => 
              !isRectangleInPolygon(rect.bounds, newPositions)
            );
            
            if (invalidRectangles.length > 0) {
              // Invalid edit - some rectangles would be outside the new camp bounds
              showNotification(
                `לא ניתן לשנות את גבולות המחנה מכיוון שהאזורים הבאים יהיו מחוץ לגבולות החדשים: ${invalidRectangles.map(r => r.name).join(', ')}. אנא הסר או הזז את האזורים תחילה.`,
                'error'
              );
              
              // Revert the edit by setting back to original positions
              const originalCamp = camps.find(c => c.id === campId);
              if (originalCamp) {
                layer.setLatLngs(originalCamp.positions);
              }
              return;
            }
            
            // Valid edit - update the camp in state and backend
            updateCampPolygon(campId, newPositions);
          }
        } else {
          console.log('Non-rectangle, non-camp edited:', layer.getLatLngs() || layer.getBounds());
        }
      }
    });
  };

  // Handle when a polygon is deleted
  const handleDeleted = (e: any) => {
    const layers = e.layers;
    layers.eachLayer((layer: any) => {
      const layerId = layer._leaflet_id;
      
      // Check if this is a camp polygon being deleted
      const campId = layerToCampRef.current[layerId];
      if (campId) {
        // Clean up the mapping
        delete layerToCampRef.current[layerId];
        
        // Stop editing this camp if it was being edited
        if (editingCampId === campId) {
          setEditingCampId(null);
        }
        
        console.log('Camp polygon deleted from editing layer:', campId);
      } else {
        // Check if this is a rectangle being deleted
        const rectangleMapping = layerToRectangleRef.current[layerId];
        if (rectangleMapping) {
          delete layerToRectangleRef.current[layerId];
          console.log('Rectangle deleted from editing layer:', rectangleMapping);
        } else {
          console.log('Unknown shape deleted:', layer.getLatLngs() || layer.getBounds());
        }
      }
    });
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setSelectedCampId(null);
    setEditingRectangleId(null);
    setEditingCampId(null);
  };

  // Select a camp for editing
  const selectCamp = (campId: string) => {
    setSelectedCampId(selectedCampId === campId ? null : campId);
  };

  // Toggle edit rectangle
  const toggleEditRectangle = (rectangleId: string) => {
    const newEditingId = editingRectangleId === rectangleId ? null : rectangleId;
    setEditingRectangleId(newEditingId);
    
    // Show/hide the corresponding editing layer
    if (featureGroupRef.current) {
      featureGroupRef.current.eachLayer((layer: any) => {
        const layerId = layer._leaflet_id;
        const rectangleMapping = layerToRectangleRef.current[layerId];
        
        if (rectangleMapping && rectangleMapping.rectangleId === rectangleId) {
          if (newEditingId === rectangleId) {
            // Make the layer visible for editing
            layer.setStyle({ opacity: 0.8, fillOpacity: 0.2, color: '#00ff00', weight: 3 });
          } else {
            // Hide the layer again
            layer.setStyle({ opacity: 0, fillOpacity: 0 });
          }
        }
      });
    }
  };

  // Update a rectangle area
  const updateRectangleArea = async (campId: string, updatedRectangle: RectangleArea) => {
    const camp = camps.find(c => c.id === campId);
    if (!camp) return;
    
    // Check if the updated rectangle is still within the camp bounds
    if (!isRectangleInPolygon(updatedRectangle.bounds, camp.positions)) {
      showNotification(`המלבן חייב להישאר בתוך גבולות המחנה "${camp.name}". העדכון בוטל.`, 'error');
      
      // Don't update the state - this effectively cancels the edit
      // The UI will revert to the previous state automatically
      return;
    }
    
    try {
      const updatedCamp = await api.updateRectangleInCamp(campId, updatedRectangle.id, updatedRectangle);
      setCamps(prev => prev.map(camp => 
        camp.id === campId ? updatedCamp : camp
      ));
    } catch (err) {
      console.error('Failed to update rectangle:', err);
      showNotification(`נכשל בעדכון האזור: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`, 'error');
    }
  };

  // Delete a rectangle area with confirmation
  const deleteRectangleArea = async (campId: string, rectangleId: string) => {
    const camp = camps.find(c => c.id === campId);
    const rectangle = camp?.rectangleAreas.find(r => r.id === rectangleId);
    
    if (!rectangle) return;

    const result = await Swal.fire({
      title: 'מחק אזור',
      text: `האם אתה בטוח שברצונך למחוק את "${rectangle.name}"? פעולה זו לא ניתנת לביטול.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'כן, מחק!',
      cancelButtonText: 'ביטול'
    });

    if (result.isConfirmed) {
      try {
        const updatedCamp = await api.deleteRectangleFromCamp(campId, rectangleId);
        setCamps(prev => prev.map(camp => 
          camp.id === campId ? updatedCamp : camp
        ));
        showNotification('אזור נמחק בהצלחה!', 'success');
      } catch (err) {
        console.error('Failed to delete rectangle:', err);
        showNotification(`נכשל במחיקת האזור: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`, 'error');
      }
    }
  };

  // Toggle edit camp
  const toggleEditCamp = (campId: string) => {
    const newEditingId = editingCampId === campId ? null : campId;
    setEditingCampId(newEditingId);
    
    // Add camp polygon to editing layer if editing starts
    if (newEditingId === campId && featureGroupRef.current) {
      const camp = camps.find(c => c.id === campId);
      if (camp) {
        // Create a temporary layer for editing the camp polygon
        const L = (window as any).L;
        if (L) {
          const polygon = L.polygon(camp.positions, {
            color: '#ff6b35',
            weight: 3,
            fillOpacity: 0.2
          });
          featureGroupRef.current.addLayer(polygon);
          
          // Map this layer to the camp
          const layerId = polygon._leaflet_id;
          layerToCampRef.current[layerId] = campId;
        }
      }
    } else {
      // Remove camp polygon from editing layer when editing stops
      if (featureGroupRef.current && editingCampId) {
        featureGroupRef.current.eachLayer((layer: any) => {
          const layerId = layer._leaflet_id;
          const layerCampId = layerToCampRef.current[layerId];
          if (layerCampId === editingCampId) {
            featureGroupRef.current.removeLayer(layer);
            delete layerToCampRef.current[layerId];
          }
        });
      }
    }
  };

  // Delete a camp with confirmation
  const deleteCamp = async (campId: string) => {
    const camp = camps.find(c => c.id === campId);
    if (!camp) return;

    const result = await Swal.fire({
      title: 'מחק מחנה',
      text: `האם אתה בטוח שברצונך למחוק את "${camp.name}"? פעולה זו תמחק גם את כל האזורים במחנה ולא ניתנת לביטול.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'כן, מחק!',
      cancelButtonText: 'ביטול'
    });

    if (result.isConfirmed) {
      try {
        await api.deleteCamp(campId);
        setCamps(prev => prev.filter(c => c.id !== campId));
        
        // Reset selections if this camp was selected
        if (selectedCampId === campId) setSelectedCampId(null);
        if (editingCampId === campId) setEditingCampId(null);
        
        showNotification('מחנה נמחק בהצלחה!', 'success');
      } catch (err) {
        console.error('Failed to delete camp:', err);
        showNotification(`נכשל במחיקת המחנה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`, 'error');
      }
    }
  };

  // Update a camp polygon
  const updateCampPolygon = async (campId: string, newPositions: LatLngExpression[]) => {
    try {
      const updatedCamp = await api.updateCamp(campId, { positions: newPositions });
      setCamps(prev => prev.map(camp => 
        camp.id === campId ? updatedCamp : camp
      ));
      showNotification('גבולות המחנה עודכנו בהצלחה!', 'success');
    } catch (err) {
      console.error('Failed to update camp polygon:', err);
      showNotification(`נכשל בעדכון גבולות המחנה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`, 'error');
      
      // Revert the visual change
      const originalCamp = camps.find(c => c.id === campId);
      if (originalCamp && featureGroupRef.current) {
        featureGroupRef.current.eachLayer((layer: any) => {
          const layerId = layer._leaflet_id;
          const layerCampId = layerToCampRef.current[layerId];
          if (layerCampId === campId && layer.setLatLngs) {
            layer.setLatLngs(originalCamp.positions);
          }
        });
      }
    }
  };

  // Get selected camp
  const selectedCamp = selectedCampId ? camps.find(camp => camp.id === selectedCampId) : null;

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>טוען נתוני מפה...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex items-center justify-center h-96">
        <div className="text-center text-red-600">
          <p className="text-lg mb-2">שגיאה בטעינת נתוני המפה</p>
          <p className="text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            רענן דף
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Map Container */}
      <div className="w-full">
        <MapContainer
          center={center}
          zoom={zoom}
          style={style}
          scrollWheelZoom={true}
        >
          <TileLayer
            url={tileUrl}
            maxZoom={19}
            minZoom={1}
          />
          
          {/* Custom Edit Control positioned over the map */}
          <EditModeControl
            isEditMode={isEditMode}
            onToggleEditMode={toggleEditMode}
            selectedCampId={selectedCampId}
            camps={camps}
            onSelectCamp={selectCamp}
            selectedCamp={selectedCamp || null}
            editingRectangleId={editingRectangleId}
            onToggleEditRectangle={toggleEditRectangle}
            onDeleteRectangle={deleteRectangleArea}
            editingCampId={editingCampId}
            onToggleEditCamp={toggleEditCamp}
            onDeleteCamp={deleteCamp}
          />
          
          {/* Feature group for drawing controls */}
          <FeatureGroup ref={featureGroupRef}>
            <EditControl
              position="topright"
              onCreated={selectedCampId ? handleRectangleCreated : handleCampCreated}
              onEdited={handleEdited}
              onDeleted={handleDeleted}
              draw={{
                rectangle: isEditMode && selectedCampId ? {
                  shapeOptions: {
                    color: '#ff7800',
                    weight: 2,
                    fillOpacity: 0.3
                  },
                  repeatMode: false,
                  showRadius: false
                } : false,
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: false,
                polygon: isEditMode && !selectedCampId ? {
                  allowIntersection: false,
                  drawError: {
                    color: '#e1e100',
                    message: '<strong>שגיאה:</strong> קצוות הצורה לא יכולים להצטלב!'
                  },
                  shapeOptions: {
                    color: '#97009c'
                  }
                } : false
              }}
                          edit={{
              featureGroup: featureGroupRef.current,
              edit: {},
              remove: {}
            }}
            />
          </FeatureGroup>
          


          {/* Render drawn camps */}
          {camps.map((camp) => (
            <div key={camp.id}>
              {/* Camp polygon */}
              <Polygon
                positions={camp.positions}
                color={editingCampId === camp.id ? "#ff6b35" : (selectedCampId === camp.id ? "#0066ff" : "#97009c")}
                fillColor={editingCampId === camp.id ? "#ff6b35" : (selectedCampId === camp.id ? "#0066ff" : "#97009c")}
                fillOpacity={editingCampId === camp.id ? 0.4 : (selectedCampId === camp.id ? 0.5 : 0.3)}
                weight={editingCampId === camp.id ? 5 : (selectedCampId === camp.id ? 4 : 2)}
                dashArray={editingCampId === camp.id ? "5, 5" : (selectedCampId === camp.id ? "10, 5" : undefined)}
              >
                <Popup>
                  <div style={{ direction: 'rtl', textAlign: 'right' }}>
                    <strong>מחנה: {camp.name}</strong>
                    <br />
                    <em>אזורי מלבן: {camp.rectangleAreas.length}</em>
                    {isEditMode && (
                      <div className="mt-2 space-y-2">
                        <button
                          onClick={() => selectCamp(camp.id)}
                          className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600 w-full"
                        >
                          {selectedCampId === camp.id ? 'בטל בחירה' : 'בחר לעריכה'}
                        </button>
                        <button
                          onClick={() => toggleEditCamp(camp.id)}
                          className={`px-2 py-1 rounded text-sm w-full ${
                            editingCampId === camp.id 
                              ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        >
                          {editingCampId === camp.id ? 'סיים עריכת גבולות' : 'ערוך גבולות מחנה'}
                        </button>
                        <button
                          onClick={() => deleteCamp(camp.id)}
                          className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600 w-full"
                        >
                          מחק מחנה
                        </button>
                      </div>
                    )}
                  </div>
                </Popup>
              </Polygon>

              {/* Enhanced rectangle areas within the camp */}
              {camp.rectangleAreas.map((rect) => (
                <EditableRectangle
                  key={rect.id}
                  rectangle={rect}
                  isEditing={isEditMode && editingRectangleId === rect.id}
                  onUpdate={(updatedRectangle) => updateRectangleArea(camp.id, updatedRectangle)}
                  onDelete={() => deleteRectangleArea(camp.id, rect.id)}
                  campName={camp.name}
                  campId={camp.id}
                  onInventoryUpdated={() => {
                    // Reload camps to get updated inventory data
                    api.getCamps().then(setCamps).catch(console.error);
                  }}
                />
              ))}
            </div>
          ))}
        </MapContainer>
      </div>
    </div>
  );
} 