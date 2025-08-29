import { useEffect, useMemo, useState } from "react";
import { api, typesApi, statusesApi, type Camp } from "../services/api";

export function meta() {
  return [
    { title: "תפוגות והתראות - המכולה" },
    { name: "description", content: "מעקב אחר פריטים עם תאריך תפוגה וניהול תאריכי תפוגה" },
  ];
}

interface ExpiryItem {
  itemId: string;
  itemName: string;
  quantity: number;
  expiryDate: string | null;
  addedAt?: string;
  campId: string;
  campName: string;
  areaId: string;
  areaName: string;
  isExpired: boolean;
}

export default function Tracking() {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [expiries, setExpiries] = useState<ExpiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    q: string;
    itemName: string;
    campId: string;
    areaId: string;
    status: 'expired' | 'active' | 'all';
    dateFrom: string;
    dateTo: string;
    typeId: string;
    statusId?: string;
  }>({ q: '', itemName: '', campId: '', areaId: '', status: 'expired', dateFrom: '', dateTo: '', typeId: '', statusId: '' });
  const [draftExpiryByKey, setDraftExpiryByKey] = useState<Record<string, string>>({});
  const [areaTypes, setAreaTypes] = useState<{ id: string; name: string }[]>([]);
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [campsData, expiriesData, types, sts] = await Promise.all([
          api.getCamps(),
          api.getExpiries({ status: 'expired' }),
          typesApi.getAreaTypes(),
          statusesApi.getAreaStatuses()
        ]);
        setCamps(campsData);
        setExpiries(expiriesData);
        setAreaTypes(types);
        setStatuses(sts);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'נכשל בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadExpiries = async () => {
    try {
      setLoading(true);
      const data = await api.getExpiries({
        q: filters.q || undefined,
        itemName: filters.itemName || undefined,
        campId: filters.campId || undefined,
        areaId: filters.areaId || undefined,
        status: filters.status,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        typeId: filters.typeId || undefined,
        statusId: filters.statusId || undefined,
      });
      setExpiries(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'נכשל בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const areasForSelectedCamp = useMemo(() => {
    const camp = camps.find(c => c.id === filters.campId);
    return camp ? camp.polygonAreas : [];
  }, [camps, filters.campId]);

  const handleChangeExpiry = async (item: ExpiryItem, newDate: string) => {
    try {
      setLoading(true);
      await api.updateInventoryInArea(item.campId, item.areaId, item.itemId, item.quantity, newDate || null);
      await loadExpiries();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'נכשל בעדכון תאריך התפוגה');
    } finally {
      setLoading(false);
    }
  };

  const normalizedDate = (iso?: string | null) => iso ? new Date(iso).toISOString().substring(0,10) : '';
  const itemKey = (i: ExpiryItem) => `${i.areaId}-${i.itemId}`;
  const saveIfChanged = async (i: ExpiryItem) => {
    const key = itemKey(i);
    const draft = draftExpiryByKey[key];
    const original = normalizedDate(i.expiryDate);
    if (draft !== undefined && draft !== original) {
      await handleChangeExpiry(i, draft);
    }
    setDraftExpiryByKey(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  };

  // legacy alert handlers removed

  if (loading) {
    return (
      <main className="pt-16 p-4 container mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">טוען נתונים...</p>
          </div>
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
          <button 
            onClick={loadExpiries}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            🔄 נסה שוב
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">תפוגות והתראות</h1>
        <p className="text-gray-600">פריטי מלאי עם תאריך תפוגה. פריטים שפגו מוצגים תחילה.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">חיפוש</label>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
              placeholder="חפש בשם פריט/מחנה/אזור"
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">סטטוס</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="expired">פג</option>
              <option value="active">פעיל</option>
              <option value="all">הכל</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">מחנה</label>
            <select
              value={filters.campId}
              onChange={(e) => setFilters(prev => ({ ...prev, campId: e.target.value, areaId: '' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">הכל</option>
              {camps.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">אזור</label>
            <select
              value={filters.areaId}
              onChange={(e) => setFilters(prev => ({ ...prev, areaId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              disabled={!filters.campId}
            >
              <option value="">הכל</option>
              {areasForSelectedCamp.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">סוג אזור</label>
            <select
              value={filters.typeId}
              onChange={(e) => setFilters(prev => ({ ...prev, typeId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">הכל</option>
              {areaTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">סטטוס אזור</label>
            <select
              value={filters.statusId || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, statusId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">הכל</option>
              {statuses.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">מתאריך</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">עד תאריך</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
        </div>
        <div className="flex justify-end mt-3 space-x-2">
          <button
            onClick={() => setFilters({ q: '', itemName: '', campId: '', areaId: '', status: 'expired', dateFrom: '', dateTo: '', typeId: '', statusId: '' })}
            className="px-4 py-2 border border-gray-300 rounded"
          >
            נקה
          </button>
          <button
            onClick={loadExpiries}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            סנן
          </button>
        </div>
      </div>

      {/* Expiries Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">פריטים עם תאריך תפוגה</h3>
        </div>
        {expiries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פריט</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מחנה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">אזור</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">כמות</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך תפוגה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expiries.map(item => (
                  <tr key={`${item.areaId}-${item.itemId}`} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap text-sm">{item.itemName}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm">{item.campName}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm">{item.areaName}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm">{item.quantity}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm">
                      <input
                        type="date"
                        value={draftExpiryByKey[itemKey(item)] ?? normalizedDate(item.expiryDate)}
                        onChange={(e) => setDraftExpiryByKey(prev => ({ ...prev, [itemKey(item)]: e.target.value }))}
                        onBlur={() => saveIfChanged(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            setDraftExpiryByKey(prev => {
                              const { [itemKey(item)]: _, ...rest } = prev;
                              return rest;
                            });
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.isExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {item.isExpired ? 'פג' : 'פעיל'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-gray-600">אין פריטים להצגה</div>
        )}
      </div>
    </main>
  );
} 