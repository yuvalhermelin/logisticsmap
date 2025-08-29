import type { MetaFunction } from "react-router";
import ClientOnlyMap from "../components/ClientOnlyMap";

export const meta: MetaFunction = () => {
  return [
    { title: "תצוגת מפה - המכולה" },
    { name: "description", content: "מפה אינטראקטיבית המציגה אריחי ישראל" },
  ];
};

export default function MapPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg">
          <ClientOnlyMap 
            center={[31.5, 34.75]} 
            zoom={8}
            style={{ height: '800px', width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
} 