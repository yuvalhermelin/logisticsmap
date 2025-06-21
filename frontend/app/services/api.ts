import type { LatLngExpression, LatLngBounds } from 'leaflet';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5001/api' 
  : '/api';

// Types matching the backend schema
export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
}

export interface InventoryItemCatalog {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RectangleAreaDB {
  id: string;
  name: string;
  bounds: {
    southWest: { lat: number; lng: number };
    northEast: { lat: number; lng: number };
  };
  rotation: number;
  center: { lat: number; lng: number };
  width: number;
  height: number;
  inventoryItems?: InventoryItem[];
}

export interface CampDB {
  _id?: string;
  id: string;
  name: string;
  positions: { lat: number; lng: number }[];
  rectangleAreas: RectangleAreaDB[];
  createdAt?: string;
  updatedAt?: string;
}

// Frontend types (for compatibility with existing code)
export interface RectangleArea {
  id: string;
  name: string;
  bounds: LatLngBounds;
  rotation: number;
  center?: [number, number];
  width?: number;
  height?: number;
  inventoryItems?: InventoryItem[];
}

export interface Camp {
  id: string;
  name: string;
  positions: LatLngExpression[];
  rectangleAreas: RectangleArea[];
}

// Convert from DB format to frontend format
const convertCampFromDB = (campDB: CampDB): Camp => {
  return {
    id: campDB.id,
    name: campDB.name,
    positions: campDB.positions.map(pos => [pos.lat, pos.lng] as LatLngExpression),
    rectangleAreas: campDB.rectangleAreas.map(rect => ({
      id: rect.id,
      name: rect.name,
      bounds: {
        getSouthWest: () => ({ lat: rect.bounds.southWest.lat, lng: rect.bounds.southWest.lng }),
        getNorthEast: () => ({ lat: rect.bounds.northEast.lat, lng: rect.bounds.northEast.lng }),
      } as LatLngBounds,
      rotation: rect.rotation,
      center: [rect.center.lat, rect.center.lng] as [number, number],
      width: rect.width,
      height: rect.height,
      inventoryItems: rect.inventoryItems || []
    }))
  };
};

// Convert from frontend format to DB format
const convertRectangleToDBFormat = (rect: RectangleArea) => {
  const bounds = rect.bounds as any;
  return {
    id: rect.id,
    name: rect.name,
    bounds: {
      southWest: {
        lat: bounds.getSouthWest ? bounds.getSouthWest().lat : bounds.southWest.lat,
        lng: bounds.getSouthWest ? bounds.getSouthWest().lng : bounds.southWest.lng
      },
      northEast: {
        lat: bounds.getNorthEast ? bounds.getNorthEast().lat : bounds.northEast.lat,
        lng: bounds.getNorthEast ? bounds.getNorthEast().lng : bounds.northEast.lng
      }
    },
    rotation: rect.rotation,
    center: {
      lat: rect.center ? rect.center[0] : 0,
      lng: rect.center ? rect.center[1] : 0
    },
    width: rect.width || 0,
    height: rect.height || 0,
    inventoryItems: rect.inventoryItems || []
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
  async createCamp(camp: Omit<Camp, 'rectangleAreas'>): Promise<Camp> {
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
      if (updates.rectangleAreas) {
        updateData.rectangleAreas = updates.rectangleAreas.map(convertRectangleToDBFormat);
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

  // Add rectangle to camp
  async addRectangleTocamp(campId: string, rectangle: RectangleArea): Promise<Camp> {
    try {
      const rectangleData = convertRectangleToDBFormat(rectangle);

      const response = await fetch(`${API_BASE_URL}/camps/${campId}/rectangles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rectangleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to add rectangle: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error adding rectangle to camp:', error);
      throw error;
    }
  },

  // Update rectangle in camp
  async updateRectangleInCamp(campId: string, rectangleId: string, rectangle: RectangleArea): Promise<Camp> {
    try {
      const rectangleData = convertRectangleToDBFormat(rectangle);

      const response = await fetch(`${API_BASE_URL}/camps/${campId}/rectangles/${rectangleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rectangleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update rectangle: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error updating rectangle in camp:', error);
      throw error;
    }
  },

  // Delete rectangle from camp
  async deleteRectangleFromCamp(campId: string, rectangleId: string): Promise<Camp> {
    try {
      const response = await fetch(`${API_BASE_URL}/camps/${campId}/rectangles/${rectangleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete rectangle: ${response.statusText}`);
      }

      const updatedCamp: CampDB = await response.json();
      return convertCampFromDB(updatedCamp);
    } catch (error) {
      console.error('Error deleting rectangle from camp:', error);
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

  async addInventoryToArea(campId: string, rectangleId: string, inventoryItemId: string, quantity: number): Promise<Camp> {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/${campId}/rectangles/${rectangleId}/items`, {
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

  async updateInventoryInArea(campId: string, rectangleId: string, itemId: string, quantity: number): Promise<Camp> {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/${campId}/rectangles/${rectangleId}/items/${itemId}`, {
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

  async removeInventoryFromArea(campId: string, rectangleId: string, itemId: string): Promise<Camp> {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/${campId}/rectangles/${rectangleId}/items/${itemId}`, {
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