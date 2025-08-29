const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Camp = require('../models/Camp');
const PolygonArea = require('../models/PolygonArea');
const AreaType = require('../models/AreaType');
const AreaStatus = require('../models/AreaStatus');

// Get camps (defaults to non-archived). Query: archived=true|false|all
router.get('/', async (req, res) => {
  try {
    const { archived } = req.query;
    let campFilter = {};
    if (archived === 'true') campFilter = { archived: true };
    else if (archived === 'all') campFilter = {};
    else campFilter = { archived: { $ne: true } };

    const camps = await Camp.find(campFilter).sort({ createdAt: -1 });
    
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
      positions,
      archived: false
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

// Update a camp (blocked for archived camps)
router.put('/:campId', async (req, res) => {
  try {
    const { campId } = req.params;
    const updateData = req.body;
    
    // Remove polygonAreas from update data as it's now a separate collection
    delete updateData.polygonAreas;
    
    const existing = await Camp.findOne({ id: campId });
    if (!existing) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    if (existing.archived) {
      return res.status(400).json({ error: 'Cannot update an archived camp' });
    }

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

// Archive a camp (legacy delete now archives)
router.delete('/:campId', async (req, res) => {
  try {
    const { campId } = req.params;
    
    const camp = await Camp.findOne({ id: campId });
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    if (camp.archived) {
      return res.status(400).json({ error: 'Camp already archived. Use permanent delete to remove.' });
    }

    camp.archived = true;
    await camp.save();

    const polygonAreas = await PolygonArea.find({ campId: campId });
    
    res.json({
      ...camp.toObject(),
      polygonAreas
    });
  } catch (error) {
    console.error('Error deleting camp:', error);
    res.status(500).json({ error: 'Failed to archive camp' });
  }
});

// Explicitly archive a camp
router.post('/:campId/archive', async (req, res) => {
  try {
    const { campId } = req.params;
    const camp = await Camp.findOne({ id: campId });
    if (!camp) return res.status(404).json({ error: 'Camp not found' });
    if (camp.archived) return res.status(400).json({ error: 'Camp already archived' });
    camp.archived = true;
    await camp.save();
    const polygonAreas = await PolygonArea.find({ campId: campId });
    res.json({ ...camp.toObject(), polygonAreas });
  } catch (error) {
    console.error('Error archiving camp:', error);
    res.status(500).json({ error: 'Failed to archive camp' });
  }
});

// Unarchive a camp
router.post('/:campId/unarchive', async (req, res) => {
  try {
    const { campId } = req.params;
    const camp = await Camp.findOne({ id: campId });
    if (!camp) return res.status(404).json({ error: 'Camp not found' });
    if (!camp.archived) return res.status(400).json({ error: 'Camp is not archived' });
    camp.archived = false;
    await camp.save();
    const polygonAreas = await PolygonArea.find({ campId: campId });
    res.json({ ...camp.toObject(), polygonAreas });
  } catch (error) {
    console.error('Error unarchiving camp:', error);
    res.status(500).json({ error: 'Failed to unarchive camp' });
  }
});

// Permanently delete a camp and its polygon areas and files
router.delete('/:campId/permanent', async (req, res) => {
  try {
    const { campId } = req.params;
    const camp = await Camp.findOneAndDelete({ id: campId });
    if (!camp) return res.status(404).json({ error: 'Camp not found' });

    // Delete all polygon areas and their files from disk
    const areas = await PolygonArea.find({ campId });
    const uploadsDir = path.join(__dirname, '../uploads');
    areas.forEach(area => {
      (area.files || []).forEach(file => {
        const filePath = path.join(uploadsDir, file.fileName);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) { console.warn('Failed to remove file', filePath, e); }
        }
      });
    });
    await PolygonArea.deleteMany({ campId });

    res.json({ message: 'Camp permanently deleted' });
  } catch (error) {
    console.error('Error permanently deleting camp:', error);
    res.status(500).json({ error: 'Failed to permanently delete camp' });
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
    
    if (camp.archived) {
      return res.status(400).json({ error: 'Cannot add polygon to an archived camp' });
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

    // Resolve status if provided (statusId or statusName)
    let finalStatusId = null;
    let finalStatusName = null;
    if (polygonData.statusId || polygonData.statusName) {
      let statusDoc = null;
      if (polygonData.statusId) {
        statusDoc = await AreaStatus.findOne({ id: polygonData.statusId });
      } else if (polygonData.statusName) {
        statusDoc = await AreaStatus.findOne({ name: polygonData.statusName.trim() });
        if (!statusDoc && polygonData.statusName.trim()) {
          const { v4: uuidv4 } = require('uuid');
          statusDoc = await new AreaStatus({ id: uuidv4(), name: polygonData.statusName.trim() }).save();
        }
      }
      if (statusDoc) {
        finalStatusId = statusDoc.id;
        finalStatusName = statusDoc.name;
      }
    }

    // Create new polygon area with campId and resolved type
    const polygonArea = new PolygonArea({
      ...polygonData,
      campId: campId,
      typeId: finalTypeId,
      typeName: finalTypeName,
      statusId: finalStatusId,
      statusName: finalStatusName
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
    
    if (camp.archived) {
      return res.status(400).json({ error: 'Cannot update polygon in an archived camp' });
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

    // Resolve status if provided
    if (polygonData.statusId || polygonData.statusName) {
      let statusDoc = null;
      if (polygonData.statusId) {
        statusDoc = await AreaStatus.findOne({ id: polygonData.statusId });
      } else if (polygonData.statusName) {
        statusDoc = await AreaStatus.findOne({ name: polygonData.statusName.trim() });
        if (!statusDoc && polygonData.statusName.trim()) {
          const { v4: uuidv4 } = require('uuid');
          statusDoc = await new AreaStatus({ id: uuidv4(), name: polygonData.statusName.trim() }).save();
        }
      }
      if (statusDoc) {
        updateDoc.statusId = statusDoc.id;
        updateDoc.statusName = statusDoc.name;
      } else {
        updateDoc.statusId = null;
        updateDoc.statusName = null;
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
    
    if (camp.archived) {
      return res.status(400).json({ error: 'Cannot delete polygon from an archived camp' });
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