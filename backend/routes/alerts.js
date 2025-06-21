const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const Camp = require('../models/Camp');
const RectangleArea = require('../models/RectangleArea');
const { v4: uuidv4 } = require('uuid');

// TODO: Add typescript support

// Helper function to calculate current quantity for an item
const getCurrentQuantity = async (itemName, alertType, campId = null, areaId = null) => {
  try {
    if (alertType === 'global') {
      // Use aggregation to efficiently calculate total quantity across all areas that have this item
      const result = await RectangleArea.aggregate([
        { $match: { 'inventoryItems.name': itemName } },
        { $unwind: '$inventoryItems' },
        { $match: { 'inventoryItems.name': itemName } },
        { $group: { 
          _id: null, 
          totalQuantity: { $sum: '$inventoryItems.quantity' }
        }}
      ]);
      
      return result[0]?.totalQuantity || 0;
    } 
    else if (alertType === 'area') {
      // Use projection to only fetch the specific inventory item
      const area = await RectangleArea.findOne(
        { 
          id: areaId, 
          campId: campId,
          'inventoryItems.name': itemName 
        },
        { 
          'inventoryItems.$': 1 
        }
      );
      
      return area?.inventoryItems?.[0]?.quantity || 0;
    }
    
    return 0;
  } catch (error) {
    console.error('Error calculating current quantity:', error);
    return 0;
  }
};

// Helper function to enrich alert with current quantity and trigger status
const enrichAlert = async (alert) => {
  const currentQuantity = await getCurrentQuantity(
    alert.itemName, 
    alert.alertType, 
    alert.campId, 
    alert.areaId
  );
  
  return {
    ...alert.toObject(),
    currentQuantity,
    isTriggered: currentQuantity <= alert.threshold
  };
};

// GET /api/alerts - Get all alerts
router.get('/', async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    
    // TODO: Not efficient. Each enrichAlert does a fetch of possibly similar queries. See if this can be fixed
    // Enrich alerts with current quantities
    const enrichedAlerts = await Promise.all(
      alerts.map(alert => enrichAlert(alert))
    );
    
    res.json(enrichedAlerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST /api/alerts - Create new alert
router.post('/', async (req, res) => {
  try {
    const { itemName, alertType, threshold, campId, areaId } = req.body;
    
    // Validation
    if (!itemName || !alertType || threshold === undefined) {
      return res.status(400).json({ error: 'Missing required fields: itemName, alertType, threshold' });
    }
    
    if (!['area', 'global'].includes(alertType)) {
      return res.status(400).json({ error: 'alertType must be either "area" or "global"' });
    }
    
    if (threshold < 0) {
      return res.status(400).json({ error: 'Threshold cannot be negative' });
    }
    
    let campName = null;
    let areaName = null;
    
    // If area-specific alert, validate camp and area exist
    if (alertType === 'area') {
      if (!campId || !areaId) {
        return res.status(400).json({ error: 'campId and areaId are required for area alerts' });
      }
      
      const camp = await Camp.findOne({ id: campId });
      if (!camp) {
        return res.status(404).json({ error: 'Camp not found' });
      }
      
      const area = await RectangleArea.findOne({ id: areaId, campId: campId });
      if (!area) {
        return res.status(404).json({ error: 'Area not found in camp' });
      }
      
      campName = camp.name;
      areaName = area.name;
    }
    
    // Check if similar alert already exists
    const existingAlert = await Alert.findOne({
      itemName,
      alertType,
      campId: alertType === 'area' ? campId : { $exists: false },
      areaId: alertType === 'area' ? areaId : { $exists: false }
    });
    
    if (existingAlert) {
      return res.status(400).json({ error: 'An alert for this item and location already exists' });
    }
    
    const alert = new Alert({
      id: uuidv4(),
      itemName: itemName.trim(),
      alertType,
      threshold,
      campId: alertType === 'area' ? campId : undefined,
      campName: alertType === 'area' ? campName : undefined,
      areaId: alertType === 'area' ? areaId : undefined,
      areaName: alertType === 'area' ? areaName : undefined,
      isActive: true
    });
    
    const savedAlert = await alert.save();
    const enrichedAlert = await enrichAlert(savedAlert);
    
    res.status(201).json(enrichedAlert);
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// PUT /api/alerts/:alertId - Update alert
router.put('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { threshold, isActive } = req.body;
    
    const alert = await Alert.findOne({ id: alertId });
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    // Update fields if provided
    if (threshold !== undefined) {
      if (threshold < 0) {
        return res.status(400).json({ error: 'Threshold cannot be negative' });
      }
      alert.threshold = threshold;
    }
    
    if (isActive !== undefined) {
      alert.isActive = isActive;
    }
    
    const savedAlert = await alert.save();
    const enrichedAlert = await enrichAlert(savedAlert);
    
    res.json(enrichedAlert);
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// DELETE /api/alerts/:alertId - Delete alert
router.delete('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    const result = await Alert.deleteOne({ id: alertId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// GET /api/alerts/triggered - Get currently triggered alerts
router.get('/triggered', async (req, res) => {
  try {
    const activeAlerts = await Alert.find({ isActive: true });
    
    // Check which alerts are triggered
    const triggeredAlerts = [];
    
    for (const alert of activeAlerts) {
      const currentQuantity = await getCurrentQuantity(
        alert.itemName, 
        alert.alertType, 
        alert.campId, 
        alert.areaId
      );
      
      if (currentQuantity <= alert.threshold) {
        triggeredAlerts.push({
          ...alert.toObject(),
          currentQuantity,
          isTriggered: true
        });
        
        // Update lastTriggered timestamp
        alert.lastTriggered = new Date();
        await alert.save();
      }
    }
    
    // Sort by urgency (lowest quantity first)
    triggeredAlerts.sort((a, b) => a.currentQuantity - b.currentQuantity);
    
    res.json(triggeredAlerts);
  } catch (error) {
    console.error('Error fetching triggered alerts:', error);
    res.status(500).json({ error: 'Failed to fetch triggered alerts' });
  }
});

module.exports = router; 