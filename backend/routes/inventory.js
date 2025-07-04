const express = require('express');
const router = express.Router();
const InventoryItemCatalog = require('../models/InventoryItem');
const Camp = require('../models/Camp');
const PolygonArea = require('../models/PolygonArea');
const { v4: uuidv4 } = require('uuid');

// Get all inventory items from catalog
router.get('/catalog', async (req, res) => {
  try {
    const items = await InventoryItemCatalog.find().sort({ name: 1 });
    res.json(items);
  } catch (error) {
    console.error('Error fetching inventory catalog:', error);
    res.status(500).json({ error: 'Failed to fetch inventory catalog' });
  }
});

// Create a new inventory item in catalog
router.post('/catalog', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }
    
    const item = new InventoryItemCatalog({
      id: uuidv4(),
      name: name.trim()
    });
    
    const savedItem = await item.save();
    res.status(201).json(savedItem);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'An item with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create inventory item' });
    }
  }
});

// Add inventory item to an area
router.post('/:campId/polygons/:polygonId/items', async (req, res) => {
  try {
    const { campId, polygonId } = req.params;
    const { inventoryItemId, quantity } = req.body;
    
    if (!inventoryItemId || quantity < 0) {
      return res.status(400).json({ error: 'Invalid inventory item data' });
    }
    
    // Find the inventory item in catalog
    const catalogItem = await InventoryItemCatalog.findOne({ id: inventoryItemId });
    if (!catalogItem) {
      return res.status(404).json({ error: 'Inventory item not found in catalog' });
    }
    
    const camp = await Camp.findOne({ id: campId });
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    const polygonArea = await PolygonArea.findOne({ id: polygonId, campId: campId });
    if (!polygonArea) {
      return res.status(404).json({ error: 'Polygon area not found' });
    }
    
    // Check if item already exists in this area
    const existingItemIndex = polygonArea.inventoryItems.findIndex(item => item.name === catalogItem.name);
    
    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      polygonArea.inventoryItems[existingItemIndex].quantity = quantity;
    } else {
      // Add new item
      polygonArea.inventoryItems.push({
        id: uuidv4(),
        name: catalogItem.name,
        quantity: quantity
      });
    }
    
    await polygonArea.save();
    
    // Return the camp with all its polygon areas for backward compatibility
    const polygonAreas = await PolygonArea.find({ campId: campId });
    res.json({
      ...camp.toObject(),
      polygonAreas
    });
  } catch (error) {
    console.error('Error adding inventory item to area:', error);
    res.status(500).json({ error: 'Failed to add inventory item to area' });
  }
});

