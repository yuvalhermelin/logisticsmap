import { useState, useEffect } from 'react';
import type { LatLngExpression } from 'leaflet';

interface MapProps {
  center?: LatLngExpression;
  zoom?: number;
  style?: React.CSSProperties;
}

export default function ClientOnlyMap(props: MapProps) {
  const [isClient, setIsClient] = useState(false);
  const [MapComponent, setMapComponent] = useState<React.ComponentType<MapProps> | null>(null);

  useEffect(() => {
    // Set isClient to true once we're in the browser
    setIsClient(true);
    
    // Dynamically import the Map component to avoid SSR issues
    const loadMapComponent = async () => {
      try {
        const { default: Map } = await import('./Map');
        setMapComponent(() => Map);
      } catch (error) {
        console.error('Failed to load Map component:', error);
      }
    };

    loadMapComponent();
  }, []);

  // Show loading state during SSR and while loading
  if (!isClient || !MapComponent) {
    return (
      <div 
        style={props.style || { height: '500px', width: '100%' }}
        className="flex items-center justify-center bg-gray-100 rounded-lg"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  // Render the actual map component on the client
  return <MapComponent {...props} />;
} 