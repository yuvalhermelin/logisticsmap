import { useEffect, useState } from "react";
import { api } from "../services/api";

export function meta() {
  return [
    { title: "מעקב והתראות מלאי - מפה לוגיסטית" },
    { name: "description", content: "ניהול התראות לרמות מלאי נמוכות" },
  ];
}

interface Alert {
  id: string;
  itemName: string;
  alertType: 'area' | 'global';
  threshold: number;
  campId?: string;
  campName?: string;
  areaId?: string;
  areaName?: string;
  isActive: boolean;
  createdAt: string;
  currentQuantity?: number;
  isTriggered?: boolean;
}

interface CreateAlertForm {
  itemName: string;
  alertType: 'area' | 'global';
  threshold: string;
  campId: string;
  areaId: string;
}

interface Camp {
  id: string;
  name: string;
  rectangleAreas: Array<{
    id: string;
    name: string;
  }>;
}

export default function Tracking() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<Alert[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [availableItems, setAvailableItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'triggered' | 'create'>('active');

  const [createForm, setCreateForm] = useState<CreateAlertForm>({
    itemName: '',
    alertType: 'global',
    threshold: '',
    campId: '',
    areaId: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [alertsData, campsData, analytics] = await Promise.all([
        api.getAlerts(),
        api.getCamps(),
        api.getInventoryAnalytics()
      ]);
      
      setAlerts(alertsData);
      setCamps(campsData);
      
      // Extract unique item names from analytics
      const itemNames = Object.keys(analytics.itemDistribution || {});
      setAvailableItems(itemNames);
      
      // Load triggered alerts
      const triggered = await api.getTriggeredAlerts();
      setTriggeredAlerts(triggered);
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'נכשל בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createForm.itemName || !createForm.threshold) {
      alert('נא למלא את כל השדות הנדרשים');
      return;
    }

    try {
      const alertData = {
        itemName: createForm.itemName,
        alertType: createForm.alertType,
        threshold: parseInt(createForm.threshold),
        campId: createForm.alertType === 'area' ? createForm.campId : undefined,
        areaId: createForm.alertType === 'area' ? createForm.areaId : undefined,
        isActive: true
      };

      await api.createAlert(alertData);
      await loadData();
      setCreateForm({
        itemName: '',
        alertType: 'global',
        threshold: '',
        campId: '',
        areaId: ''
      });
      setActiveTab('active');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'נכשל ביצירת ההתראה');
    }
  };

  const handleToggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      await api.updateAlert(alertId, { isActive: !isActive });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'נכשל בעדכון ההתראה');
    }
  };

  const handleUpdateThreshold = async (alertId: string, threshold: number) => {
    try {
      await api.updateAlert(alertId, { threshold });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'נכשל בעדכון הסף');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק התראה זו?')) return;
    
    try {
      await api.deleteAlert(alertId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'נכשל במחיקת ההתראה');
    }
  };

  const getSelectedCamp = () => {
    return camps.find(camp => camp.id === createForm.campId);
  };

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
            onClick={loadData}
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">מעקב והתראות מלאי</h1>
        <p className="text-gray-600">
          הגדר התראות עבור רמות מלאי נמוכות באזורים ספציפיים או ברמה הגלובלית
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <nav className="flex space-x-4">
          {[
            { id: 'active', label: `התראות פעילות (${alerts.filter(a => a.isActive).length})` },
            { id: 'triggered', label: `התראות שהופעלו (${triggeredAlerts.length})` },
            { id: 'create', label: 'הוסף התראה חדשה' }
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

      {/* Triggered Alerts Banner */}
      {triggeredAlerts.length > 0 && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400 text-xl">⚠️</span>
            </div>
            <div className="mr-3">
              <h3 className="text-sm font-medium text-red-800">
                התראות פעילות ({triggeredAlerts.length})
              </h3>
              <p className="text-sm text-red-700">
                יש פריטי מלאי שירדו מתחת לסף שהוגדר
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Alerts Tab */}
      {activeTab === 'active' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">התראות פעילות</h3>
            </div>
            
            {alerts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        פריט
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        סוג התראה
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        מיקום
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        סף התראה
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        כמות נוכחית
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        סטטוס
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        פעולות
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {alerts.map((alert) => (
                      <tr key={alert.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{alert.itemName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            alert.alertType === 'global' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {alert.alertType === 'global' ? 'גלובלי' : 'אזורי'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {alert.alertType === 'area' ? (
                            <div>
                              <div className="text-sm text-gray-900">{alert.campName}</div>
                              <div className="text-sm text-gray-500">{alert.areaName}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">כל המערכת</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">≤{alert.threshold}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${
                            alert.isTriggered ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {alert.currentQuantity !== undefined ? alert.currentQuantity : 'לא ידוע'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={alert.isActive}
                                onChange={() => handleToggleAlert(alert.id, alert.isActive)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                const newThreshold = prompt('הכנס סף התראה חדש:', alert.threshold.toString());
                                if (newThreshold && !isNaN(parseInt(newThreshold))) {
                                  handleUpdateThreshold(alert.id, parseInt(newThreshold));
                                }
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              ערוך
                            </button>
                            <button
                              onClick={() => handleDeleteAlert(alert.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              מחק
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto h-12 w-12 bg-gray-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">🔔</span>
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">אין התראות פעילות</h3>
                <p className="mt-1 text-sm text-gray-500">
                  התחל על ידי יצירת התראה חדשה
                </p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  הוסף התראה
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Triggered Alerts Tab */}
      {activeTab === 'triggered' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">התראות שהופעלו</h3>
            </div>
            
            {triggeredAlerts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        פריט
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        מיקום
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        סף התראה
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        כמות נוכחית
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        רמת דחיפות
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {triggeredAlerts.map((alert) => {
                      const urgencyLevel = alert.currentQuantity !== undefined && alert.currentQuantity === 0 
                        ? 'critical' 
                        : alert.currentQuantity !== undefined && alert.currentQuantity < (alert.threshold * 0.5)
                        ? 'high'
                        : 'medium';
                      
                      return (
                        <tr key={alert.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{alert.itemName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {alert.alertType === 'area' ? (
                              <div>
                                <div className="text-sm text-gray-900">{alert.campName}</div>
                                <div className="text-sm text-gray-500">{alert.areaName}</div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">כל המערכת</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">≤{alert.threshold}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-red-600">
                              {alert.currentQuantity !== undefined ? alert.currentQuantity : 'לא ידוע'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              urgencyLevel === 'critical' 
                                ? 'bg-red-100 text-red-800' 
                                : urgencyLevel === 'high'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {urgencyLevel === 'critical' ? 'קריטי' : urgencyLevel === 'high' ? 'גבוה' : 'בינוני'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto h-12 w-12 bg-green-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">אין התראות פעילות</h3>
                <p className="mt-1 text-sm text-gray-500">
                  כל רמות המלאי תקינות
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Alert Tab */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">הוסף התראה חדשה</h3>
            
            <form onSubmit={handleCreateAlert} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">פריט מלאי</label>
                  <select
                    value={createForm.itemName}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, itemName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">בחר פריט...</option>
                    {availableItems.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">סוג התראה</label>
                  <select
                    value={createForm.alertType}
                    onChange={(e) => setCreateForm(prev => ({ 
                      ...prev, 
                      alertType: e.target.value as 'area' | 'global',
                      campId: '',
                      areaId: ''
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="global">התראה גלובלית (כל המערכת)</option>
                    <option value="area">התראה אזורית (אזור ספציפי)</option>
                  </select>
                </div>

                {createForm.alertType === 'area' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">מחנה</label>
                      <select
                        value={createForm.campId}
                        onChange={(e) => setCreateForm(prev => ({ 
                          ...prev, 
                          campId: e.target.value,
                          areaId: ''
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={createForm.alertType === 'area'}
                      >
                        <option value="">בחר מחנה...</option>
                        {camps.map(camp => (
                          <option key={camp.id} value={camp.id}>{camp.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">אזור</label>
                      <select
                        value={createForm.areaId}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, areaId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={createForm.alertType === 'area'}
                        disabled={!createForm.campId}
                      >
                        <option value="">בחר אזור...</option>
                        {getSelectedCamp()?.rectangleAreas.map(area => (
                          <option key={area.id} value={area.id}>{area.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">סף התראה (כמות)</label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.threshold}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, threshold: e.target.value }))}
                    placeholder="הכנס כמות מינימלית..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    תתקבל התראה כאשר הכמות תירד מתחת לערך זה
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  צור התראה
                </button>
              </div>
            </form>
          </div>

          {/* Alert Types Explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">הסבר על סוגי התראות:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><strong>התראה גלובלית:</strong> מעקב אחר הכמות הכוללת של הפריט בכל המערכת</li>
              <li><strong>התראה אזורית:</strong> מעקב אחר הכמות של הפריט באזור ספציפי בתוך מחנה</li>
            </ul>
          </div>
        </div>
      )}
    </main>
  );
} 