// Update inventory item quantity in an area
router.put('/:campId/polygons/:polygonId/items/:itemId', async (req, res) => {
  try {
    const { campId, polygonId, itemId } = req.params;
    const { quantity } = req.body;
    
    if (quantity < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative' });
    }
    
    const camp = await Camp.findOne({ id: campId });
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    const polygonArea = await PolygonArea.findOne({ id: polygonId, campId: campId });
    if (!polygonArea) {
      return res.status(404).json({ error: 'Polygon area not found' });
    }
    
    const itemIndex = polygonArea.inventoryItems.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Inventory item not found in area' });
    }
    
    polygonArea.inventoryItems[itemIndex].quantity = quantity;
    await polygonArea.save();
    
    // Return the camp with all its polygon areas for backward compatibility
    const polygonAreas = await PolygonArea.find({ campId: campId });
    res.json({
      ...camp.toObject(),
      polygonAreas
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// Remove inventory item from an area
router.delete('/:campId/polygons/:polygonId/items/:itemId', async (req, res) => {
  try {
    const { campId, polygonId, itemId } = req.params;
    
    const camp = await Camp.findOne({ id: campId });
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    const polygonArea = await PolygonArea.findOne({ id: polygonId, campId: campId });
    if (!polygonArea) {
      return res.status(404).json({ error: 'Polygon area not found' });
    }
    
    polygonArea.inventoryItems = polygonArea.inventoryItems.filter(item => item.id !== itemId);
    await polygonArea.save();
    
    // Return the camp with all its polygon areas for backward compatibility
    const polygonAreas = await PolygonArea.find({ campId: campId });
    res.json({
      ...camp.toObject(),
      polygonAreas
    });
  } catch (error) {
    console.error('Error removing inventory item from area:', error);
    res.status(500).json({ error: 'Failed to remove inventory item from area' });
  }
});

// BI Analytics endpoints
router.get('/analytics/overview', async (req, res) => {
  try {
    const camps = await Camp.find();
    const polygonAreas = await PolygonArea.find();
    
    // Calculate analytics
    const analytics = {
      totalCamps: camps.length,
      totalAreas: polygonAreas.length,
      totalInventoryItems: polygonAreas.reduce((sum, area) => 
        sum + (area.inventoryItems?.length || 0), 0),
      totalQuantity: polygonAreas.reduce((sum, area) => 
        sum + (area.inventoryItems?.reduce((itemSum, item) => 
          itemSum + item.quantity, 0) || 0), 0),
      
      // Item distribution
      itemDistribution: {},
      
      // Camp inventory summary
      campInventory: await Promise.all(camps.map(async (camp) => {
        const campAreas = polygonAreas.filter(area => area.campId === camp.id);
        return {
          campId: camp.id,
          campName: camp.name,
          areasCount: campAreas.length,
          totalItems: campAreas.reduce((sum, area) => 
            sum + (area.inventoryItems?.length || 0), 0),
          totalQuantity: campAreas.reduce((sum, area) => 
            sum + (area.inventoryItems?.reduce((itemSum, item) => 
              itemSum + item.quantity, 0) || 0), 0)
        };
      })),
      
      // Area details with inventory
      areaDetails: polygonAreas.map(area => {
        const camp = camps.find(c => c.id === area.campId);
        return {
          campId: area.campId,
          campName: camp ? camp.name : 'Unknown',
          areaId: area.id,
          areaName: area.name,
          inventoryItems: area.inventoryItems || [],
          totalQuantity: area.inventoryItems?.reduce((sum, item) => sum + item.quantity, 0) || 0
        };
      })
    };
    
    // Calculate item distribution
    polygonAreas.forEach(area => {
      const camp = camps.find(c => c.id === area.campId);
      if (area.inventoryItems) {
        area.inventoryItems.forEach(item => {
          if (!analytics.itemDistribution[item.name]) {
            analytics.itemDistribution[item.name] = {
              name: item.name,
              totalQuantity: 0,
              locationsCount: 0,
              locations: []
            };
          }
          analytics.itemDistribution[item.name].totalQuantity += item.quantity;
          analytics.itemDistribution[item.name].locationsCount++;
          analytics.itemDistribution[item.name].locations.push({
            campId: area.campId,
            campName: camp ? camp.name : 'Unknown',
            areaId: area.id,
            areaName: area.name,
            quantity: item.quantity
          });
        });
      }
    });
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching inventory analytics:', error);
    res.status(500).json({ error: 'Failed to fetch inventory analytics' });
  }
});

// Search inventory items across all camps and areas
router.get('/analytics/search', async (req, res) => {
  try {
    const { q: query, itemName, campId, minQuantity, maxQuantity } = req.query;
    
    // Build the aggregation pipeline for efficient searching
    const pipeline = [];
    
    // Match stage - filter polygon areas first
    const matchStage = {};
    if (campId) {
      matchStage.campId = campId;
    }
    
    // Add match for inventory items if we have specific item criteria
    if (itemName || minQuantity || maxQuantity) {
      const itemMatch = {};
      if (itemName) {
        itemMatch['inventoryItems.name'] = new RegExp(itemName, 'i');
      }
      Object.assign(matchStage, itemMatch);
    }
    
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }
    
    // Lookup camp information
    pipeline.push({
      $lookup: {
        from: 'camps',
        localField: 'campId',
        foreignField: 'id',
        as: 'camp'
      }
    });
    
    // Unwind inventory items
    pipeline.push({ $unwind: '$inventoryItems' });
    
    // Additional filtering on inventory items
    const inventoryMatch = {};
    if (itemName) {
      inventoryMatch['inventoryItems.name'] = new RegExp(itemName, 'i');
    }
    if (minQuantity) {
      inventoryMatch['inventoryItems.quantity'] = { $gte: parseInt(minQuantity) };
    }
    if (maxQuantity) {
      if (inventoryMatch['inventoryItems.quantity']) {
        inventoryMatch['inventoryItems.quantity'].$lte = parseInt(maxQuantity);
      } else {
        inventoryMatch['inventoryItems.quantity'] = { $lte: parseInt(maxQuantity) };
      }
    }
    
    if (Object.keys(inventoryMatch).length > 0) {
      pipeline.push({ $match: inventoryMatch });
    }
    
    // General query filter
    if (query) {
      pipeline.push({
        $match: {
          $or: [
            { 'inventoryItems.name': new RegExp(query, 'i') },
            { 'name': new RegExp(query, 'i') },
            { 'camp.name': new RegExp(query, 'i') }
          ]
        }
      });
    }
    
    // Project the final result
    pipeline.push({
      $project: {
        itemId: '$inventoryItems.id',
        itemName: '$inventoryItems.name',
        quantity: '$inventoryItems.quantity',
        campId: '$campId',
        campName: { $arrayElemAt: ['$camp.name', 0] },
        areaId: '$id',
        areaName: '$name'
      }
    });
    
    const results = await PolygonArea.aggregate(pipeline);
    
    res.json(results);
  } catch (error) {
    console.error('Error searching inventory:', error);
    res.status(500).json({ error: 'Failed to search inventory' });
  }
});

// Get detailed information about a specific inventory item type
router.get('/analytics/item/:itemName', async (req, res) => {
  try {
    const { itemName } = req.params;
    const camps = await Camp.find();
    const polygonAreas = await PolygonArea.find();
    
    const itemDetails = {
      itemName: decodeURIComponent(itemName),
      totalQuantity: 0,
      totalLocations: 0,
      camps: [],
      locations: []
    };
    
    // Group areas by camp
    const areasByCamp = {};
    polygonAreas.forEach(area => {
      if (!areasByCamp[area.campId]) {
        areasByCamp[area.campId] = [];
      }
      areasByCamp[area.campId].push(area);
    });
    
    camps.forEach(camp => {
      let campTotal = 0;
      const campAreas = [];
      const areas = areasByCamp[camp.id] || [];
      
      areas.forEach(area => {
        if (area.inventoryItems) {
          const matchingItems = area.inventoryItems.filter(item => 
            item.name.toLowerCase() === itemName.toLowerCase()
          );
          
          if (matchingItems.length > 0) {
            const areaQuantity = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
            campTotal += areaQuantity;
            itemDetails.totalQuantity += areaQuantity;
            itemDetails.totalLocations++;
            
            const areaInfo = {
              areaId: area.id,
              areaName: area.name,
              quantity: areaQuantity,
              items: matchingItems
            };
            
            campAreas.push(areaInfo);
            itemDetails.locations.push({
              campId: camp.id,
              campName: camp.name,
              ...areaInfo
            });
          }
        }
      });
      
      if (campTotal > 0) {
        itemDetails.camps.push({
          campId: camp.id,
          campName: camp.name,
          totalQuantity: campTotal,
          areas: campAreas
        });
      }
    });
    
    res.json(itemDetails);
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).json({ error: 'Failed to fetch item details' });
  }
});

module.exports = router; 