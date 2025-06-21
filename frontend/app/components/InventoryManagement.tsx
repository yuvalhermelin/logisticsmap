import { useState, useEffect } from 'react';
import { api, type InventoryItem, type InventoryItemCatalog } from '../services/api';

interface InventoryManagementProps {
  campId: string;
  rectangleId: string;
  currentInventory: InventoryItem[];
  onInventoryUpdated: () => void;
}

export default function InventoryManagement({ 
  campId, 
  rectangleId, 
  currentInventory, 
  onInventoryUpdated 
}: InventoryManagementProps) {
  const [catalogItems, setCatalogItems] = useState<InventoryItemCatalog[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [newItemName, setNewItemName] = useState<string>('');
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadCatalogItems();
  }, []);

  const loadCatalogItems = async () => {
    try {
      const items = await api.getInventoryCatalog();
      setCatalogItems(items);
    } catch (error) {
      console.error('Failed to load inventory catalog:', error);
    }
  };

  const handleAddItem = async () => {
    if (!selectedItem || quantity <= 0) return;

    setLoading(true);
    try {
      await api.addInventoryToArea(campId, rectangleId, selectedItem, quantity);
      setSelectedItem('');
      setQuantity(1);
      onInventoryUpdated();
    } catch (error) {
      console.error('Failed to add inventory item:', error);
      alert('נכשל בהוספת פריט מלאי. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewItem = async () => {
    if (!newItemName.trim()) return;

    setLoading(true);
    try {
      const newItem = await api.createInventoryItem(newItemName.trim());
      setCatalogItems([...catalogItems, newItem]);
      setSelectedItem(newItem.id);
      setNewItemName('');
      setIsAddingNew(false);
    } catch (error) {
      console.error('Failed to create inventory item:', error);
      alert('נכשל ביצירת פריט מלאי חדש. ייתכן שהוא כבר קיים.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 0) return;

    setLoading(true);
    try {
      await api.updateInventoryInArea(campId, rectangleId, itemId, newQuantity);
      onInventoryUpdated();
    } catch (error) {
      console.error('Failed to update inventory quantity:', error);
      alert('נכשל בעדכון הכמות. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setLoading(true);
    try {
      await api.removeInventoryFromArea(campId, rectangleId, itemId);
      onInventoryUpdated();
    } catch (error) {
      console.error('Failed to remove inventory item:', error);
      alert('נכשל בהסרת פריט המלאי. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-800">פריטי מלאי</h4>
      
      {/* Current inventory items */}
      {currentInventory.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-600">פריטים נוכחיים:</h5>
          {currentInventory.map((item) => (
            <div key={item.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <span className="text-sm">{item.name}</span>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  value={item.quantity}
                  onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                  disabled={loading}
                />
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="text-red-500 hover:text-red-700 text-xs"
                  disabled={loading}
                >
                  הסר
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new inventory item */}
      <div className="border-t pt-3">
        <h5 className="text-sm font-medium text-gray-600 mb-2">הוסף פריט:</h5>
        
        {!isAddingNew ? (
          <div className="space-y-2">
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              disabled={loading}
            >
              <option value="">בחר פריט...</option>
              {catalogItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                placeholder="כמות"
                disabled={loading}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleAddItem();
                }}
                disabled={!selectedItem || quantity <= 0 || loading}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
              >
                הוסף
              </button>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsAddingNew(true);
              }}
              className="text-xs text-blue-500 hover:text-blue-700"
              disabled={loading}
            >
              + צור פריט חדש
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="שם פריט חדש..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              disabled={loading}
            />
            <div className="flex space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleCreateNewItem();
                }}
                disabled={!newItemName.trim() || loading}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
              >
                צור
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsAddingNew(false);
                  setNewItemName('');
                }}
                className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                disabled={loading}
              >
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 