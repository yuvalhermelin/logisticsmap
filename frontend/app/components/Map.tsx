import { MapContainer, TileLayer, Popup, Polygon, FeatureGroup, Tooltip, CircleMarker } from 'react-leaflet';
import type { LatLngExpression, LatLngBounds } from 'leaflet';
import { useEffect, useState, useRef } from 'react';
import { EditControl } from 'react-leaflet-draw';
import Swal from 'sweetalert2';
import { api, typesApi, statusesApi, type Camp, type PolygonArea, type CampMarker } from '../services/api';
import EditablePolygon from './EditablePolygon';
import EditModeControl from './EditModeControl';
import { useLeafletSetup } from '../hooks/useLeafletSetup';
import { isPolygonInPolygon, isPointInPolygon } from '../utils/geometry';

//

// Types are now imported from the API service

interface MapProps {
  center?: LatLngExpression;
  zoom?: number;
  style?: React.CSSProperties;
}

// Enhanced EditablePolygon component
//

// Custom control component for edit mode
//

//

export default function Map({ 
  center = [31.364, 34.997], // Center of Israel from tile server metadata
  zoom = 10,
  style = { height: '500px', width: '100%' }
}: MapProps) {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);
  const [editingPolygonId, setEditingPolygonId] = useState<string | null>(null);
  const [editingCampId, setEditingCampId] = useState<string | null>(null);
  const [areaTypes, setAreaTypes] = useState<{ id: string; name: string }[]>([]);
  const [labelsEnabled, setLabelsEnabled] = useState<boolean>(true);
  const [markersEnabled, setMarkersEnabled] = useState<boolean>(true);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const featureGroupRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);
  const CONTENT_ZOOM_THRESHOLD = 12;
  const originalBoundsRef = useRef<{[key: string]: any}>({});
  const layerToPolygonRef = useRef<{[key: string]: {campId: string, polygonId: string}}>({});
  const layerToCampRef = useRef<{[key: string]: string}>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [areaStatuses, setAreaStatuses] = useState<{ id: string; name: string }[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  useLeafletSetup(featureGroupRef, originalBoundsRef);
  const [markersByCamp, setMarkersByCamp] = useState<Record<string, CampMarker[]>>({});

  useEffect(() => {
    if (!mapRef.current) return;
    const handleZoomEnd = () => {
      if (!isDrawingRef.current && mapRef.current) {
        setCurrentZoom(mapRef.current.getZoom());
      }
    };
    mapRef.current.on('zoomend', handleZoomEnd);
    return () => {
      if (mapRef.current) {
        mapRef.current.off('zoomend', handleZoomEnd);
      }
    };
  }, [mapRef.current]);

  //

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

  // Load camps from API when component mounts and when archive mode changes
  useEffect(() => {
    const loadCamps = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [loadedCamps, loadedTypes, loadedStatuses] = await Promise.all([
          isArchiveMode ? api.getCamps('only') : api.getCamps(false),
          typesApi.getAreaTypes(),
          statusesApi.getAreaStatuses()
        ]);
        setCamps(loadedCamps);
        setAreaTypes(loadedTypes);
        setAreaStatuses(loadedStatuses);
        // Load markers per camp
        const markerLists = await Promise.all(loadedCamps.map(c => api.getMarkers(c.id).catch(() => [])));
        const byCamp: Record<string, CampMarker[]> = {};
        loadedCamps.forEach((c, idx) => { byCamp[c.id] = markerLists[idx] as CampMarker[]; });
        setMarkersByCamp(byCamp);
      } catch (err) {
        console.error('Failed to load camps:', err);
        setError('נכשל בטעינת המחנות ממסד הנתונים');
      } finally {
        setIsLoading(false);
      }
    };

    setIsEditMode(false);
    setSelectedCampId(null);
    setEditingPolygonId(null);
    setEditingCampId(null);

    loadCamps();
  }, [isArchiveMode]);

  //

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

  // Handle when a polygon area is created within a camp
  const handlePolygonCreated = async (e: any) => {
    if (!selectedCampId) {
      showNotification('אנא בחר מחנה תחילה כדי להוסיף מבנהי פוליגון', 'error');
      return;
    }

    const selectedCamp = camps.find(camp => camp.id === selectedCampId);
    if (!selectedCamp) {
      showNotification('המחנה הנבחר לא נמצא', 'error');
      return;
    }

    const { layer } = e;
    const positions = layer.getLatLngs()[0].map((latlng: any) => [latlng.lat, latlng.lng] as LatLngExpression);
    
    // Check if the polygon is within the camp's polygon bounds
    const polygonInCamp = isPolygonInPolygon(positions, selectedCamp.positions);
    
    // Debug logging
    console.log('Polygon bounds check:', {
      polygonPositions: positions,
      campPositions: selectedCamp.positions,
      isInside: polygonInCamp
    });
    
    if (!polygonInCamp) {
      showNotification(`הפוליגון חייב להיות מצויר במלואו בתוך גבולות המחנה "${selectedCamp.name}". אנא נסה לצייר פוליגון קטן יותר או למקם אותו במלואו בתוך שטח המחנה.`, 'error');
      // Remove the layer from the map
      if (featureGroupRef.current) {
        featureGroupRef.current.removeLayer(layer);
      }
      return;
    }
    
    // Prompt user for polygon area details (name + type)
    const { value: areaName } = await Swal.fire({
      title: 'מבנה חדש',
      text: 'הכנס שם למבנה הזה:',
      input: 'text',
      inputPlaceholder: 'שם המבנה...',
      showCancelButton: true,
      confirmButtonText: 'הבא',
      cancelButtonText: 'ביטול',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'אנא הכנס שם למבנה!';
        }
        return null;
      }
    });

    if (areaName && areaName.trim()) {
      // Ask for area type
      let typeId: string | null = null;
      let typeName: string | null = null;
      const typeOptions = areaTypes.reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {} as Record<string, string>);
      const { value: chosen } = await Swal.fire({
        title: 'בחר סוג מבנה',
        input: 'select',
        inputOptions: { ...typeOptions, __new: '+ הוסף סוג חדש' },
        inputPlaceholder: 'בחר סוג...',
        showCancelButton: true,
        confirmButtonText: 'אישור',
        cancelButtonText: 'דלג',
      });
      if (chosen === '__new') {
        const { value: newTypeName } = await Swal.fire({
          title: 'סוג מבנה חדש',
          input: 'text',
          inputPlaceholder: 'שם סוג...',
          showCancelButton: true,
          confirmButtonText: 'צור',
          cancelButtonText: 'ביטול'
        });
        if (newTypeName && newTypeName.trim()) {
          try {
            const created = await typesApi.createAreaType(newTypeName.trim());
            setAreaTypes(prev => [...prev, created]);
            typeId = created.id;
            typeName = created.name;
          } catch (e) {
            console.error('Failed to create area type', e);
          }
        }
      } else if (chosen && chosen !== '') {
        const picked = areaTypes.find(t => t.id === chosen);
        if (picked) {
          typeId = picked.id;
          typeName = picked.name;
        }
      }

      // Ask for area status
      let statusId: string | null = null;
      let statusName: string | null = null;
      try {
        const statuses = await (await import('../services/api')).statusesApi.getAreaStatuses();
        const statusOptions = statuses.reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>);
        const { value: chosenStatus } = await Swal.fire({
          title: 'בחר סטטוס מבנה',
          input: 'select',
          inputOptions: { ...statusOptions, __new: '+ הוסף סטטוס חדש' },
          inputPlaceholder: 'בחר סטטוס...',
          showCancelButton: true,
          confirmButtonText: 'אישור',
          cancelButtonText: 'דלג',
        });
        if (chosenStatus === '__new') {
          const { value: newStatusName } = await Swal.fire({
            title: 'סטטוס מבנה חדש',
            input: 'text',
            inputPlaceholder: 'שם סטטוס...',
            showCancelButton: true,
            confirmButtonText: 'צור',
            cancelButtonText: 'ביטול'
          });
          if (newStatusName && newStatusName.trim()) {
            const created = await (await import('../services/api')).statusesApi.createAreaStatus(newStatusName.trim());
            statusId = created.id;
            statusName = created.name;
          }
        } else if (chosenStatus && chosenStatus !== '') {
          const picked = statuses.find((s) => s.id === chosenStatus);
          if (picked) { statusId = picked.id; statusName = picked.name; }
        }
      } catch (e) {
        console.error('Failed to load/create statuses', e);
      }
      try {
        const newPolygon: PolygonArea = {
          id: Date.now().toString(),
          name: areaName.trim(),
          typeId,
          typeName,
          statusId,
          statusName,
          positions: positions
        };

        const updatedCamp = await api.addPolygonToCamp(selectedCampId, newPolygon);
        setCamps(prev => prev.map(camp => 
          camp.id === selectedCampId ? updatedCamp : camp
        ));
        
        // Store mapping for editing - keep the layer in the feature group for editing
        const layerId = layer._leaflet_id;
        layerToPolygonRef.current[layerId] = {
          campId: selectedCampId,
          polygonId: newPolygon.id
        };
        
        // Keep the layer in the feature group for editing capability
        // But hide it since we'll render it with React
        layer.setStyle({ opacity: 0, fillOpacity: 0 });
        
        showNotification(`מבנה "${areaName.trim()}" נוסף בהצלחה!`, 'success');
      } catch (err) {
        console.error('Failed to add polygon:', err);
        showNotification(`נכשל בהוספת המבנה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`, 'error');
        
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

  // Handle when a marker is created within a selected camp
  const handleMarkerCreated = async (e: any) => {
    if (!selectedCampId) {
      showNotification('אנא בחר מחנה תחילה כדי להוסיף סימון פריט', 'error');
      // remove temp layer
      if (featureGroupRef.current) featureGroupRef.current.removeLayer(e.layer);
      return;
    }
    const camp = camps.find(c => c.id === selectedCampId);
    if (!camp) {
      showNotification('המחנה הנבחר לא נמצא', 'error');
      if (featureGroupRef.current) featureGroupRef.current.removeLayer(e.layer);
      return;
    }
    const latlng = e.layer.getLatLng();
    const point: LatLngExpression = [latlng.lat, latlng.lng];
    if (!isPointInPolygon(point, camp.positions)) {
      showNotification(`הסימון חייב להיות בתוך גבולות המחנה "${camp.name}"`, 'error');
      if (featureGroupRef.current) featureGroupRef.current.removeLayer(e.layer);
      return;
    }

    try {
      // Choose item from catalog (with option to add new)
      const catalog = await api.getInventoryCatalog();
      const options = catalog.reduce((acc: Record<string, string>, it) => { acc[it.id] = it.name; return acc; }, {});
      const { value: chosenItemId } = await Swal.fire({
        title: 'בחר פריט', input: 'select', inputOptions: { ...options, __new: '+ הוסף פריט חדש' },
        inputPlaceholder: 'בחר פריט...', showCancelButton: true, confirmButtonText: 'המשך', cancelButtonText: 'ביטול'
      });
      let inventoryItemId = chosenItemId as string | null;
      if (!inventoryItemId) { if (featureGroupRef.current) featureGroupRef.current.removeLayer(e.layer); return; }
      if (inventoryItemId === '__new') {
        const { value: newName } = await Swal.fire({ title: 'שם פריט חדש', input: 'text', inputPlaceholder: 'שם פריט...', showCancelButton: true, confirmButtonText: 'צור', cancelButtonText: 'ביטול' });
        if (!newName || !newName.trim()) { if (featureGroupRef.current) featureGroupRef.current.removeLayer(e.layer); return; }
        const created = await api.createInventoryItem(newName.trim());
        inventoryItemId = created.id;
      }

      const { value: qtyStr } = await Swal.fire({ title: 'כמות', input: 'number', inputValue: 1, inputAttributes: { min: '0', step: '1' }, showCancelButton: true, confirmButtonText: 'המשך', cancelButtonText: 'ביטול' });
      if (qtyStr === null) { if (featureGroupRef.current) featureGroupRef.current.removeLayer(e.layer); return; }
      const quantity = Math.max(0, parseInt(qtyStr as any, 10) || 0);

      const { value: expiry } = await Swal.fire({ title: 'תאריך תפוגה (אופציונלי)', input: 'date', showCancelButton: true, confirmButtonText: 'הבא', cancelButtonText: 'דלג' });
      const expiryDate = expiry ? new Date(expiry as string).toISOString().substring(0,10) : null;

      const colorOptions: Record<string, string> = {
        '#e11d48': 'אדום', '#f59e0b': 'כתום', '#10b981': 'ירוק', '#3b82f6': 'כחול', '#8b5cf6': 'סגול', '#f43f5e': 'ורוד', '#14b8a6': 'טורקיז', '#64748b': 'אפור'
      };
      const { value: color } = await Swal.fire({ title: 'בחר צבע סימון', input: 'select', inputOptions: colorOptions, inputValue: '#3b82f6', showCancelButton: true, confirmButtonText: 'שמור', cancelButtonText: 'ביטול' });
      if (!color) { if (featureGroupRef.current) featureGroupRef.current.removeLayer(e.layer); return; }

      const created = await api.createMarker({ campId: selectedCampId, lat: latlng.lat, lng: latlng.lng, color, inventoryItemId: inventoryItemId!, quantity, expiryDate });
      setMarkersByCamp(prev => ({ ...prev, [selectedCampId!]: [...(prev[selectedCampId!] || []), created] }));
      showNotification('סימון פריט נוסף בהצלחה!', 'success');
    } catch (err) {
      console.error('Failed to create marker', err);
      showNotification(`נכשל ביצירת הסימון: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`, 'error');
    } finally {
      if (featureGroupRef.current) featureGroupRef.current.removeLayer(e.layer);
    }
  };

  const handleCreated = (e: any) => {
    const type = e.layerType;
    if (type === 'marker') return handleMarkerCreated(e);
    if (type === 'polygon') {
      return selectedCampId ? handlePolygonCreated(e) : handleCampCreated(e);
    }
  };

  // Track drawing lifecycle to prevent re-renders during draw
  const handleDrawStart = () => {
    isDrawingRef.current = true;
  };

  const handleDrawStop = () => {
    isDrawingRef.current = false;
    // Sync zoom once drawing ends to refresh labels if needed
    if (mapRef.current) {
      setCurrentZoom(mapRef.current.getZoom());
    }
  };



    // Handle when a polygon is edited
  const handleEdited = (e: any) => {
    const layers = e.layers;
    
    layers.eachLayer((layer: any) => {
      const layerId = layer._leaflet_id;
      const polygonMapping = layerToPolygonRef.current[layerId];
      
      if (polygonMapping && layer.getLatLngs) {
        // This is a polygon that was edited
        const newPositions = layer.getLatLngs()[0].map((latlng: any) => [latlng.lat, latlng.lng] as LatLngExpression);
        const selectedCamp = camps.find(camp => camp.id === polygonMapping.campId);
        
        // Validate that the polygon is still within the camp bounds
        if (selectedCamp && !isPolygonInPolygon(newPositions, selectedCamp.positions)) {
          // Invalid edit - revert
          const originalPolygon = selectedCamp.polygonAreas.find(p => p.id === polygonMapping.polygonId);
          if (originalPolygon) {
            layer.setLatLngs(originalPolygon.positions);
            
            // Show notification using SweetAlert2 toast
            showNotification(`הפוליגון חייב להישאר בתוך גבולות המחנה "${selectedCamp.name}".`, 'error');
          }
          return;
        }
        
        // Valid edit - update React state
        if (selectedCamp) {
          const updatedPolygon = {
            positions: newPositions
          };
          
          setCamps(prev => prev.map(camp => 
            camp.id === polygonMapping.campId 
              ? { 
                  ...camp, 
                  polygonAreas: camp.polygonAreas.map(polygon => 
                    polygon.id === polygonMapping.polygonId 
                      ? { ...polygon, ...updatedPolygon }
                      : polygon
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
          
          // Validate that all existing polygons still fit within the new camp bounds
          const camp = camps.find(c => c.id === campId);
          if (camp) {
            const invalidPolygons = camp.polygonAreas.filter(polygon => 
              !isPolygonInPolygon(polygon.positions, newPositions)
            );
            
            if (invalidPolygons.length > 0) {
              // Invalid edit - some polygons would be outside the new camp bounds
              showNotification(
                `לא ניתן לשנות את גבולות המחנה מכיוון שהמבנים הבאים יהיו מחוץ לגבולות החדשים: ${invalidPolygons.map(p => p.name).join(', ')}. אנא הסר או הזז את המבנים תחילה.`,
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
          console.log('Non-polygon, non-camp edited:', layer.getLatLngs() || layer.getBounds());
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
        // Check if this is a polygon being deleted
        const polygonMapping = layerToPolygonRef.current[layerId];
        if (polygonMapping) {
          delete layerToPolygonRef.current[layerId];
          console.log('Polygon deleted from editing layer:', polygonMapping);
        } else {
          console.log('Unknown shape deleted:', layer.getLatLngs() || layer.getBounds());
        }
      }
    });
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    if (isArchiveMode) return;
    setIsEditMode(!isEditMode);
    setSelectedCampId(null);
    setEditingPolygonId(null);
    setEditingCampId(null);
  };

  // Select a camp for editing
  const selectCamp = (campId: string) => {
    setSelectedCampId(selectedCampId === campId ? null : campId);
  };

  // Toggle edit polygon
  const toggleEditPolygon = (polygonId: string) => {
    const newEditingId = editingPolygonId === polygonId ? null : polygonId;
    setEditingPolygonId(newEditingId);
    
    // Show/hide the corresponding editing layer
    if (featureGroupRef.current) {
      featureGroupRef.current.eachLayer((layer: any) => {
        const layerId = layer._leaflet_id;
        const polygonMapping = layerToPolygonRef.current[layerId];
        
        if (polygonMapping && polygonMapping.polygonId === polygonId) {
          if (newEditingId === polygonId) {
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

  // Update a polygon area
  const updatePolygonArea = async (campId: string, updatedPolygon: PolygonArea) => {
    const camp = camps.find(c => c.id === campId);
    if (!camp) return;
    
    // Check if the updated polygon is still within the camp bounds
    if (!isPolygonInPolygon(updatedPolygon.positions, camp.positions)) {
      showNotification(`הפוליגון חייב להישאר בתוך גבולות המחנה "${camp.name}". העדכון בוטל.`, 'error');
      
      // Don't update the state - this effectively cancels the edit
      // The UI will revert to the previous state automatically
      return;
    }
    
    try {
      const updatedCamp = await api.updatePolygonInCamp(campId, updatedPolygon.id, updatedPolygon);
      setCamps(prev => prev.map(camp => 
        camp.id === campId ? updatedCamp : camp
      ));
    } catch (err) {
      console.error('Failed to update polygon:', err);
      showNotification(`נכשל בעדכון המבנה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`, 'error');
    }
  };

  // Delete a polygon area with confirmation
  const deletePolygonArea = async (campId: string, polygonId: string) => {
    const camp = camps.find(c => c.id === campId);
    const polygon = camp?.polygonAreas.find(p => p.id === polygonId);
    
    if (!polygon) return;

    const result = await Swal.fire({
      title: 'מחק מבנה',
      text: `האם אתה בטוח שברצונך למחוק את "${polygon.name}"? פעולה זו לא ניתנת לביטול.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'כן, מחק!',
      cancelButtonText: 'ביטול'
    });

    if (result.isConfirmed) {
      try {
        const updatedCamp = await api.deletePolygonFromCamp(campId, polygonId);
        setCamps(prev => prev.map(camp => 
          camp.id === campId ? updatedCamp : camp
        ));
        showNotification('מבנה נמחק בהצלחה!', 'success');
      } catch (err) {
        console.error('Failed to delete polygon:', err);
        showNotification(`נכשל במחיקת המבנה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`, 'error');
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

  // Archive a camp with confirmation
  const deleteCamp = async (campId: string) => {
    const camp = camps.find(c => c.id === campId);
    if (!camp) return;

    const result = await Swal.fire({
      title: 'ארכב מחנה',
      text: `האם אתה בטוח שברצונך לארכב את "${camp.name}"? המחנה והנתונים יוסתרו מכל המסכים ויופיעו רק במצב ארכיון.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'כן, ארכב!',
      cancelButtonText: 'ביטול'
    });

    if (result.isConfirmed) {
      try {
        await api.archiveCamp(campId);
        setCamps(prev => prev.filter(c => c.id !== campId));
        
        // Reset selections if this camp was selected
        if (selectedCampId === campId) setSelectedCampId(null);
        if (editingCampId === campId) setEditingCampId(null);
        
        showNotification('המחנה הועבר לארכיון בהצלחה!', 'success');
      } catch (err) {
        console.error('Failed to archive camp:', err);
        showNotification(`נכשל בארכוב המחנה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`, 'error');
      }
    }
  };

  const unarchiveCamp = async (campId: string) => {
    const camp = camps.find(c => c.id === campId);
    if (!camp) return;
    const result = await Swal.fire({
      title: 'בטל ארכוב',
      text: `להחזיר את "${camp.name}" למערכת?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'כן, החזר',
      cancelButtonText: 'ביטול'
    });
    if (result.isConfirmed) {
      try {
        await api.unarchiveCamp(campId);
        setCamps(prev => prev.filter(c => c.id !== campId));
        showNotification('המחנה הוחזר בהצלחה!', 'success');
      } catch (e) {
        showNotification(`נכשל בביטול ארכוב: ${e instanceof Error ? e.message : 'שגיאה לא ידועה'}`, 'error');
      }
    }
  };

  const permanentlyDeleteCamp = async (campId: string) => {
    const camp = camps.find(c => c.id === campId);
    if (!camp) return;
    const result = await Swal.fire({
      title: 'מחיקה לצמיתות',
      text: `האם אתה בטוח שברצונך למחוק לצמיתות את "${camp.name}" וכל נתוניו? פעולה זו אינה ניתנת לשחזור.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'מחק לצמיתות',
      cancelButtonText: 'ביטול'
    });
    if (result.isConfirmed) {
      try {
        await api.permanentlyDeleteCamp(campId);
        setCamps(prev => prev.filter(c => c.id !== campId));
        showNotification('המחנה נמחק לצמיתות.', 'success');
      } catch (e) {
        showNotification(`נכשל במחיקה לצמיתות: ${e instanceof Error ? e.message : 'שגיאה לא ידועה'}`, 'error');
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
          ref={mapRef}
        >
          <TileLayer
            url={tileUrl}
            maxZoom={19}
            minZoom={1}
          />
          
          {/* Custom Edit Control positioned over the map (hidden in archive mode) */}
          {!isArchiveMode && (
            <EditModeControl
              isEditMode={isEditMode}
              onToggleEditMode={toggleEditMode}
              selectedCampId={selectedCampId}
              camps={camps}
              onSelectCamp={selectCamp}
              selectedCamp={selectedCamp || null}
              editingPolygonId={editingPolygonId}
              onToggleEditPolygon={toggleEditPolygon}
              onDeletePolygon={deletePolygonArea}
              editingCampId={editingCampId}
              onToggleEditCamp={toggleEditCamp}
              onDeleteCamp={deleteCamp}
            />
          )}

          {/* Labels, Filters, and Archive toggle controls */}
          <div className="leaflet-bottom leaflet-right" style={{ pointerEvents: 'auto', marginTop: '80px', marginRight: '10px' }}>
            <div className="leaflet-control leaflet-bar" style={{ backgroundColor: 'white', padding: '8px', boxShadow: '0 1px 5px rgba(0,0,0,0.65)', direction: 'rtl', marginBottom: '8px' }}>
              <label className="flex items-center space-x-2" style={{ gap: '8px' }}>
                <input type="checkbox" checked={labelsEnabled} onChange={(e) => setLabelsEnabled(e.target.checked)} />
                <span className="text-xs">הצג תוויות</span>
              </label>
            </div>
            <div className="leaflet-control leaflet-bar" style={{ backgroundColor: 'white', padding: '8px', boxShadow: '0 1px 5px rgba(0,0,0,0.65)', direction: 'rtl', marginBottom: '8px' }}>
              <label className="flex items-center space-x-2" style={{ gap: '8px' }}>
                <input type="checkbox" checked={markersEnabled} onChange={(e) => setMarkersEnabled(e.target.checked)} />
                <span className="text-xs">הצג סימונים</span>
              </label>
            </div>
            <div className="leaflet-control leaflet-bar" style={{ backgroundColor: 'white', padding: '8px', boxShadow: '0 1px 5px rgba(0,0,0,0.65)', direction: 'rtl', marginBottom: '8px', minWidth: '220px' }}>
              <div className="mb-2">
                <label className="block text-[10px] text-gray-600 mb-1">סינון לפי סוג מבנה</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                >
                  <option value="">הכל</option>
                  {areaTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-600 mb-1">סינון לפי סטטוס מבנה</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                >
                  <option value="">הכל</option>
                  {areaStatuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="leaflet-control leaflet-bar" style={{ backgroundColor: 'white', padding: '8px', boxShadow: '0 1px 5px rgba(0,0,0,0.65)', direction: 'rtl' }}>
              <button
                onClick={() => setIsArchiveMode(v => !v)}
                className={`px-3 py-1 rounded text-xs ${isArchiveMode ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
              >
                {isArchiveMode ? 'מצב ארכיון: פעיל' : 'הפעל מצב ארכיון'}
              </button>
            </div>
          </div>
          
          {/* Feature group for drawing controls */}
          <FeatureGroup ref={featureGroupRef}>
            <EditControl
              position="topright"
              onCreated={handleCreated}
              onEdited={handleEdited}
              onDeleted={handleDeleted}
              onDrawStart={handleDrawStart}
              onDrawStop={handleDrawStop}
                          draw={{
              rectangle: false,
              circle: false,
              circlemarker: false,
              marker: isArchiveMode ? false : (isEditMode && !!selectedCampId ? {} : false),
              polyline: false,
              polygon: isArchiveMode ? false : (isEditMode ? {
                allowIntersection: false,
                drawError: {
                  color: '#e1e100',
                  message: '<strong>שגיאה:</strong> קצוות הצורה לא יכולים להצטלב!'
                },
                shapeOptions: {
                  color: selectedCampId ? '#ff7800' : '#97009c',
                  weight: 2,
                  fillOpacity: selectedCampId ? 0.3 : 0.2
                }
              } : false)
            }}
                          edit={{
              featureGroup: featureGroupRef.current,
              edit: isArchiveMode ? false : (isEditMode ? {} : false),
              remove: isArchiveMode ? false : (isEditMode ? {} : false)
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
                {labelsEnabled && currentZoom < CONTENT_ZOOM_THRESHOLD && (
                  <Tooltip permanent direction="center" opacity={1} className="!bg-white !bg-opacity-80 !text-gray-800 !px-2 !py-1 !rounded !border !border-gray-300">
                    <span className="text-xs font-semibold">{camp.name}</span>
                  </Tooltip>
                )}
                <Popup>
                  <div style={{ direction: 'rtl', textAlign: 'right' }}>
                    <strong>מחנה: {camp.name}</strong>
                    <br />
                    <em>מבנהי פוליגון: {camp.polygonAreas.length}</em>
                    {!isArchiveMode && isEditMode && (
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
                          {editingCampId === camp.id ?  'סיים עריכת גבולות' : 'אפשר לערוך גבולות מחנה'}
                        </button>
                        <button
                          onClick={() => deleteCamp(camp.id)}
                          className="bg-indigo-600 text-white px-2 py-1 rounded text-sm hover:bg-indigo-700 w-full"
                        >
                          ארכב מחנה
                        </button>
                      </div>
                    )}
                    {isArchiveMode && (
                      <div className="mt-2 space-y-2">
                        <button
                          onClick={() => unarchiveCamp(camp.id)}
                          className="bg-green-600 text-white px-2 py-1 rounded text-sm hover:bg-green-700 w-full"
                        >
                          בטל ארכוב
                        </button>
                        <button
                          onClick={() => permanentlyDeleteCamp(camp.id)}
                          className="bg-red-600 text-white px-2 py-1 rounded text-sm hover:bg-red-700 w-full"
                        >
                          מחק לצמיתות
                        </button>
                      </div>
                    )}
                  </div>
                </Popup>
              </Polygon>

              {/* Enhanced polygon areas within the camp */}
              {currentZoom >= CONTENT_ZOOM_THRESHOLD && (
                camp.polygonAreas
                  .filter((polygon) => (!typeFilter || (polygon.typeId || '') === typeFilter) && (!statusFilter || (polygon.statusId || '') === statusFilter))
                  .map((polygon) => (
                  <EditablePolygon
                    key={polygon.id}
                    polygon={polygon}
                    isEditing={true}
                    onUpdate={(updatedPolygon) => { if (!isArchiveMode) updatePolygonArea(camp.id, updatedPolygon); }}
                    onDelete={() => { if (!isArchiveMode) deletePolygonArea(camp.id, polygon.id); }}
                    campName={camp.name}
                    campId={camp.id}
                    onInventoryUpdated={() => {
                      if (!isArchiveMode) {
                        api.getCamps().then(setCamps).catch(console.error);
                      }
                    }}
                    currentZoom={currentZoom}
                    labelZoomThreshold={CONTENT_ZOOM_THRESHOLD}
                    labelEnabled={labelsEnabled}
                    areaTypes={areaTypes}
                    areaStatuses={areaStatuses}
                    onTypeCreated={(created) => setAreaTypes((prev: { id: string; name: string }[]) => [...prev, created])}
                    onStatusCreated={(created) => setAreaStatuses((prev: { id: string; name: string }[]) => [...prev, created])}
                    isArchiveMode={isArchiveMode}
                  />
                ))
              )}

              {/* Camp-level markers */}
              {markersEnabled && currentZoom >= CONTENT_ZOOM_THRESHOLD && (markersByCamp[camp.id] || []).map((m) => (
                <CircleMarker key={m.id} center={[m.lat, m.lng]} pathOptions={{ color: m.color, fillColor: m.color }} radius={8}>
                  {labelsEnabled && currentZoom >= CONTENT_ZOOM_THRESHOLD && (
                    <Tooltip permanent direction="top" opacity={1} className="!bg-white !bg-opacity-80 !text-gray-800 !px-2 !py-1 !rounded !border !border-gray-300">
                      <span className="text-[10px] font-semibold">{m.itemName} × {m.quantity}</span>
                    </Tooltip>
                  )}
                  <Popup>
                    <div style={{ direction: 'rtl', textAlign: 'right', minWidth: '180px' }}>
                      <div className="text-sm font-semibold">{m.itemName}</div>
                      <div className="text-xs text-gray-600">כמות: {m.quantity}</div>
                      <div className="text-xs text-gray-600">תפוגה: {m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : '—'}</div>
                      {!isArchiveMode && (
                        <div className="mt-2 space-y-1">
                          <button
                            className="w-full px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                            onClick={async () => {
                              try {
                                const { value: qtyStr } = await Swal.fire({ title: 'עדכון כמות', input: 'number', inputValue: m.quantity, inputAttributes: { min: '0', step: '1' }, showCancelButton: true, confirmButtonText: 'שמור', cancelButtonText: 'ביטול' });
                                if (qtyStr === null) return;
                                const newQty = Math.max(0, parseInt(qtyStr as any, 10) || 0);
                                const updated = await api.updateMarker({ campId: camp.id, markerId: m.id, quantity: newQty });
                                setMarkersByCamp(prev => ({ ...prev, [camp.id]: (prev[camp.id] || []).map(x => x.id === m.id ? updated : x) }));
                                showNotification('כמות עודכנה', 'success');
                              } catch (e) { showNotification('נכשל בעדכון הכמות', 'error'); }
                            }}
                          >עדכן כמות</button>
                          <button
                            className="w-full px-2 py-1 bg-emerald-500 text-white text-xs rounded hover:bg-emerald-600"
                            onClick={async () => {
                              try {
                                const { value } = await Swal.fire({ title: 'עדכון תפוגה', input: 'date', inputValue: m.expiryDate ? new Date(m.expiryDate).toISOString().substring(0,10) : '', showCancelButton: true, confirmButtonText: 'שמור', cancelButtonText: 'ביטול' });
                                if (value === undefined) return;
                                const updated = await api.updateMarker({ campId: camp.id, markerId: m.id, expiryDate: value ? new Date(value as string).toISOString().substring(0,10) : null });
                                setMarkersByCamp(prev => ({ ...prev, [camp.id]: (prev[camp.id] || []).map(x => x.id === m.id ? updated : x) }));
                                showNotification('תאריך תפוגה עודכן', 'success');
                              } catch (e) { showNotification('נכשל בעדכון התפוגה', 'error'); }
                            }}
                          >עדכן תפוגה</button>
                          <button
                            className="w-full px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                            onClick={async () => {
                              const colorOptions: Record<string, string> = { '#e11d48': 'אדום', '#f59e0b': 'כתום', '#10b981': 'ירוק', '#3b82f6': 'כחול', '#8b5cf6': 'סגול', '#f43f5e': 'ורוד', '#14b8a6': 'טורקיז', '#64748b': 'אפור' };
                              const { value: color } = await Swal.fire({ title: 'בחר צבע', input: 'select', inputOptions: colorOptions, inputValue: m.color, showCancelButton: true, confirmButtonText: 'שמור', cancelButtonText: 'ביטול' });
                              if (!color) return;
                              try {
                                const updated = await api.updateMarker({ campId: camp.id, markerId: m.id, color: color as string });
                                setMarkersByCamp(prev => ({ ...prev, [camp.id]: (prev[camp.id] || []).map(x => x.id === m.id ? updated : x) }));
                                showNotification('צבע עודכן', 'success');
                              } catch {
                                showNotification('נכשל בעדכון הצבע', 'error');
                              }
                            }}
                          >עדכן צבע</button>
                          <button
                            className="w-full px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                            onClick={async () => {
                              const res = await Swal.fire({ title: 'מחק סימון', text: 'למחוק את הסימון?', icon: 'warning', showCancelButton: true, confirmButtonText: 'מחק', cancelButtonText: 'ביטול' });
                              if (!res.isConfirmed) return;
                              try {
                                await api.deleteMarker(camp.id, m.id);
                                setMarkersByCamp(prev => ({ ...prev, [camp.id]: (prev[camp.id] || []).filter(x => x.id !== m.id) }));
                                showNotification('הסימון נמחק', 'success');
                              } catch {
                                showNotification('נכשל במחיקה', 'error');
                              }
                            }}
                          >מחק</button>
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </div>
          ))}
        </MapContainer>
      </div>
    </div>
  );
} 