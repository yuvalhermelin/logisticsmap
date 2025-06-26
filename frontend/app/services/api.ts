import type { LatLngExpression } from 'leaflet';

const API_BASE_URL = 'http://localhost:5001/api';

// Common types
export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
}

export interface FileItem {
  id: string;
  customName: string;
  originalName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface InventoryItemCatalog {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

// Database types (what comes from the API)
export interface PolygonAreaDB {
  id: string;
  name: string;
  positions: { lat: number; lng: number }[];
  inventoryItems?: InventoryItem[];
  files?: FileItem[];
}

export interface CampDB {
  _id?: string;
  id: string;
  name: string;
  positions: { lat: number; lng: number }[];
  polygonAreas: PolygonAreaDB[];
  createdAt?: string;
  updatedAt?: string;
}

// Frontend types (for compatibility with existing code)
export interface PolygonArea {
  id: string;
  name: string;
  positions: LatLngExpression[];
  inventoryItems?: InventoryItem[];
  files?: FileItem[];
}

export interface Camp {
  id: string;
  name: string;
  positions: LatLngExpression[];
  polygonAreas: PolygonArea[];
}

// Convert from DB format to frontend format
const convertCampFromDB = (campDB: CampDB): Camp => {
  return {
    id: campDB.id,
    name: campDB.name,
    positions: campDB.positions.map(pos => [pos.lat, pos.lng] as LatLngExpression),
    polygonAreas: campDB.polygonAreas.map(polygon => ({
      id: polygon.id,
      name: polygon.name,
      positions: polygon.positions.map(pos => [pos.lat, pos.lng] as LatLngExpression),
      inventoryItems: polygon.inventoryItems || [],
      files: polygon.files || []
    }))
  };
};

// Convert from frontend format to DB format
const convertPolygonToDBFormat = (polygon: PolygonArea) => {
  return {
    id: polygon.id,
    name: polygon.name,
    positions: polygon.positions.map(pos => {
      const [lat, lng] = pos as [number, number];
      return { lat, lng };
    }),
    inventoryItems: polygon.inventoryItems || [],
    files: polygon.files || []
  };
};

// API functions
export const api = {
  // Get all camps
  async getCamps(): Promise<Camp[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/camps`);
      if (!response.ok) {
        throw new Error(`Failed to fetch camps: ${response.statusText}`);
      }
      const camps: CampDB[] = await response.json();
      return camps.map(convertCampFromDB);
    } catch (error) {
      console.error('Error fetching camps:', error);
      throw error;
    }
  },

  // Create a new camp
  async createCamp(camp: Omit<Camp, 'polygonAreas'>): Promise<Camp> {
    try {
      const campData = {
        id: camp.id,
        name: camp.name,
        positions: camp.positions.map(pos => {
          const [lat, lng] = pos as [number, number];
          return { lat, lng };
        })
      };

      const response = await fetch(`${API_BASE_URL}/camps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(campData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create camp: ${response.statusText}`);
      }

      const createdCamp: CampDB = await response.json();
      return convertCampFromDB(createdCamp);
    } catch (error) {
      console.error('Error creating camp:', error);
      throw error;
    }
  },

  // Update a camp
  async updateCamp(campId: string, updates: Partial<Camp>): Promise<Camp> {
    try {
      const updateData: any = {};
      
      if (updates.name) updateData.name = updates.name;
      if (updates.positions) {
        updateData.positions = updates.positions.map(pos => {
          const [lat, lng] = pos as [number, number];
          return { lat, lng };
        });
      }
      if (updates.polygonAreas) {
        updateData.polygonAreas = updates.polygonAreas.map(convertPolygonToDBFormat);
      }

      const response = await fetch(`${API_BASE_URL}/camps/${campId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update camp: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error updating camp:', error);
      throw error;
    }
  },

  // Delete a camp
  async deleteCamp(campId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/camps/${campId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete camp: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting camp:', error);
      throw error;
    }
  },

  // Add polygon to camp
  async addPolygonToCamp(campId: string, polygon: PolygonArea): Promise<Camp> {
    try {
      const polygonData = convertPolygonToDBFormat(polygon);

      const response = await fetch(`${API_BASE_URL}/camps/${campId}/polygons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(polygonData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to add polygon: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error adding polygon to camp:', error);
      throw error;
    }
  },

  // Update polygon in camp
  async updatePolygonInCamp(campId: string, polygonId: string, polygon: PolygonArea): Promise<Camp> {
    try {
      const polygonData = convertPolygonToDBFormat(polygon);

      const response = await fetch(`${API_BASE_URL}/camps/${campId}/polygons/${polygonId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(polygonData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update polygon: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error updating polygon in camp:', error);
      throw error;
    }
  },

  // Delete polygon from camp
  async deletePolygonFromCamp(campId: string, polygonId: string): Promise<Camp> {
    try {
      const response = await fetch(`${API_BASE_URL}/camps/${campId}/polygons/${polygonId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete polygon: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error deleting polygon from camp:', error);
      throw error;
    }
  },

  // Inventory management
  async getInventoryCatalog(): Promise<InventoryItemCatalog[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/catalog`);
      if (!response.ok) {
        throw new Error(`Failed to fetch inventory catalog: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching inventory catalog:', error);
      throw error;
    }
  },

  async createInventoryItem(name: string): Promise<InventoryItemCatalog> {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/catalog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create inventory item: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating inventory item:', error);
      throw error;
    }
  },

  async addInventoryToArea(campId: string, polygonId: string, inventoryItemId: string, quantity: number): Promise<Camp> {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/${campId}/polygons/${polygonId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inventoryItemId, quantity }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to add inventory to area: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error adding inventory to area:', error);
      throw error;
    }
  },

  async updateInventoryInArea(campId: string, polygonId: string, itemId: string, quantity: number): Promise<Camp> {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/${campId}/polygons/${polygonId}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update inventory: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error updating inventory in area:', error);
      throw error;
    }
  },

  async removeInventoryFromArea(campId: string, polygonId: string, itemId: string): Promise<Camp> {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/${campId}/polygons/${polygonId}/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to remove inventory: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error removing inventory from area:', error);
      throw error;
    }
  },

  // Analytics endpoints
  async getInventoryAnalytics(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/analytics/overview`);
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching inventory analytics:', error);
      throw error;
    }
  },

  async searchInventory(params: {
    query?: string;
    itemName?: string;
    campId?: string;
    minQuantity?: number;
    maxQuantity?: number;
  }): Promise<any[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params.query) searchParams.append('q', params.query);
      if (params.itemName) searchParams.append('itemName', params.itemName);
      if (params.campId) searchParams.append('campId', params.campId);
      if (params.minQuantity !== undefined) searchParams.append('minQuantity', params.minQuantity.toString());
      if (params.maxQuantity !== undefined) searchParams.append('maxQuantity', params.maxQuantity.toString());

      const response = await fetch(`${API_BASE_URL}/inventory/analytics/search?${searchParams}`);
      if (!response.ok) {
        throw new Error(`Failed to search inventory: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error searching inventory:', error);
      throw error;
    }
  },

  async getItemDetails(itemName: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/analytics/item/${encodeURIComponent(itemName)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch item details: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching item details:', error);
      throw error;
    }
  },

  // File operations
  async uploadFileToArea(campId: string, polygonId: string, file: File, customName: string): Promise<Camp> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('customName', customName);

      const response = await fetch(`${API_BASE_URL}/files/${campId}/polygons/${polygonId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to upload file: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  async downloadFileFromArea(campId: string, polygonId: string, fileId: string, originalName: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${campId}/polygons/${polygonId}/files/${fileId}/download`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to download file: ${response.statusText}`);
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  },

  async deleteFileFromArea(campId: string, polygonId: string, fileId: string): Promise<Camp> {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${campId}/polygons/${polygonId}/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete file: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },

  async getFilesForArea(campId: string, polygonId: string): Promise<FileItem[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${campId}/polygons/${polygonId}/files`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to get files: ${response.statusText}`);
      }

      const files: FileItem[] = await response.json();
      return files;
    } catch (error) {
      console.error('Error getting files:', error);
      throw error;
    }
  },

  // Tracking & Alerts endpoints
  async getAlerts(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts`);
      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching alerts:', error);
      throw error;
    }
  },

  async createAlert(alert: {
    itemName: string;
    alertType: 'area' | 'global';
    threshold: number;
    campId?: string;
    areaId?: string;
    isActive?: boolean;
  }): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create alert: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  },

  async updateAlert(alertId: string, updates: {
    threshold?: number;
    isActive?: boolean;
  }): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/${alertId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update alert: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating alert:', error);
      throw error;
    }
  },

  async deleteAlert(alertId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/${alertId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete alert: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
      throw error;
    }
  },

  async getTriggeredAlerts(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/triggered`);
      if (!response.ok) {
        throw new Error(`Failed to fetch triggered alerts: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching triggered alerts:', error);
      throw error;
    }
  }
}; 