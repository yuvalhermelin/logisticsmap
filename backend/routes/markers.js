const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Camp = require('../models/Camp');
const CampMarker = require('../models/CampMarker');
const InventoryItemCatalog = require('../models/InventoryItem');

// List markers for a camp
router.get('/:campId', async (req, res) => {
  try {
    const { campId } = req.params;
    const camp = await Camp.findOne({ id: campId });
    if (!camp) return res.status(404).json({ error: 'Camp not found' });
    const markers = await CampMarker.find({ campId });
    res.json(markers);
  } catch (e) {
    console.error('Error listing camp markers:', e);
    res.status(500).json({ error: 'Failed to list camp markers' });
  }
});

// Create a marker in a camp
router.post('/:campId', async (req, res) => {
  try {
    const { campId } = req.params;
    const { lat, lng, color, inventoryItemId, quantity, expiryDate } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat and lng are required' });
    }
    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ error: 'quantity must be non-negative' });
    }

    const camp = await Camp.findOne({ id: campId });
    if (!camp) return res.status(404).json({ error: 'Camp not found' });
    if (camp.archived) return res.status(400).json({ error: 'Cannot add marker to an archived camp' });

    const catalogItem = await InventoryItemCatalog.findOne({ id: inventoryItemId });
    if (!catalogItem) return res.status(404).json({ error: 'Inventory item not found in catalog' });

    const marker = new CampMarker({
      id: uuidv4(),
      campId,
      lat,
      lng,
      color: color || '#3388ff',
      itemId: catalogItem.id,
      itemName: catalogItem.name,
      quantity,
      expiryDate: expiryDate ? new Date(expiryDate) : null
    });
    const saved = await marker.save();
    res.status(201).json(saved);
  } catch (e) {
    console.error('Error creating camp marker:', e);
    res.status(500).json({ error: 'Failed to create camp marker' });
  }
});

// Update a marker
router.put('/:campId/:markerId', async (req, res) => {
  try {
    const { campId, markerId } = req.params;
    const { lat, lng, color, quantity, expiryDate, inventoryItemId } = req.body;

    const camp = await Camp.findOne({ id: campId });
    if (!camp) return res.status(404).json({ error: 'Camp not found' });
    if (camp.archived) return res.status(400).json({ error: 'Cannot update marker in an archived camp' });

    const updateDoc = {};
    if (typeof lat === 'number') updateDoc.lat = lat;
    if (typeof lng === 'number') updateDoc.lng = lng;
    if (typeof color === 'string') updateDoc.color = color;
    if (quantity !== undefined) {
      if (quantity < 0) return res.status(400).json({ error: 'Quantity cannot be negative' });
      updateDoc.quantity = quantity;
    }
    if (req.body.hasOwnProperty('expiryDate')) {
      updateDoc.expiryDate = expiryDate ? new Date(expiryDate) : null;
    }
    if (inventoryItemId) {
      const catalogItem = await InventoryItemCatalog.findOne({ id: inventoryItemId });
      if (!catalogItem) return res.status(404).json({ error: 'Inventory item not found in catalog' });
      updateDoc.itemId = catalogItem.id;
      updateDoc.itemName = catalogItem.name;
    }

    const updated = await CampMarker.findOneAndUpdate({ id: markerId, campId }, updateDoc, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Marker not found' });
    res.json(updated);
  } catch (e) {
    console.error('Error updating camp marker:', e);
    res.status(500).json({ error: 'Failed to update camp marker' });
  }
});

// Delete a marker
router.delete('/:campId/:markerId', async (req, res) => {
  try {
    const { campId, markerId } = req.params;
    const camp = await Camp.findOne({ id: campId });
    if (!camp) return res.status(404).json({ error: 'Camp not found' });
    if (camp.archived) return res.status(400).json({ error: 'Cannot delete marker from an archived camp' });

    const result = await CampMarker.findOneAndDelete({ id: markerId, campId });
    if (!result) return res.status(404).json({ error: 'Marker not found' });
    res.json({ message: 'Marker deleted' });
  } catch (e) {
    console.error('Error deleting camp marker:', e);
    res.status(500).json({ error: 'Failed to delete camp marker' });
  }
});

module.exports = router;


