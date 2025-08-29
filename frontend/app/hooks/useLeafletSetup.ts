import { useEffect } from 'react';

// Encapsulates Leaflet CSS/icon setup, draw localization, rectangle readableArea patch,
// tooltip style injection, and draw:editstart listeners with cleanup.
export function useLeafletSetup(
  featureGroupRef: React.MutableRefObject<any>,
  originalBoundsRef: React.MutableRefObject<{ [key: string]: any }>
) {
  useEffect(() => {
    const setupLeaflet = () => {
      if (typeof window !== 'undefined') {
        import('leaflet/dist/leaflet.css');
        import('leaflet-draw/dist/leaflet.draw.css');

        Promise.all([
          import('leaflet'),
          import('leaflet/dist/images/marker-icon-2x.png'),
          import('leaflet/dist/images/marker-icon.png'),
          import('leaflet/dist/images/marker-shadow.png')
        ])
          .then(([L, markerIcon2x, markerIcon, markerShadow]) => {
            delete (L.default.Icon.Default.prototype as any)._getIconUrl;
            L.default.Icon.Default.mergeOptions({
              iconUrl: markerIcon.default,
              iconRetinaUrl: markerIcon2x.default,
              shadowUrl: markerShadow.default
            });

            // Patch readableArea after Leaflet is available
            patchReadableArea();
          })
          .catch(console.error);
      }
    };

    const injectTooltipStyle = () => {
      if (typeof window === 'undefined') return;
      const style = document.createElement('style');
      style.textContent = `
        .leaflet-draw-tooltip { pointer-events: none !important; z-index: 1000 !important; opacity: 0.8 !important; font-size: 12px !important; background: rgba(0, 0, 0, 0.8) !important; color: white !important; border-radius: 4px !important; padding: 4px 8px !important; border: none !important; box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important; transform: translateY(-10px) !important; }
        .leaflet-draw-tooltip:before { display: none !important; }
        .leaflet-draw-tooltip-single { margin-top: 8px !important; }
      `;
      document.head.appendChild(style);
      return () => {
        document.head.removeChild(style);
      };
    };

    const setupHebrewLocalization = () => {
      if (typeof window !== 'undefined' && (window as any).L && (window as any).L.drawLocal) {
        const L = (window as any).L;

        L.drawLocal.draw.handlers.rectangle.tooltip = { start: 'לחץ וגרור כדי לצייר מלבן' };
        L.drawLocal.draw.handlers.polygon.tooltip = {
          start: 'לחץ כדי להתחיל לצייר פוליגון',
          cont: 'לחץ כדי להמשיך לצייר פוליגון',
          end: 'לחץ על הנקודה הראשונה כדי לסגור את הפוליגון'
        } as any;
        L.drawLocal.draw.handlers.circle.tooltip = { start: 'לחץ וגרור כדי לצייר עיגול' } as any;
        L.drawLocal.draw.handlers.marker.tooltip = { start: 'לחץ על המפה כדי להציב סמן' } as any;
        L.drawLocal.draw.handlers.polyline.tooltip = {
          start: 'לחץ כדי להתחיל לצייר קו',
          cont: 'לחץ כדי להמשיך לצייר קו',
          end: 'לחץ על הנקודה האחרונה כדי לסיים את הקו'
        } as any;

        if (L.drawLocal.draw.toolbar.buttons) {
          L.drawLocal.draw.toolbar.buttons = {
            ...L.drawLocal.draw.toolbar.buttons,
            polygon: 'צייר פוליגון',
            rectangle: 'צייר מלבן',
            circle: 'צייר עיגול',
            marker: 'הוסף סמן',
            polyline: 'צייר קו'
          };
        }

        L.drawLocal.draw.toolbar.actions = { title: 'בטל ציור', text: 'בטל' } as any;
        L.drawLocal.draw.toolbar.finish = { title: 'סיים ציור', text: 'סיים' } as any;
        L.drawLocal.draw.toolbar.undo = { title: 'מחק נקודה אחרונה', text: 'מחק נקודה אחרונה' } as any;
        console.log('Hebrew localization applied to leaflet-draw');
      }
    };

    const patchReadableArea = () => {
      if (typeof window !== 'undefined' && (window as any).L && (window as any).L.GeometryUtil) {
        const L = (window as any).L;
        if (L.GeometryUtil && L.GeometryUtil.readableArea) {
          const originalFunction = L.GeometryUtil.readableArea;
          L.GeometryUtil.readableArea = function (area: number, isMetric: any, precision: any) {
            let areaStr, units;
            const defaultPrecision = { km: 2, ha: 2, m: 0, mi: 2, ac: 2, yd: 0, ft: 0, nm: 2 };
            precision = L.Util.extend({}, defaultPrecision, precision);

            if (isMetric) {
              units = ['ha', 'm'];
              const type = typeof isMetric;
              if (type === 'string') units = [isMetric];
              else if (type !== 'boolean') units = isMetric;

              if (area >= 1000000 && units.indexOf('km') !== -1) {
                areaStr = L.GeometryUtil.formattedNumber(area * 0.000001, precision.km) + " קמ\"ר";
              } else if (area >= 10000 && units.indexOf('ha') !== -1) {
                areaStr = L.GeometryUtil.formattedNumber(area * 0.0001, precision.ha) + ' הקטר';
              } else {
                areaStr = L.GeometryUtil.formattedNumber(area, precision.m) + " מ\"ר";
              }
            } else {
              area /= 0.836127;
              if (area >= 3097600) {
                areaStr = L.GeometryUtil.formattedNumber(area / 3097600, precision.mi) + ' מיל²';
              } else if (area >= 4840) {
                areaStr = L.GeometryUtil.formattedNumber(area / 4840, precision.ac) + ' אקר';
              } else {
                areaStr = L.GeometryUtil.formattedNumber(area, precision.yd) + ' יארד²';
              }
            }
            return areaStr;
          } as any;
        }
      }
    };

    const setupEditListeners = () => {
      if (featureGroupRef.current && featureGroupRef.current._map) {
        const map = featureGroupRef.current._map;
        map.on('draw:editstart', () => {
          if (featureGroupRef.current) {
            featureGroupRef.current.eachLayer((layer: any) => {
              if (layer.getBounds) {
                const layerId = layer._leaflet_id;
                originalBoundsRef.current[layerId] = layer.getBounds();
              }
            });
          }
        });
      }
    };

    setupLeaflet();
    const removeStyle = injectTooltipStyle();
    patchReadableArea();
    setupHebrewLocalization();

    const timeoutId1 = setTimeout(() => {
      patchReadableArea();
      setupHebrewLocalization();
      setupEditListeners();
    }, 1000);

    const timeoutId2 = setTimeout(() => {
      setupHebrewLocalization();
    }, 2000);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      if (removeStyle) removeStyle();
      if (featureGroupRef.current && featureGroupRef.current._map) {
        const map = featureGroupRef.current._map;
        map.off('draw:editstart');
      }
    };
  }, [featureGroupRef, originalBoundsRef]);
}


