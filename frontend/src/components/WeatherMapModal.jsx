import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './WeatherMapModal.css';
import { useLanguage } from '../i18n/LanguageContext';

// Fix Leaflet default icon paths in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Danh sách các thành phố gợi ý nhảy nhanh
const QUICK_CITIES = [
  { name: 'Hà Nội',      lat: 21.0285, lon: 105.8542 },
  { name: 'Đà Nẵng',     lat: 16.0544, lon: 108.2022 },
  { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  { name: 'Huế',         lat: 16.4637, lon: 107.5909 },
  { name: 'Quảng Ninh',  lat: 20.9598, lon: 107.0421 },
  { name: 'Thái Nguyên', lat: 21.5942, lon: 105.8480 },
  { name: 'Hà Tĩnh',     lat: 18.3333, lon: 105.9000 },
  { name: 'Việt Trì',    lat: 21.3016, lon: 105.4015 },
  { name: 'Đà Lạt',      lat: 11.9404, lon: 108.4583 },
  { name: 'Cần Thơ',     lat: 10.0452, lon: 105.7469 },
];

export default function WeatherMapModal({
  isOpen,
  onClose,
  currentCoords,
  currentLabel,
  monitoredCities = [],
  onSelectLocation,
}) {
  const { t } = useLanguage();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const activeMarkerRef = useRef(null);

  const [selectedPoint, setSelectedPoint] = useState(null); // { lat, lon, label }
  const [resolvingName, setResolvingName] = useState(false);

  // Khởi tạo tọa độ mặc định
  const defaultLat = currentCoords?.lat ?? 21.0285;
  const defaultLon = currentCoords?.lon ?? 105.8542;

  // Reverse geocoding OpenStreetMap Nominatim
  const resolveLocationName = useCallback(async (lat, lon) => {
    setResolvingName(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=vi`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'vi' } });
      const data = await res.json();
      if (data && data.display_name) {
        // Tách chuỗi lấy 3 phần đầu cho gọn
        const parts = data.display_name.split(',').map((p) => p.trim());
        const shortName = parts.slice(0, 3).join(', ');
        return shortName || `Vị trí (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
      }
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    } finally {
      setResolvingName(false);
    }
    return `Tọa độ (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
  }, []);

  // Xử lý khi click vào bản đồ
  const handleMapClick = useCallback(async (lat, lon, knownLabel = null) => {
    let label = knownLabel;
    setSelectedPoint({ lat, lon, label: label || 'Đang xác định tên địa điểm...' });

    // Cập nhật marker trên bản đồ
    if (mapInstanceRef.current) {
      if (activeMarkerRef.current) {
        activeMarkerRef.current.setLatLng([lat, lon]);
      } else {
        const pinIcon = L.divIcon({
          className: 'custom-selected-pin-wrap',
          html: `
            <div class="selected-map-pin">
              <span class="pin-radar-ring"></span>
              <span class="pin-core-dot"></span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        activeMarkerRef.current = L.marker([lat, lon], { icon: pinIcon }).addTo(mapInstanceRef.current);
      }
    }

    if (!label) {
      label = await resolveLocationName(lat, lon);
      setSelectedPoint({ lat, lon, label });
    }
  }, [resolveLocationName]);

  // Khởi tạo Leaflet Map khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    // Reset selected point
    setSelectedPoint(
      currentCoords
        ? { lat: currentCoords.lat, lon: currentCoords.lon, label: currentLabel || 'Vị trí hiện tại' }
        : null
    );

    // Timeout ngắn để modal render DOM và kích thước container chính xác
    const initTimer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [defaultLat, defaultLon],
          zoom: currentCoords ? 10 : 7,
          zoomControl: false,
        });

        // Nút zoom đặt góc trên phải
        L.control.zoom({ position: 'topright' }).addTo(map);

        // Tile layer OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Marker cho 7 địa điểm theo dõi
        monitoredCities.forEach((city) => {
          if (!city.lat || !city.lon) return;

          const cityIcon = L.divIcon({
            className: 'monitored-city-pin-wrap',
            html: `
              <div class="monitored-city-pin">
                <span class="pin-dot"></span>
                <span class="pin-text">${city.name}</span>
              </div>
            `,
            iconSize: [80, 28],
            iconAnchor: [10, 14],
          });

          const m = L.marker([city.lat, city.lon], { icon: cityIcon }).addTo(map);
          m.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            handleMapClick(city.lat, city.lon, city.name);
          });
        });

        // Click trên bản đồ để chọn tọa độ bất kỳ
        map.on('click', (e) => {
          handleMapClick(e.latlng.lat, e.latlng.lng);
        });

        mapInstanceRef.current = map;
      }

      // Invalidate size để tile không bị vỡ / khuyết
      mapInstanceRef.current.invalidateSize();

      if (currentCoords) {
        handleMapClick(currentCoords.lat, currentCoords.lon, currentLabel);
      }
    }, 150);

    return () => {
      clearTimeout(initTimer);
    };
  }, [isOpen, defaultLat, defaultLon, currentCoords, currentLabel, monitoredCities, handleMapClick]);

  // Dọn dẹp map khi unmount hoặc đóng hoàn toàn
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      activeMarkerRef.current = null;
    }
  }, [isOpen]);

  // Phím Escape để đóng
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Di chuyển camera tới thành phố gợi ý
  const flyToCity = (city) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([city.lat, city.lon], 11, { duration: 1.2 });
    }
    handleMapClick(city.lat, city.lon, city.name);
  };

  // Xác nhận chọn điểm này
  const confirmSelection = () => {
    if (selectedPoint) {
      onSelectLocation(selectedPoint.lat, selectedPoint.lon, selectedPoint.label);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="map-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="map-modal-title">
      <div className="map-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header Modal */}
        <div className="map-modal-header">
          <div className="map-modal-title-group">
            <h2 id="map-modal-title" className="map-modal-title">
              <span className="title-icon">🗺️</span> {t('mapModal.title')}
            </h2>
            <p className="map-modal-subtitle">
              {t('mapModal.subtitle')}
            </p>
          </div>
          <button
            type="button"
            className="map-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng bản đồ"
            title="Đóng (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Thanh phím tắt các thành phố */}
        <div className="map-modal-quickbar">
          <span className="quickbar-label">{t('mapModal.quickJump')}</span>
          <div className="quickbar-scroll">
            {QUICK_CITIES.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`quickbar-chip ${selectedPoint?.label?.includes(c.name) ? 'active' : ''}`}
                onClick={() => flyToCity(c)}
              >
                📍 {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Map Container */}
        <div className="map-modal-body">
          <div ref={mapContainerRef} className="map-leaflet-container" />
          <div className="map-crosshair-hint">
            <span>{t('mapModal.clickHint')}</span>
          </div>
        </div>

        {/* Footer / Selected Point Info Card */}
        <div className="map-modal-footer">
          {selectedPoint ? (
            <div className="map-selected-info">
              <div className="selected-meta">
                <span className="selected-badge">{t('mapModal.selectedPoint')}</span>
                <span className="selected-label">{selectedPoint.label}</span>
                <span className="selected-coords">
                  ({selectedPoint.lat.toFixed(4)}, {selectedPoint.lon.toFixed(4)})
                </span>
                {resolvingName && <span className="resolving-indicator">{t('mapModal.resolving')}</span>}
              </div>
              <div className="selected-actions">
                <button
                  type="button"
                  className="btn-select-confirm"
                  onClick={confirmSelection}
                >
                  {t('mapModal.confirm')}
                </button>
              </div>
            </div>
          ) : (
            <div className="map-unselected-hint">
              <span>{t('mapModal.unselectedHint')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
