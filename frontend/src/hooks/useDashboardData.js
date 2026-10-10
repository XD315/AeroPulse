/**
 * useDashboardData — fetch dữ liệu chart từ /api/chart
 * Tự động re-fetch khi location / startDate / endDate / metric thay đổi.
 */
import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:5000';

// Màu cố định cho từng location slug
export const LOCATION_COLORS = {
  'hanoi':       '#ef4444',   // đỏ
  'da-nang':     '#10b981',   // xanh lá
  'hue':         '#8b5cf6',   // tím
  'thai-nguyen': '#f59e0b',   // vàng cam
  'quang-ninh':  '#3b82f6',   // xanh dương
  'ha-tinh':     '#ec4899',   // hồng
  'viet-tri':    '#06b6d4',   // cyan
};

export function useDashboardData({ locations, startDate, endDate, metric }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        start:  startDate,
        end:    endDate,
        metric,
      });
      // Nếu chọn tất cả hoặc rỗng → không truyền locations (BE trả all)
      if (locations && locations.length > 0) {
        params.set('locations', locations.join(','));
      }
      const res = await fetch(`${API_BASE}/api/chart?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(Array.isArray(json) ? null : json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [locations?.join(','), startDate, endDate, metric]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * useDataRange — lấy khoảng ngày có data cho location đang chọn
 */
export function useDataRange(location) {
  const [range, setRange] = useState(null);
  useEffect(() => {
    if (!location) return;
    fetch(`${API_BASE}/api/data-range?location=${location}`)
      .then((r) => r.json())
      .then(setRange)
      .catch(() => setRange(null));
  }, [location]);
  return range;
}

/**
 * useLocations — fetch danh sách locations từ /api/locations
 */
export function useLocations() {
  const [locations, setLocations] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/locations`)
      .then((r) => r.json())
      .then(setLocations)
      .catch(() => {});
  }, []);
  return locations;
}
