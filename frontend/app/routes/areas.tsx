import { useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/areas";
import { api, typesApi, statusesApi, type Camp } from "../services/api";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "כל המבנים - המכולה" },
    { name: "description", content: "רשימת כל מבנהי הפוליגון עם סינון לפי סוג/סטטוס וחיפוש חופשי" },
  ];
}

type FlatArea = {
  campId: string;
  campName: string;
  id: string;
  name: string;
  typeId?: string | null;
  typeName?: string | null;
  statusId?: string | null;
  statusName?: string | null;
  positionsCount: number;
  itemsCount: number;
  itemsText: string; // for searching
};

export default function Areas() {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [data, typeList, statusList] = await Promise.all([
          api.getCamps(false),
          typesApi.getAreaTypes(),
          statusesApi.getAreaStatuses()
        ]);
        setCamps(data);
        setTypes(typeList);
        setStatuses(statusList);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'נכשל בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const allAreas: FlatArea[] = useMemo(() => {
    const list: FlatArea[] = [];
    camps.forEach(c => {
      c.polygonAreas.forEach(a => {
        const items = (a.inventoryItems || []);
        const itemsText = items.map(i => `${i.name} ${i.quantity}`).join(' ');
        list.push({
          campId: c.id,
          campName: c.name,
          id: a.id,
          name: a.name,
          typeId: a.typeId || null,
          typeName: a.typeName || null,
          statusId: a.statusId || null,
          statusName: a.statusName || null,
          positionsCount: a.positions.length,
          itemsCount: items.length,
          itemsText
        });
      });
    });
    return list;
  }, [camps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allAreas.filter(a =>
      (!typeFilter || a.typeId === typeFilter) &&
      (!statusFilter || a.statusId === statusFilter) &&
      (!q || a.name.toLowerCase().includes(q) || a.itemsText.toLowerCase().includes(q))
    );
  }, [allAreas, typeFilter, statusFilter, query]);

  if (loading) {
    return (
      <main className="pt-16 p-4 container mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">טוען מבנים...</div>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">כל המבנים</h1>
        <p className="text-gray-600">רשימה שטוחה של כל מבנהי הפוליגון במערכת</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">חיפוש</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חפש בשם מבנה או פריטים..."
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">סוג מבנה</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">הכל</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">סטטוס מבנה</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">הכל</option>
              {statuses.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מבנה</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מחנה</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סוג</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מיקומים</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פריטים</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map(area => (
              <tr key={area.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 whitespace-nowrap text-sm">
                  <div className="font-medium text-gray-900">{area.name}</div>
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm">{area.campName}</td>
                <td className="px-6 py-3 whitespace-nowrap text-sm">{area.typeName || '—'}</td>
                <td className="px-6 py-3 whitespace-nowrap text-sm">{area.statusName || '—'}</td>
                <td className="px-6 py-3 whitespace-nowrap text-sm">{area.positionsCount}</td>
                <td className="px-6 py-3 whitespace-nowrap text-sm">{area.itemsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-600">אין מבנים התואמים למסננים</div>
        )}
      </div>
    </main>
  );
}


