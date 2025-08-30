import { Polygon, Popup, Tooltip } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import Swal from 'sweetalert2';
import { statusesApi, typesApi, type PolygonArea } from '../services/api';
import InventoryManagement from './InventoryManagement';

interface EditablePolygonProps {
  polygon: PolygonArea;
  isEditing: boolean;
  onUpdate: (updatedPolygon: PolygonArea) => void;
  onDelete: () => void;
  campName: string;
  campId: string;
  onInventoryUpdated: () => void;
  currentZoom: number;
  labelZoomThreshold: number;
  labelEnabled: boolean;
  areaTypes: { id: string; name: string }[];
  areaStatuses: { id: string; name: string }[];
  onTypeCreated: (created: { id: string; name: string }) => void;
  onStatusCreated: (created: { id: string; name: string }) => void;
  isArchiveMode: boolean;
}

export default function EditablePolygon({ polygon, isEditing, onUpdate, onDelete, campName, campId, onInventoryUpdated, currentZoom, labelZoomThreshold, labelEnabled, areaTypes, areaStatuses, onTypeCreated, onStatusCreated, isArchiveMode }: EditablePolygonProps) {
  return (
    <Polygon
      positions={polygon.positions}
      color="#ff7800"
      fillColor="#ff7800"
      fillOpacity={0.4}
      weight={2}
      interactive={true}
    >
      {polygon.typeName && labelEnabled && currentZoom >= labelZoomThreshold && (
        <Tooltip permanent direction="center" opacity={1} className="!bg-white !bg-opacity-80 !text-gray-800 !px-2 !py-1 !rounded !border !border-gray-300">
          <span className="text-xs font-semibold">{polygon.typeName}</span>
        </Tooltip>
      )}
      <Popup maxWidth={400}>
        <div style={{ minWidth: '300px', direction: 'rtl', textAlign: 'right' }}>
          <div className="border-b pb-2 mb-3">
            <strong>מבנה: {polygon.name}</strong>
            <br />
            <em>במחנה: {campName}</em>
            {polygon.typeName && (
              <div className="text-xs text-gray-600 mt-1">סוג: {polygon.typeName}</div>
            )}
            {polygon.statusName && (
              <div className="text-xs text-gray-600 mt-1">סטטוס: {polygon.statusName}</div>
            )}
          </div>

          <div className="mb-3">
            <InventoryManagement
              campId={campId}
              polygonId={polygon.id}
              currentInventory={polygon.inventoryItems || []}
              currentFiles={polygon.files || []}
              onInventoryUpdated={onInventoryUpdated}
            />
          </div>

          {
            <div className="mt-3 pt-3 border-t space-y-2">
              {isArchiveMode ? (
                <div className="text-xs text-gray-700">
                  <div className="font-semibold mb-1">תיאור:</div>
                  <div className="whitespace-pre-wrap break-words">{polygon.description || '—'}</div>
                </div>
              ) : (
                <div>
                  <div className="text-xs text-gray-700 font-semibold mb-1">תיאור</div>
                  <textarea
                    defaultValue={polygon.description || ''}
                    placeholder="הכנס תיאור חופשי..."
                    className="w-full text-xs border border-gray-300 rounded p-2"
                    rows={3}
                    onBlur={(e) => {
                      const desc = e.target.value;
                      const updated: PolygonArea = { ...polygon, description: desc || null };
                      onUpdate(updated);
                    }}
                  />
                </div>
              )}
              {isArchiveMode ? (
                <div className="text-xs text-gray-700 space-y-1">
                  <div>סוג: {polygon.typeName || '—'}</div>
                  <div>סטטוס: {polygon.statusName || '—'}</div>
                </div>
              ) : (
                <>
                  <div className="text-xs text-gray-600 mt-2">
                    השתמש בכלי העריכה בסרגל הכלים כדי לשנות את הפוליגון הזה
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={polygon.typeId || ''}
                      onChange={async (e) => {
                        const selectedId = e.target.value;
                        let typeId = selectedId || null;
                        let typeName = null as string | null;
                        if (selectedId === '__new') {
                          const { value: newTypeName } = await Swal.fire({
                            title: 'סוג מבנה חדש',
                            input: 'text',
                            inputPlaceholder: 'שם סוג...',
                            showCancelButton: true,
                            confirmButtonText: 'צור',
                            cancelButtonText: 'ביטול'
                          });
                          if (newTypeName && newTypeName.trim()) {
                            const created = await typesApi.createAreaType(newTypeName.trim());
                            try { onTypeCreated(created); } catch {}
                            typeId = created.id;
                            typeName = created.name;
                          } else {
                            return;
                          }
                        } else if (selectedId) {
                          const picked = areaTypes.find((t) => t.id === selectedId);
                          typeName = picked ? picked.name : null;
                        }
                        const updated: PolygonArea = { ...polygon, typeId, typeName };
                        onUpdate(updated);
                      }}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">בחר סוג מבנה...</option>
                      {areaTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                      <option value="__new">+ הוסף סוג חדש</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={polygon.statusId || ''}
                      onChange={async (e) => {
                        const selectedId = e.target.value;
                        let statusId = selectedId || null;
                        let statusName = null as string | null;
                        if (selectedId === '__new') {
                          const { value: newStatusName } = await Swal.fire({
                            title: 'סטטוס מבנה חדש',
                            input: 'text',
                            inputPlaceholder: 'שם סטטוס...',
                            showCancelButton: true,
                            confirmButtonText: 'צור',
                            cancelButtonText: 'ביטול'
                          });
                          if (newStatusName && newStatusName.trim()) {
                            const created = await statusesApi.createAreaStatus(newStatusName.trim());
                            try { onStatusCreated(created); } catch {}
                            statusId = created.id;
                            statusName = created.name;
                          } else {
                            return;
                          }
                        } else if (selectedId) {
                          const picked = areaStatuses.find((s) => s.id === selectedId);
                          statusName = picked ? picked.name : null;
                        }
                        const updated: PolygonArea = { ...polygon, statusId, statusName };
                        onUpdate(updated);
                      }}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">בחר סטטוס מבנה...</option>
                      {areaStatuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                      <option value="__new">+ הוסף סטטוס חדש</option>
                    </select>
                  </div>
                  <button
                    onClick={onDelete}
                    className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 w-full"
                  >
                    מחק מבנה
                  </button>
                </>
              )}
            </div>
          }
        </div>
      </Popup>
    </Polygon>
  );
}


