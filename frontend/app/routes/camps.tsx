import { useEffect, useState } from "react";
import type { Route } from "./+types/camps";
import { api, typesApi, type Camp, statusesApi } from "../services/api";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "סקירת מחנות - המכולה" },
    { name: "description", content: "צפה בכל המחנות, המבנים והמלבנים בפורמט טבלה מפורט" },
  ];
}

interface ExpandedCamps {
  [campId: string]: boolean;
}

export default function Camps() {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCamps, setExpandedCamps] = useState<ExpandedCamps>({});
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchCamps = async () => {
      try {
        setLoading(true);
        const [data, typeList, statusList] = await Promise.all([api.getCamps(false), typesApi.getAreaTypes(), statusesApi.getAreaStatuses()]);
        setCamps(data);
        setTypes(typeList);
        setStatuses(statusList);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'נכשל באחזור המחנות');
      } finally {
        setLoading(false);
      }
    };

    fetchCamps();
  }, []);

  const toggleCampExpansion = (campId: string) => {
    setExpandedCamps(prev => ({
      ...prev,
      [campId]: !prev[campId]
    }));
  };

  const formatCoordinate = (coord: number) => {
    return coord.toFixed(6);
  };

  const getRectangleBounds = (rectangle: any) => {
    if (rectangle.bounds?.getSouthWest && rectangle.bounds?.getNorthEast) {
      const sw = rectangle.bounds.getSouthWest();
      const ne = rectangle.bounds.getNorthEast();
      return { sw, ne };
    }
    return null;
  };

  if (loading) {
    return (
      <main className="pt-16 p-4 container mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">טוען מחנות...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="pt-16 p-4 container mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h2 className="text-lg font-medium text-red-800 mb-2">שגיאה</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">סקירת מחנות</h1>
        <p className="text-gray-600">
          סקירה מלאה של כל המחנות, המבנים שלהם והגדרות המלבנים
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-end space-x-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">סינון לפי סוג מבנה</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">הכל</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">סינון לפי סטטוס</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">הכל</option>
              {statuses.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {camps.filter(c => c.polygonAreas.some(a => (!typeFilter || a.typeId === typeFilter) && (!statusFilter || a.statusId === statusFilter))).length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center">
          <h2 className="text-xl font-medium text-gray-700 mb-2">לא נמצאו מחנות</h2>
          <p className="text-gray-500">אין מחנות עם מבנים התואמים למסננים.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  פרטי מחנה
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מיקומים
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מבנים ומלאי
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {camps
                .filter(c => c.polygonAreas.some(a => (!typeFilter || a.typeId === typeFilter) && (!statusFilter || a.statusId === statusFilter)))
                .map((camp) => (
                <>
                  <tr key={camp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{camp.name}</div>
                        <div className="text-sm text-gray-500">מזהה: {camp.id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {camp.positions.length} מיקום{camp.positions.length !== 1 ? 'ים' : ''}
                      </div>
                      <div className="text-xs text-gray-500 max-w-xs">
                        {camp.positions.slice(0, 2).map((pos, idx) => {
                          const [lat, lng] = pos as [number, number];
                          return (
                            <div key={idx}>
                              ({formatCoordinate(lat)}, {formatCoordinate(lng)})
                            </div>
                          );
                        })}
                        {camp.positions.length > 2 && (
                          <div className="text-gray-400">
                            +{camp.positions.length - 2} נוספים...
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{camp.polygonAreas.length} מבנה{camp.polygonAreas.length !== 1 ? 'ים' : ''}</div>
                      {(() => {
                        const totalItems = camp.polygonAreas.reduce((total, area) => 
                          total + (area.inventoryItems?.length || 0), 0
                        );
                        const uniqueItemTypes = new Set(
                          camp.polygonAreas.flatMap(area => 
                            area.inventoryItems?.map(item => item.name) || []
                          )
                        ).size;
                        
                        return totalItems > 0 ? (
                          <div className="text-xs text-gray-500">
                            {totalItems} פריט{totalItems !== 1 ? 'י' : ''} מלאי 
                            {uniqueItemTypes > 0 && ` (${uniqueItemTypes} סוג${uniqueItemTypes !== 1 ? 'ים' : ''})`}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 italic">אין מלאי</div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => toggleCampExpansion(camp.id)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                      >
                        {expandedCamps[camp.id] ? '▼ הסתר מבנים' : '▶ הצג מבנים'}
                      </button>
                    </td>
                  </tr>
                  
                  {expandedCamps[camp.id] && camp.polygonAreas.length > 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 bg-gray-50">
                        <div className="mr-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-3">
                            מבנהי פוליגון ({camp.polygonAreas.length})
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 bg-white rounded-md shadow-sm">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                    שם מבנה
                                  </th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                    מזהה
                                  </th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                    מיקומים
                                  </th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                    פריטי מלאי
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {camp.polygonAreas
                                  .filter(area => (!typeFilter || area.typeId === typeFilter) && (!statusFilter || area.statusId === statusFilter))
                                  .map((area) => {
                                  return (
                                    <tr key={area.id} className="hover:bg-gray-50">
                                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                        {area.name}
                                        {area.typeName && (
                                          <div className="text-xs text-gray-500">סוג: {area.typeName}</div>
                                        )}
                                        {area.statusName && (
                                          <div className="text-xs text-gray-500">סטטוס: {area.statusName}</div>
                                        )}
                                        {area.description && (
                                          <div className="text-xs text-gray-600 whitespace-pre-wrap break-words mt-1">{area.description}</div>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-500 font-mono">
                                        {area.id}
                                      </td>
                                      <td className="px-4 py-2 text-xs text-gray-600">
                                        <div className="max-w-xs">
                                          {area.positions.slice(0, 3).map((pos, idx) => {
                                            const [lat, lng] = pos as [number, number];
                                            return (
                                              <div key={idx}>
                                                ({formatCoordinate(lat)}, {formatCoordinate(lng)})
                                              </div>
                                            );
                                          })}
                                          {area.positions.length > 3 && (
                                            <div className="text-gray-400">
                                              +{area.positions.length - 3} נוספים...
                                            </div>
                                          )}
                                          <div className="text-gray-500 text-xs">
                                            סך הכל: {area.positions.length} מיקומים
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-2 text-xs text-gray-600">
                                        {area.inventoryItems && area.inventoryItems.length > 0 ? (
                                          <div className="space-y-1 max-w-xs">
                                            {area.inventoryItems.slice(0, 3).map((item) => (
                                              <div key={item.id} className="flex justify-between bg-blue-50 px-2 py-1 rounded border-r-2 border-blue-300">
                                                <span className="truncate ml-2 font-medium">{item.name}</span>
                                                <span className="font-bold text-blue-700 whitespace-nowrap">×{item.quantity}</span>
                                              </div>
                                            ))}
                                            {area.inventoryItems.length > 3 && (
                                              <div className="text-gray-500 text-center font-medium">
                                                +{area.inventoryItems.length - 3} פריטים נוספים
                                              </div>
                                            )}
                                            <div className="text-gray-500 text-center pt-1 border-t border-gray-200 mt-2">
                                              סך הכל: {area.inventoryItems.reduce((sum, item) => sum + item.quantity, 0)} פריטים
                                            </div>
                                          </div>
                                        ) : (
                                          <span className="text-gray-400 italic">אין מלאי</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  
                  {expandedCamps[camp.id] && camp.polygonAreas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 bg-gray-50">
                        <div className="mr-4 text-sm text-gray-500 italic">
                          לא הוגדרו מבנהי פוליגון למחנה זה
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
} 