const express = require('express');
const router = express.Router();
const Camp = require('../models/Camp');
const RectangleArea = require('../models/RectangleArea');

// Get all camps
router.get('/', async (req, res) => {
  try {
    const camps = await Camp.find().sort({ createdAt: -1 });
    
    // For each camp, fetch its rectangle areas
    const campsWithRectangles = await Promise.all(
      camps.map(async (camp) => {
        const rectangleAreas = await RectangleArea.find({ campId: camp.id });
        return {
          ...camp.toObject(),
          rectangleAreas
        };
      })
    );
    
    res.json(campsWithRectangles);
  } catch (error) {
    console.error('Error fetching camps:', error);
    res.status(500).json({ error: 'Failed to fetch camps' });
  }
});

// Create a new camp
router.post('/', async (req, res) => {
  try {
    const { id, name, positions } = req.body;
    
    const camp = new Camp({
      id,
      name,
      positions
    });
    
    const savedCamp = await camp.save();
    
    // Include empty rectangleAreas array for backward compatibility
    res.status(201).json({
      ...savedCamp.toObject(),
      rectangleAreas: []
    });
  } catch (error) {
    console.error('Error creating camp:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Camp with this ID already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create camp' });
    }
  }
});

// Update a camp
router.put('/:campId', async (req, res) => {
  try {
    const { campId } = req.params;
    const updateData = req.body;
    
    // Remove rectangleAreas from update data as it's now a separate collection
    delete updateData.rectangleAreas;
    
    const camp = await Camp.findOneAndUpdate(
      { id: campId },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    // Fetch rectangle areas for this camp
    const rectangleAreas = await RectangleArea.find({ campId: campId });
    
    res.json({
      ...camp.toObject(),
      rectangleAreas
    });
  } catch (error) {
    console.error('Error updating camp:', error);
    res.status(500).json({ error: 'Failed to update camp' });
  }
});

// Delete a camp
router.delete('/:campId', async (req, res) => {
  try {
    const { campId } = req.params;
    
    const camp = await Camp.findOneAndDelete({ id: campId });
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    // Also delete all rectangle areas associated with this camp
    await RectangleArea.deleteMany({ campId: campId });
    
    res.json({ message: 'Camp deleted successfully' });
  } catch (error) {
    console.error('Error deleting camp:', error);
    res.status(500).json({ error: 'Failed to delete camp' });
  }
});

// Add rectangle area to camp
router.post('/:campId/rectangles', async (req, res) => {
  try {
    const { campId } = req.params;
    const rectangleData = req.body;
    
    const camp = await Camp.findOne({ id: campId });
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    // Create new rectangle area with campId
    const rectangleArea = new RectangleArea({
      ...rectangleData,
      campId: campId
    });
    
    await rectangleArea.save();
    
    // Return the camp with all its rectangle areas
    const rectangleAreas = await RectangleArea.find({ campId: campId });
    
    res.status(201).json({
      ...camp.toObject(),
      rectangleAreas
    });
  } catch (error) {
    console.error('Error adding rectangle to camp:', error);
    res.status(500).json({ error: 'Failed to add rectangle to camp' });
  }
});

// Update rectangle area in camp
router.put('/:campId/rectangles/:rectangleId', async (req, res) => {
  try {
    const { campId, rectangleId } = req.params;
    const rectangleData = req.body;
    
    const camp = await Camp.findOne({ id: campId });
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    // Update the rectangle area
    const updatedRectangle = await RectangleArea.findOneAndUpdate(
      { id: rectangleId, campId: campId },
      rectangleData,
      { new: true, runValidators: true }
    );
    
    if (!updatedRectangle) {
      return res.status(404).json({ error: 'Rectangle not found' });
    }
    
    // Return the camp with all its rectangle areas
    const rectangleAreas = await RectangleArea.find({ campId: campId });
    
    res.json({
      ...camp.toObject(),
      rectangleAreas
    });
  } catch (error) {
    console.error('Error updating rectangle in camp:', error);
    res.status(500).json({ error: 'Failed to update rectangle in camp' });
  }
});

// Delete rectangle area from camp
router.delete('/:campId/rectangles/:rectangleId', async (req, res) => {
  try {
    const { campId, rectangleId } = req.params;
    
    const camp = await Camp.findOne({ id: campId });
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    const deletedRectangle = await RectangleArea.findOneAndDelete({ 
      id: rectangleId, 
      campId: campId 
    });
    
    if (!deletedRectangle) {
      return res.status(404).json({ error: 'Rectangle not found' });
    }
    
    // Return the camp with remaining rectangle areas
    const rectangleAreas = await RectangleArea.find({ campId: campId });
    
    res.json({
      ...camp.toObject(),
      rectangleAreas
    });
  } catch (error) {
    console.error('Error deleting rectangle from camp:', error);
    res.status(500).json({ error: 'Failed to delete rectangle from camp' });
  }
});

module.exports = router; 