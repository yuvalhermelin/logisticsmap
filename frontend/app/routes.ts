import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/map.tsx"),
  route("/camps", "routes/camps.tsx"),
  route("/areas", "routes/areas.tsx"),
  route("/inventory-analytics", "routes/inventory-analytics.tsx"),
  route("/tracking", "routes/tracking.tsx"),
] satisfies RouteConfig;
