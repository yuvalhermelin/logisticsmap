const express = require('express');
const router = express.Router();
const Camp = require('../models/Camp');
const PolygonArea = require('../models/PolygonArea');
const AreaType = require('../models/AreaType');

// Get all camps
router.get('/', async (req, res) => {
  try {
    const camps = await Camp.find().sort({ createdAt: -1 });
    
    // For each camp, fetch its polygon areas
    const campsWithPolygons = await Promise.all(
      camps.map(async (camp) => {
        const polygonAreas = await PolygonArea.find({ campId: camp.id });
        return {
          ...camp.toObject(),
          polygonAreas
        };
      })
    );
    
    res.json(campsWithPolygons);
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
    
    // Include empty polygonAreas array for backward compatibility
    res.status(201).json({
      ...savedCamp.toObject(),
      polygonAreas: []
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
    
    // Remove polygonAreas from update data as it's now a separate collection
    delete updateData.polygonAreas;
    
    const camp = await Camp.findOneAndUpdate(
      { id: campId },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
        // Fetch polygon areas for this camp
    const polygonAreas = await PolygonArea.find({ campId: campId });

    res.json({
      ...camp.toObject(),
      polygonAreas
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
    
    // Also delete all polygon areas associated with this camp
    await PolygonArea.deleteMany({ campId: campId });
    
    res.json({ message: 'Camp deleted successfully' });
  } catch (error) {
    console.error('Error deleting camp:', error);
    res.status(500).json({ error: 'Failed to delete camp' });
  }
});

// Add polygon area to camp
router.post('/:campId/polygons', async (req, res) => {
  try {
    const { campId } = req.params;
    const polygonData = req.body;
    
    const camp = await Camp.findOne({ id: campId });
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    // Resolve type if provided (typeId or typeName)
    let finalTypeId = null;
    let finalTypeName = null;
    if (polygonData.typeId || polygonData.typeName) {
      let typeDoc = null;
      if (polygonData.typeId) {
        typeDoc = await AreaType.findOne({ id: polygonData.typeId });
      } else if (polygonData.typeName) {
        typeDoc = await AreaType.findOne({ name: polygonData.typeName.trim() });
        if (!typeDoc && polygonData.typeName.trim()) {
          // Auto-create new type
          const { v4: uuidv4 } = require('uuid');
          typeDoc = await new AreaType({ id: uuidv4(), name: polygonData.typeName.trim() }).save();
        }
      }
      if (typeDoc) {
        finalTypeId = typeDoc.id;
        finalTypeName = typeDoc.name;
      }
    }

    // Create new polygon area with campId and resolved type
    const polygonArea = new PolygonArea({
      ...polygonData,
      campId: campId,
      typeId: finalTypeId,
      typeName: finalTypeName
    });
    
    await polygonArea.save();
    
    // Return the camp with all its polygon areas
    const polygonAreas = await PolygonArea.find({ campId: campId });
    
    res.status(201).json({
      ...camp.toObject(),
      polygonAreas
    });
  } catch (error) {
    console.error('Error adding polygon to camp:', error);
    res.status(500).json({ error: 'Failed to add polygon to camp' });
  }
});

// Update polygon area in camp
router.put('/:campId/polygons/:polygonId', async (req, res) => {
  try {
    const { campId, polygonId } = req.params;
    const polygonData = req.body;
    
    const camp = await Camp.findOne({ id: campId });
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    // Resolve type if provided and normalize stored fields
    const updateDoc = { ...polygonData };
    if (polygonData.typeId || polygonData.typeName) {
      let typeDoc = null;
      if (polygonData.typeId) {
        typeDoc = await AreaType.findOne({ id: polygonData.typeId });
      } else if (polygonData.typeName) {
        typeDoc = await AreaType.findOne({ name: polygonData.typeName.trim() });
        if (!typeDoc && polygonData.typeName.trim()) {
          const { v4: uuidv4 } = require('uuid');
          typeDoc = await new AreaType({ id: uuidv4(), name: polygonData.typeName.trim() }).save();
        }
      }
      if (typeDoc) {
        updateDoc.typeId = typeDoc.id;
        updateDoc.typeName = typeDoc.name;
      } else {
        updateDoc.typeId = null;
        updateDoc.typeName = null;
      }
    }

    // Update the polygon area
    const updatedPolygon = await PolygonArea.findOneAndUpdate(
      { id: polygonId, campId: campId },
      updateDoc,
      { new: true, runValidators: true }
    );
    
    if (!updatedPolygon) {
      return res.status(404).json({ error: 'Polygon not found' });
    }
    
    // Return the camp with all its polygon areas
    const polygonAreas = await PolygonArea.find({ campId: campId });
    
    res.json({
      ...camp.toObject(),
      polygonAreas
    });
  } catch (error) {
    console.error('Error updating polygon in camp:', error);
    res.status(500).json({ error: 'Failed to update polygon in camp' });
  }
});

// Delete polygon area from camp
router.delete('/:campId/polygons/:polygonId', async (req, res) => {
  try {
    const { campId, polygonId } = req.params;
    
    const camp = await Camp.findOne({ id: campId });
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    const deletedPolygon = await PolygonArea.findOneAndDelete({ 
      id: polygonId, 
      campId: campId 
    });
    
    if (!deletedPolygon) {
      return res.status(404).json({ error: 'Polygon not found' });
    }
    
    // Return the camp with remaining polygon areas
    const polygonAreas = await PolygonArea.find({ campId: campId });
    
    res.json({
      ...camp.toObject(),
      polygonAreas
    });
  } catch (error) {
    console.error('Error deleting polygon from camp:', error);
    res.status(500).json({ error: 'Failed to delete polygon from camp' });
  }
});

module.exports = router; 