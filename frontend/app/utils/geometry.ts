import type { LatLngExpression, LatLngBounds } from 'leaflet';

// Alternative winding number algorithm for point in polygon
export const isPointInPolygonWindingNumber = (
  point: LatLngExpression,
  polygon: LatLngExpression[]
): boolean => {
  const [px, py] = point as [number, number];
  let windingNumber = 0;

  const vertexCount = polygon.length;
  if (vertexCount < 3) return false;

  for (let i = 0; i < vertexCount; i++) {
    const [x1, y1] = polygon[i] as [number, number];
    const [x2, y2] = polygon[(i + 1) % vertexCount] as [number, number];

    if (y1 <= py) {
      if (y2 > py) {
        if (isLeft(x1, y1, x2, y2, px, py) > 0) {
          windingNumber++;
        }
      }
    } else {
      if (y2 <= py) {
        if (isLeft(x1, y1, x2, y2, px, py) < 0) {
          windingNumber--;
        }
      }
    }
  }

  return windingNumber !== 0;
};

// Helper function for winding number algorithm
export const isLeft = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number => {
  return (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
};

// Point in polygon check using ray casting algorithm with fallback
export const isPointInPolygon = (
  point: LatLngExpression,
  polygon: LatLngExpression[]
): boolean => {
  const [lat, lng] = point as [number, number];

  const vertexCount = polygon.length;
  if (vertexCount < 3) return false;

  const windingResult = isPointInPolygonWindingNumber(point, polygon);

  // Ray casting as backup
  let inside = false;
  for (let i = 0, j = vertexCount - 1; i < vertexCount; j = i++) {
    const [xi, yi] = polygon[i] as [number, number];
    const [xj, yj] = polygon[j] as [number, number];

    // Check if point is exactly on vertex
    if (Math.abs(lat - yi) < 1e-10 && Math.abs(lng - xi) < 1e-10) {
      return true;
    }

    if (yi > lat !== yj > lat) {
      const intersectionX = xi + ((lat - yi) / (yj - yi)) * (xj - xi);
      if (lng < intersectionX) inside = !inside;
    }
  }

  if (windingResult !== inside) {
    console.warn('Algorithm mismatch!', {
      point: [lat, lng],
      polygon: polygon,
      windingResult: windingResult,
      raycastResult: inside
    });
  }

  return windingResult;
};

// Check if polygon is within another polygon
export const isPolygonInPolygon = (
  innerPolygon: LatLngExpression[],
  outerPolygon: LatLngExpression[]
): boolean => {
  for (const point of innerPolygon) {
    if (!isPointInPolygon(point, outerPolygon)) {
      return false;
    }
  }
  return true;
};

// Check if rectangle bounds are within polygon (kept for backward compatibility)
export const isRectangleInPolygon = (
  bounds: LatLngBounds,
  polygon: LatLngExpression[]
): boolean => {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const nw = [ne.lat, sw.lng] as LatLngExpression;
  const se = [sw.lat, ne.lng] as LatLngExpression;

  const width = Math.abs(ne.lng - sw.lng);
  const height = Math.abs(ne.lat - sw.lat);
  const isVerySmall = width < 0.001 && height < 0.001;

  if (isVerySmall) {
    const centerLat = (sw.lat + ne.lat) / 2;
    const centerLng = (sw.lng + ne.lng) / 2;
    const centerInside = isPointInPolygon([centerLat, centerLng], polygon);
    console.log('Very small rectangle, checking center only:', {
      center: [centerLat, centerLng],
      inside: centerInside
    });
    return centerInside;
  }

  const corners = [
    [sw.lat, sw.lng] as LatLngExpression,
    nw,
    [ne.lat, ne.lng] as LatLngExpression,
    se
  ];

  const cornerResults = corners.map((corner) => ({
    point: corner,
    inside: isPointInPolygon(corner, polygon)
  }));

  const allCornersInside = cornerResults.every((result) => result.inside);
  if (!allCornersInside) {
    console.log('Corner check failed:', cornerResults);
  }

  const centerLat = (sw.lat + ne.lat) / 2;
  const centerLng = (sw.lng + ne.lng) / 2;
  const centerInside = isPointInPolygon([centerLat, centerLng], polygon);

  if (allCornersInside) {
    return true;
  }

  if (!centerInside) {
    return false;
  }

  const cornersInside = cornerResults.filter((result) => result.inside).length;
  const mostCornersInside = cornersInside >= Math.ceil((corners.length * 0.75));

  return centerInside && mostCornersInside;
};


