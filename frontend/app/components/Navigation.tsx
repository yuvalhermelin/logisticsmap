import { Link, useLocation } from "react-router";

export default function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "מפה", icon: "🗺️" },
    { path: "/camps", label: "מחנות", icon: "🏕️" },
    { path: "/inventory-analytics", label: "אנליטיקה", icon: "📊" },
    { path: "/tracking", label: "מעקב והתראות", icon: "🔔" },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-xl font-bold text-gray-900">
              מפה לוגיסטית
            </Link>
          </div>
          
          <div className="flex space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span className="ml-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
} 