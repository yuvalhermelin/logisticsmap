// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

db = db.getSiblingDB('logisticmap');

// Create the camps collection with validation
db.createCollection('camps', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'name', 'positions'],
      properties: {
        id: {
          bsonType: 'string',
          description: 'Unique identifier for the camp'
        },
        name: {
          bsonType: 'string',
          description: 'Name of the camp'
        },
        positions: {
          bsonType: 'array',
          description: 'Array of position coordinates',
          items: {
            bsonType: 'object',
            required: ['lat', 'lng'],
            properties: {
              lat: {
                bsonType: 'number',
                description: 'Latitude coordinate'
              },
              lng: {
                bsonType: 'number',
                description: 'Longitude coordinate'
              }
            }
          }
        },
        rectangleAreas: {
          bsonType: 'array',
          description: 'Array of rectangle areas within the camp'
        }
      }
    }
  }
});

// Create index on the id field for better performance
db.camps.createIndex({ 'id': 1 }, { unique: true });

// Create index on name for text searches
db.camps.createIndex({ 'name': 'text' });

print('MongoDB initialization completed successfully');
print('Database: logisticmap');
print('Collection: camps created with validation and indexes'); 