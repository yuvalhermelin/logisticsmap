import { useEffect, useState } from "react";
import type { Route } from "./+types/inventory-analytics";
import { api, typesApi, statusesApi } from "../services/api";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "אנליטיקת מלאי - המכולה" },
    { name: "description", content: "לוח מחוונים למודיעין עסקי לניהול מלאי" },
  ];
}

interface AnalyticsData {
  totalCamps: number;
  totalAreas: number;
  totalInventoryItems: number;
  totalQuantity: number;
  itemDistribution: Record<string, {
    name: string;
    totalQuantity: number;
    locationsCount: number;
    locations: any[];
  }>;
  campInventory: any[];
  areaDetails: any[];
}

interface SearchResult {
  itemId: string;
  itemName: string;
  quantity: number;
  campId: string;
  campName: string;
  areaId: string;
  areaName: string;
}

interface SearchFilters {
  query: string;
  itemName: string;
  campId: string;
  typeId: string;
  statusId: string;
  minQuantity: string;
  maxQuantity: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

export default function InventoryAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    itemName: '',
    campId: '',
    typeId: '',
    statusId: '',
    minQuantity: '',
    maxQuantity: ''
  });
  const [areaTypes, setAreaTypes] = useState<{ id: string; name: string }[]>([]);
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'search' | 'details'>('overview');

  useEffect(() => {
    loadAnalytics();
    typesApi.getAreaTypes().then(setAreaTypes).catch(console.error);
    statusesApi.getAreaStatuses().then(setStatuses).catch(console.error);
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await api.getInventoryAnalytics();
      setAnalytics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'נכשל בטעינת האנליטיקה');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchFilters.query && !searchFilters.itemName && !searchFilters.campId && 
        !searchFilters.typeId && !searchFilters.minQuantity && !searchFilters.maxQuantity) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const results = await api.searchInventory({
        query: searchFilters.query || undefined,
        itemName: searchFilters.itemName || undefined,
        campId: searchFilters.campId || undefined,
        typeId: searchFilters.typeId || undefined,
        statusId: searchFilters.statusId || undefined,
        minQuantity: searchFilters.minQuantity ? parseInt(searchFilters.minQuantity) : undefined,
        maxQuantity: searchFilters.maxQuantity ? parseInt(searchFilters.maxQuantity) : undefined,
      });
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleItemClick = async (itemName: string) => {
    try {
      const details = await api.getItemDetails(itemName);
      setSelectedItem(details);
      setActiveTab('details');
    } catch (err) {
      console.error('Failed to load item details:', err);
    }
  };

  const clearSearch = () => {
    setSearchFilters({
      query: '',
      itemName: '',
      campId: '',
      typeId: '',
      statusId: '',
      minQuantity: '',
      maxQuantity: ''
    });
    setSearchResults([]);
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchFilters]);

  if (loading) {
    return (
      <main className="pt-16 p-4 container mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">טוען אנליטיקה...</p>
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
            onClick={loadAnalytics}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            🔄 נסה שוב
          </button>
        </div>
      </main>
    );
  }

  if (!analytics) return null;

  // Prepare chart data
  const itemDistributionData = Object.values(analytics.itemDistribution).map(item => ({
    name: item.name,
    quantity: item.totalQuantity,
    locations: item.locationsCount
  }));

  const campInventoryData = analytics.campInventory.map(camp => ({
    name: camp.campName,
    areas: camp.areasCount,
    items: camp.totalItems,
    quantity: camp.totalQuantity
  }));

  const topItems = itemDistributionData
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return (
    <main className="pt-16 p-4 container mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">אנליטיקת מלאי</h1>
        <p className="text-gray-600">
          לוח מחוונים מקיף למודיעין עסקי לניהול מלאי
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <nav className="flex space-x-4">
          {[
            { id: 'overview', label: 'סקירה כללית' },
            { id: 'search', label: 'חיפוש וסינון' },
            { id: 'details', label: 'פרטי פריט' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'סך הכל מחנות', value: analytics.totalCamps, color: 'bg-blue-500' },
              { label: 'סך הכל מבנים', value: analytics.totalAreas, color: 'bg-green-500' },
              { label: 'פריטי מלאי', value: analytics.totalInventoryItems, color: 'bg-purple-500' },
              { label: 'כמות כוללת', value: analytics.totalQuantity, color: 'bg-orange-500' }
            ].map((metric, index) => (
              <div key={index} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{metric.value.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Simple Charts using CSS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Items List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">פריטים מובילים לפי כמות</h3>
              <div className="space-y-3">
                {topItems.map((item, index) => {
                  const maxQuantity = Math.max(...topItems.map(i => i.quantity));
                  const percentage = (item.quantity / maxQuantity) * 100;
                  
                  return (
                    <div key={item.name} className="flex items-center">
                      <div className="w-20 text-sm text-gray-600 truncate ml-3">
                        {item.name}
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-4 ml-3 relative">
                        <div 
                          className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="w-16 text-sm font-medium text-gray-900 text-right">
                        {item.quantity}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Camp Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">חלוקת מלאי מחנות</h3>
              <div className="space-y-3">
                {campInventoryData.map((camp, index) => {
                  const maxQuantity = Math.max(...campInventoryData.map(c => c.quantity));
                  const percentage = maxQuantity > 0 ? (camp.quantity / maxQuantity) * 100 : 0;
                  
                  return (
                    <div key={camp.name} className="flex items-center">
                      <div className="w-24 text-sm text-gray-600 truncate ml-3">
                        {camp.name}
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-4 ml-3 relative">
                        <div 
                          className="bg-green-500 h-4 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="w-16 text-sm font-medium text-gray-900 text-right">
                        {camp.quantity}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Item Distribution Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">פרטי חלוקת פריטים</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      שם הפריט
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      כמות כוללת
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      מיקומים
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      פעולות
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {itemDistributionData
                    .sort((a, b) => b.quantity - a.quantity)
                    .map((item) => (
                    <tr key={item.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.quantity.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.locations} מיקום{item.locations !== 1 ? 'ים' : ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleItemClick(item.name)}
                          className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                        >
                          צפה בפרטים
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          {/* Search Filters */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">חיפוש וסינון</h3>
              <button
                onClick={clearSearch}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                נקה הכל
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">חיפוש כללי</label>
                <input
                  type="text"
                  value={searchFilters.query}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, query: e.target.value }))}
                  placeholder="חפש פריטים, מבנים, מחנות..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">שם פריט</label>
                <input
                  type="text"
                  value={searchFilters.itemName}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, itemName: e.target.value }))}
                  placeholder="שם פריט ספציפי..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">מזהה מחנה</label>
                <input
                  type="text"
                  value={searchFilters.campId}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, campId: e.target.value }))}
                  placeholder="מזהה מחנה..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סוג מבנה</label>
                <select
                  value={searchFilters.typeId}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, typeId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">הכל</option>
                  {areaTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סטטוס מבנה</label>
                <select
                  value={searchFilters.statusId}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, statusId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">הכל</option>
                  {statuses.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">כמות מינימלית</label>
                <input
                  type="number"
                  min="0"
                  value={searchFilters.minQuantity}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, minQuantity: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">כמות מקסימלית</label>
                <input
                  type="number"
                  min="0"
                  value={searchFilters.maxQuantity}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, maxQuantity: e.target.value }))}
                  placeholder="ללא הגבלה"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={clearSearch}
                  className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  נקה מסננים
                </button>
              </div>
            </div>
          </div>

          {/* Search Results */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  תוצאות חיפוש ({searchResults.length})
                </h3>
                {searchLoading && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                )}
              </div>
            </div>
            
            {searchResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        שם פריט
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        כמות
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        מחנה
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        מבנה
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        פעולות
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {searchResults.map((result, index) => (
                      <tr key={`${result.itemId}-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{result.itemName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            ×{result.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{result.campName}</div>
                          <div className="text-sm text-gray-500">{result.campId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{result.areaName}</div>
                          <div className="text-sm text-gray-500">{result.areaId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleItemClick(result.itemName)}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            צפה בפרטים
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto h-12 w-12 bg-gray-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">?</span>
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">לא נמצאו תוצאות</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {Object.values(searchFilters).some(v => v) 
                    ? "נסה לשנות את קריטריוני החיפוש" 
                    : "השתמש במסננים למעלה כדי לחפש פריטי מלאי"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Item Details Tab */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {selectedItem ? (
            <>
              {/* Item Overview */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">{selectedItem.itemName}</h3>
                  <div className="flex space-x-2">
                    <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                      סך הכל: {selectedItem.totalQuantity}
                    </span>
                    <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                      {selectedItem.totalLocations} מיקום{selectedItem.totalLocations !== 1 ? 'ים' : ''}
                    </span>
                  </div>
                </div>
                
                {/* Camps with this item */}
                <div className="mt-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">חלוקה לפי מחנה</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedItem.camps.map((camp: any) => (
                      <div key={camp.campId} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-900">{camp.campName}</h5>
                          <span className="text-sm text-gray-500">×{camp.totalQuantity}</span>
                        </div>
                        <p className="text-sm text-gray-500 mb-3">{camp.areas.length} מבנה{camp.areas.length !== 1 ? 'ים' : ''}</p>
                        
                        <div className="space-y-2">
                          {camp.areas.map((area: any) => (
                            <div key={area.areaId} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded">
                              <span className="text-sm font-medium">{area.areaName}</span>
                              <span className="text-sm text-blue-600">×{area.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detailed Locations Table */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900">כל המיקומים</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          מחנה
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          מבנה
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          כמות
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          אחוז
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedItem.locations.map((location: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{location.campName}</div>
                            <div className="text-sm text-gray-500">{location.campId}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{location.areaName}</div>
                            <div className="text-sm text-gray-500">{location.areaId}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              ×{location.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {((location.quantity / selectedItem.totalQuantity) * 100).toFixed(1)}%
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="mx-auto h-12 w-12 bg-gray-400 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">📦</span>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">לא נבחר פריט</h3>
              <p className="mt-1 text-sm text-gray-500">
                בחר פריט מהסקירה הכללית או מתוצאות החיפוש כדי לצפות במידע מפורט
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
} 