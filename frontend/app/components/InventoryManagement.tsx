import { useState, useEffect, useRef } from 'react';
import { api, type InventoryItem, type InventoryItemCatalog, type FileItem } from '../services/api';

interface InventoryManagementProps {
  campId: string;
  polygonId: string;
  currentInventory: InventoryItem[];
  currentFiles?: FileItem[];
  onInventoryUpdated: () => void;
}

export default function InventoryManagement({ 
  campId, 
  polygonId, 
  currentInventory, 
  currentFiles = [],
  onInventoryUpdated 
}: InventoryManagementProps) {
  const [catalogItems, setCatalogItems] = useState<InventoryItemCatalog[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [newItemName, setNewItemName] = useState<string>('');
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [draftExpiryByItem, setDraftExpiryByItem] = useState<Record<string, string>>({});
  
  // File upload states
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [customFileName, setCustomFileName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      await api.addInventoryToArea(campId, polygonId, selectedItem, quantity, expiryDate || undefined);
      setSelectedItem('');
      setQuantity(1);
      setExpiryDate('');
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
      await api.updateInventoryInArea(campId, polygonId, itemId, newQuantity);
      onInventoryUpdated();
    } catch (error) {
      console.error('Failed to update inventory quantity:', error);
      alert('נכשל בעדכון הכמות. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExpiry = async (itemId: string, newExpiry: string) => {
    setLoading(true);
    try {
      await api.updateInventoryInArea(campId, polygonId, itemId, (currentInventory.find(i => i.id === itemId)?.quantity || 0), newExpiry || null);
      onInventoryUpdated();
    } catch (error) {
      console.error('Failed to update inventory expiry:', error);
      alert('נכשל בעדכון תאריך התפוגה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const normalizedDate = (iso?: string | null) => iso ? new Date(iso).toISOString().substring(0,10) : '';
  const saveExpiryIfChanged = async (itemId: string) => {
    const draft = draftExpiryByItem[itemId];
    const original = normalizedDate(currentInventory.find(i => i.id === itemId)?.expiryDate || null);
    if (draft !== undefined && draft !== original) {
      await handleUpdateExpiry(itemId, draft);
    }
    setDraftExpiryByItem(prev => {
      const { [itemId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleRemoveItem = async (itemId: string) => {
    setLoading(true);
    try {
      await api.removeInventoryFromArea(campId, polygonId, itemId);
      onInventoryUpdated();
    } catch (error) {
      console.error('Failed to remove inventory item:', error);
      alert('נכשל בהסרת פריט המלאי. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  // File management functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setCustomFileName(file.name); // Default to original filename
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !customFileName.trim()) return;

    setIsUploadingFile(true);
    try {
      await api.uploadFileToArea(campId, polygonId, selectedFile, customFileName.trim());
      setSelectedFile(null);
      setCustomFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onInventoryUpdated();
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('נכשל בהעלאת הקובץ. אנא נסה שוב.');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleFileDownload = async (file: FileItem) => {
    try {
      await api.downloadFileFromArea(campId, polygonId, file.id, file.originalName);
    } catch (error) {
      console.error('Failed to download file:', error);
      alert('נכשל בהורדת הקובץ. אנא נסה שוב.');
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הקובץ?')) return;

    try {
      await api.deleteFileFromArea(campId, polygonId, fileId);
      onInventoryUpdated();
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert('נכשל במחיקת הקובץ. אנא נסה שוב.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
              <div className="flex-1">
                <div className="text-sm">{item.name}</div>
                <div className="text-xs text-gray-500">
                  {item.expiryDate ? `תפוגה: ${new Date(item.expiryDate).toLocaleDateString('he-IL')}` : 'ללא תאריך תפוגה'}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  value={item.quantity}
                  onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                  disabled={loading}
                />
                <input
                  type="date"
                  value={draftExpiryByItem[item.id] ?? normalizedDate(item.expiryDate || null)}
                  onChange={(e) => setDraftExpiryByItem(prev => ({ ...prev, [item.id]: e.target.value }))}
                  onBlur={() => saveExpiryIfChanged(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      setDraftExpiryByItem(prev => {
                        const { [item.id]: _, ...rest } = prev;
                        return rest;
                      });
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="px-2 py-1 text-xs border border-gray-300 rounded"
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
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded"
                placeholder="תאריך תפוגה (אופציונלי)"
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

      {/* Files Section */}
      <div className="border-t pt-3 mt-4">
        <h5 className="text-sm font-medium text-gray-600 mb-2">קבצים מצורפים:</h5>
        
        {/* Current files */}
        {currentFiles.length > 0 && (
          <div className="space-y-2 mb-3">
            {currentFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                <div className="flex-1">
                  <div className="text-sm font-medium">{file.customName}</div>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(file.fileSize)} • {new Date(file.uploadedAt).toLocaleDateString('he-IL')}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleFileDownload(file)}
                    className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded border border-blue-300 hover:bg-blue-50"
                  >
                    הורד
                  </button>
                  <button
                    onClick={() => handleFileDelete(file.id)}
                    className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-300 hover:bg-red-50"
                  >
                    מחק
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* File upload section */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            id={`file-upload-${polygonId}`}
          />
          
          {!selectedFile ? (
            <label
              htmlFor={`file-upload-${polygonId}`}
              className="inline-block px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer"
            >
              + העלה קובץ
            </label>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-gray-600">
                קובץ נבחר: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </div>
              <input
                type="text"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                placeholder="שם תיאורי לקובץ..."
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                disabled={isUploadingFile}
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleFileUpload}
                  disabled={!customFileName.trim() || isUploadingFile}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                >
                  {isUploadingFile ? 'מעלה...' : 'העלה'}
                </button>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setCustomFileName('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                  disabled={isUploadingFile}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 