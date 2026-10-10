import { useState, useEffect, useCallback, useRef } from 'react';
import WeatherMapModal from '../components/WeatherMapModal';
import './WeatherPage.css';
import { useLanguage } from '../i18n/LanguageContext';

// ── Cấu hình địa điểm ──────────────────────────────────────
const MONITORED_CITIES = [
  { name: 'Hà Nội',      slug: 'hanoi',       lat: 21.0285, lon: 105.8542 },
  { name: 'Đà Nẵng',     slug: 'da-nang',     lat: 16.0544, lon: 108.2022 },
  { name: 'Huế',         slug: 'hue',         lat: 16.4637, lon: 107.5909 },
  { name: 'Thái Nguyên', slug: 'thai-nguyen', lat: 21.5942, lon: 105.8480 },
  { name: 'Quảng Ninh',  slug: 'quang-ninh',  lat: 20.9598, lon: 107.0421 },
  { name: 'Hà Tĩnh',     slug: 'ha-tinh',     lat: 18.3333, lon: 105.9000 },
  { name: 'Việt Trì',    slug: 'viet-tri',    lat: 21.3016, lon: 105.4015 },
];

const LOCATION_MAP = Object.fromEntries(MONITORED_CITIES.map(c => [c.name, c.slug]));
const monitoredLocations = MONITORED_CITIES.map(c => c.name);
const CITY_COORDS = Object.fromEntries(MONITORED_CITIES.map(c => [c.slug, [c.lat, c.lon]]));



// ── Helpers ──────────────────────────────────────────────────
function formatCurrentTime(iso, lang = 'vi') {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const D = lang === 'en'
      ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      : ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
    return `${D[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return iso; }
}

function uvLabel(uv, lang = 'vi') {
  if (uv == null) return '—';
  if (lang === 'en') {
    if (uv <= 2)  return `${uv} Low`;
    if (uv <= 5)  return `${uv} Moderate`;
    if (uv <= 7)  return `${uv} High`;
    if (uv <= 10) return `${uv} Very High`;
    return `${uv} Extreme`;
  }
  if (uv <= 2)  return `${uv} Thấp`;
  if (uv <= 5)  return `${uv} Trung bình`;
  if (uv <= 7)  return `${uv} Cao`;
  if (uv <= 10) return `${uv} Rất cao`;
  return `${uv} Cực cao`;
}

function windDir(deg) {
  if (deg == null) return '';
  const dirs = ['↑N','↗NE','→E','↘SE','↓S','↙SW','←W','↖NW'];
  return dirs[Math.round(deg / 45) % 8];
}

// ── Biểu đồ nhiệt độ SVG ────────────────────────────────────
function TempChart({ hourly }) {
  if (!hourly || !hourly.length) return null;
  const temps  = hourly.map(h => h.temp ?? 0);
  const minT   = Math.min(...temps);
  const maxT   = Math.max(...temps);
  const range  = maxT - minT || 1;
  const W = 700, H = 100, PAD = 14;
  const step   = (W - PAD * 2) / Math.max(temps.length - 1, 1);

  const pts = temps.map((t, i) => {
    const x = PAD + i * step;
    const y = PAD + (1 - (t - minT) / range) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(' ');

  const area = `${PAD},${H} ${pts} ${PAD + (temps.length - 1) * step},${H}`;

  return (
    <div className="temp-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="temp-chart-svg" aria-label="Biểu đồ nhiệt độ 24h">
        <defs>
          <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4a9cc5" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#4a9cc5" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#tGrad)" />
        <polyline points={pts} fill="none" stroke="#4a9cc5" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />
        {temps.map((t, i) => {
          if (i % 3 !== 0) return null;
          const x = PAD + i * step;
          const y = PAD + (1 - (t - minT) / range) * (H - PAD * 2);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill="#4a9cc5" />
              <text x={x} y={y - 6} textAnchor="middle" fontSize="10"
                fill="#4a9cc5" fontWeight="600">{Math.round(t)}°</text>
            </g>
          );
        })}
      </svg>
      <div className="temp-chart-labels">
        {hourly.filter((_,i) => i % 3 === 0).map((h,i) => <span key={i}>{h.time}</span>)}
      </div>
    </div>
  );
}

// ── Component chính ──────────────────────────────────────────
export default function WeatherPage() {
  const { lang, t } = useLanguage();
  const isEn = lang === 'en';
  const [activeTab,     setActiveTab]     = useState('current');
  const [location,      setLocation]      = useState('Hà Nội');
  const [selectedDay,   setSelectedDay]   = useState(null);
  const [weather,       setWeather]       = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [gpsLoading,    setGpsLoading]    = useState(false);
  const [gpsLabel,      setGpsLabel]      = useState(null);

  // ── Unified Search & Dropdown State ──────────────────────
  const [searchText,      setSearchText]      = useState('');
  const [suggestions,     setSuggestions]     = useState([]);
  const [isDropdownOpen,  setIsDropdownOpen]  = useState(false);
  const [searching,       setSearching]       = useState(false);
  const [customCoords,    setCustomCoords]    = useState(null); // {lat,lon,label}
  const [showMapModal,    setShowMapModal]    = useState(false);

  const searchWrapRef = useRef(null);

  // Đóng dropdown khi nhấp ra ngoài
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ── Fetch từ backend ────────────────────────────────────
  const fetchBySlug = useCallback(async (slug) => {
    setLoading(true); setError(null); setWeather(null);
    try {
      const res = await fetch(`http://localhost:5000/api/weather?location=${slug}`);
      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
      setWeather(await res.json());
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const fetchByCoords = useCallback(async (lat, lon, label) => {
    setLoading(true); setError(null); setWeather(null);
    try {
      const res = await fetch(`http://localhost:5000/api/weather?location=gps&lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setWeather({ ...data, label: label || data.label });
      setGpsLabel(label || data.label);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  // ── GPS ────────────────────────────────────────────────
  const handleGps = useCallback(() => {
    if (!navigator.geolocation) { setError('Trình duyệt không hỗ trợ GPS'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLoading(false);
        setSearchText('');
        setGpsLabel('Vị trí của tôi');
        setCustomCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Vị trí của tôi' });
        fetchByCoords(pos.coords.latitude, pos.coords.longitude, 'Vị trí của tôi');
      },
      err => { setGpsLoading(false); setError(`Không lấy được vị trí: ${err.message}`); },
      { timeout: 8000 }
    );
  }, [fetchByCoords]);

  // ── Tìm kiếm Nominatim (OpenStreetMap geocoder) ───────
  const searchLocation = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=vn&accept-language=vi`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'vi' } });
      const data = await res.json();
      setSuggestions(data.map(r => {
        const parts = r.display_name.split(',').map(p => p.trim());
        const title = parts[0];
        const subtitle = parts.slice(1, 3).join(', ');
        return {
          title,
          subtitle,
          label: parts.slice(0, 3).join(', '),
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
        };
      }));
    } catch { setSuggestions([]); }
    finally { setSearching(false); }
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => searchLocation(searchText), 350);
    return () => clearTimeout(t);
  }, [searchText, searchLocation]);

  // Chọn gợi ý từ tìm kiếm
  const selectSuggestion = (item) => {
    setSearchText('');
    setSuggestions([]);
    setIsDropdownOpen(false);
    setGpsLabel(item.label);
    setCustomCoords({ lat: item.lat, lon: item.lon, label: item.label });
    fetchByCoords(item.lat, item.lon, item.label);
  };

  // Chọn 1 trong 7 địa điểm mặc định
  const handleSelectPreset = (cityName) => {
    setLocation(cityName);
    setGpsLabel(null);
    setCustomCoords(null);
    setSearchText('');
    setSuggestions([]);
    setSelectedDay(null);
    setIsDropdownOpen(false);
  };

  // Chọn vị trí từ Modal Bản đồ
  const handleSelectLocationFromMap = (lat, lon, label) => {
    setGpsLabel(label);
    setCustomCoords({ lat, lon, label });
    setSearchText('');
    setSuggestions([]);
    setSelectedDay(null);
    setIsDropdownOpen(false);
    fetchByCoords(lat, lon, label);
  };

  const handleRefresh = () => {
    if (customCoords) fetchByCoords(customCoords.lat, customCoords.lon, customCoords.label);
    else fetchBySlug(LOCATION_MAP[location]);
  };

  useEffect(() => {
    if (!gpsLabel && !customCoords) fetchBySlug(LOCATION_MAP[location]);
  }, [location, gpsLabel, customCoords, fetchBySlug]);

  const cur    = weather?.current ?? {};
  const hourly = weather?.hourly  ?? [];
  const daily  = weather?.daily   ?? [];
  const alerts = weather?.alerts  ?? [];
  const displayLabel = gpsLabel ?? location;

  const mapLat = customCoords?.lat ?? CITY_COORDS[LOCATION_MAP[location]]?.[0] ?? 21.0285;
  const mapLon = customCoords?.lon ?? CITY_COORDS[LOCATION_MAP[location]]?.[1] ?? 105.8542;

  // Lọc 7 địa điểm theo text người dùng gõ
  const filteredPresets = monitoredLocations.filter(name => 
    !searchText.trim() || name.toLowerCase().includes(searchText.trim().toLowerCase())
  );

  return (
    <div className="weather-page">
      {/* ── Controls ───────────────────────────────── */}
      <div className="weather-controls">
        {/* Thanh tìm kiếm & chọn 7 địa điểm tích hợp */}
        <div className="unified-search-wrap" ref={searchWrapRef}>
          <div className={`unified-search-bar ${isDropdownOpen ? 'bar-focused' : ''}`}>
            <span className="usb-icon">🔍</span>
            <input
              type="text"
              className="usb-input"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder={
                displayLabel
                  ? (isEn ? `📍 ${displayLabel} (Click to select cities or search...)` : `📍 ${displayLabel} (Nhấp để chọn 7 địa điểm hoặc gõ tìm kiếm...)`)
                  : t('weather.searchPlaceholder')
              }
              aria-label={t('weather.searchPlaceholder')}
              aria-expanded={isDropdownOpen}
              aria-autocomplete="list"
            />
            {searchText ? (
              <button
                type="button"
                className="usb-clear-btn"
                onClick={() => {
                  setSearchText('');
                  setSuggestions([]);
                }}
                title={t('weather.clearSearch')}
              >
                ✕
              </button>
            ) : null}
            <button
              type="button"
              className={`usb-toggle-btn ${isDropdownOpen ? 'open' : ''}`}
              onClick={() => setIsDropdownOpen((v) => !v)}
              title={t('weather.openLocations')}
              aria-label={t('weather.openLocations')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Dropdown danh sách gợi ý 7 địa điểm & kết quả tìm kiếm */}
          {isDropdownOpen && (
            <div className="unified-dropdown-menu" role="listbox">
              {/* Nhóm 1: 7 Địa điểm theo dõi */}
              <div className="dropdown-group">
                <div className="dropdown-group-header">
                  <span>📍 {isEn ? '7 MONITORED CITIES' : '7 ĐỊA ĐIỂM THEO DÕI'}</span>
                  <span className="group-badge">{isEn ? 'Default' : 'Mặc định'}</span>
                </div>
                <div className="preset-chips-grid">
                  {filteredPresets.map((item) => {
                    const isSelected = item === location && !customCoords;
                    return (
                      <button
                        key={item}
                        type="button"
                        className={`preset-chip-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => handleSelectPreset(item)}
                      >
                        <span className="chip-pin">📍</span>
                        <span className="chip-name">{item}</span>
                        {isSelected && <span className="chip-check"></span>}
                      </button>
                    );
                  })}
                  {filteredPresets.length === 0 && (
                    <div className="no-preset-match">{isEn ? 'No monitored city matches your search.' : 'Không có thành phố theo dõi nào khớp từ khóa.'}</div>
                  )}
                </div>
              </div>

              {/* Nhóm 2: Kết quả tìm kiếm tự do Nominatim khi gõ */}
              {searchText.trim().length >= 2 && (
                <div className="dropdown-group dropdown-group--online">
                  <div className="dropdown-group-header">
                    <span>🌐 {isEn ? 'EXTENDED SEARCH RESULTS' : 'KẾT QUẢ TÌM KIẾM MỞ RỘNG'}</span>
                    {searching && <span className="searching-spinner">{isEn ? '⟳ Searching...' : '⟳ Đang tìm...'}</span>}
                  </div>
                  {suggestions.length > 0 ? (
                    <div className="suggestions-list">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          className="suggestion-row"
                          onClick={() => selectSuggestion(s)}
                        >
                          <span className="sug-icon">🗺️</span>
                          <div className="sug-content">
                            <span className="sug-title">{s.title || s.label}</span>
                            {s.subtitle && <span className="sug-sub">{s.subtitle}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : !searching ? (
                    <div className="no-suggestions">{isEn ? `No location found matching "${searchText}". Try another keyword or use the Map.` : `Không tìm thấy địa điểm "${searchText}". Thử từ khóa khác hoặc dùng Bản đồ.`}</div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nút GPS với Tooltip hover */}
        <div className="tooltip-container">
          <button
            className={`search-chip gps-btn${gpsLoading ? ' loading' : ''}`}
            type="button"
            onClick={handleGps}
            disabled={gpsLoading || loading}
            aria-label={isEn ? 'Use current GPS location' : 'Dùng GPS vị trí hiện tại'}
          >
            {gpsLoading ? <span className="btn-spinner">⟳</span> : '📍'}
          </button>
          <div className="custom-tooltip" role="tooltip">
            <div className="tooltip-title">📍 {isEn ? 'Current Location (GPS)' : 'Vị trí hiện tại (GPS)'}</div>
            <div className="tooltip-desc">
              {gpsLabel
                ? (isEn ? `Viewing: ${gpsLabel}. Click to relocate.` : `Đang xem: ${gpsLabel}. Nhấp để định vị lại.`)
                : (isEn ? 'Get device GPS coordinates to view local weather.' : 'Lấy tọa độ GPS thiết bị để xem thời tiết nơi bạn đang đứng.')}
            </div>
          </div>
        </div>

        {/* Nút Bản đồ với Tooltip hover */}
        <div className="tooltip-container">
          <button
            className={`search-chip map-btn${showMapModal ? ' active' : ''}`}
            type="button"
            onClick={() => setShowMapModal(true)}
            aria-label={isEn ? 'Open interactive map' : 'Mở bản đồ tương tác'}
          >
            🗺️
          </button>
          <div className="custom-tooltip" role="tooltip">
            <div className="tooltip-title">🗺️ {isEn ? 'Interactive Map' : 'Bản đồ tương tác'}</div>
            <div className="tooltip-desc">
              {isEn ? 'Open full-screen map, click any point to view weather.' : 'Mở bản đồ toàn màn hình, nhấp chọn bất kỳ điểm nào để xem thời tiết.'}
            </div>
          </div>
        </div>

        {/* Nút Làm mới với Tooltip hover */}
        <div className="tooltip-container">
          <button
            className="search-chip refresh-btn"
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            aria-label={isEn ? 'Refresh weather data' : 'Làm mới dữ liệu thời tiết'}
          >
            {loading ? <span className="btn-spinner">⟳</span> : '↺'}
          </button>
          <div className="custom-tooltip" role="tooltip">
            <div className="tooltip-title">↺ {isEn ? 'Refresh Data' : 'Làm mới dữ liệu'}</div>
            <div className="tooltip-desc">{isEn ? 'Update latest weather from Open-Meteo.' : 'Cập nhật thời tiết mới nhất từ Open-Meteo.'}</div>
          </div>
        </div>
      </div>

      {/* ── Modal Bản đồ tương tác toàn màn hình ─────── */}
      <WeatherMapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        currentCoords={customCoords || { lat: mapLat, lon: mapLon }}
        currentLabel={displayLabel}
        monitoredCities={MONITORED_CITIES}
        onSelectLocation={handleSelectLocationFromMap}
      />

      {/* ── Cảnh báo ───────────────────────────────── */}
      {alerts.length > 0 && !loading && (
        <div className="weather-alerts" role="region" aria-label="Cảnh báo thời tiết">
          {alerts.map((a, i) => (
            <div key={i} className={`alert-item alert-${a.type}`}>
              <span className="alert-msg">{a.message}</span>
              <span className="alert-time">{a.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────── */}
      <div className="weather-tabs" role="tablist">
        {['current','hourly','forecast'].map(tab => (
          <button key={tab} type="button" role="tab"
            aria-selected={activeTab === tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {tab === 'current' ? (isEn ? '🌡️ Current' : '🌡️ Hiện tại') :
             tab === 'hourly'  ? (isEn ? '⏱️ Hourly' : '⏱️ Theo giờ') : (isEn ? '📅 14 Days' : '📅 14 ngày')}
          </button>
        ))}
      </div>

      <main className="weather-main">
        {loading && (
          <div className="weather-loading">
            <div className="loading-spinner" />
            <p>{isEn ? `Loading weather for ${displayLabel}…` : `Đang tải thời tiết ${displayLabel}…`}</p>
          </div>
        )}
        {!loading && error && (
          <div className="weather-error" role="alert">
            <span>⚠️ {error}</span>
            <button type="button" onClick={handleRefresh} className="retry-btn">{isEn ? 'Retry' : 'Thử lại'}</button>
          </div>
        )}

        {!loading && !error && weather && (
          <>
            {/* ══ Hiện tại ══════════════════════════ */}
            {activeTab === 'current' && (
              <>
                <section className="current-card">
                  <div className="card-title">
                    <h2>{displayLabel}</h2>
                    <div className="time">{formatCurrentTime(cur.time, lang)}</div>
                    <div className="weather-status">{cur.icon} {cur.condition}</div>
                  </div>
                  <div className="temp-block">
                    <div className="temp-value">
                      {cur.temperature != null ? Math.round(cur.temperature) : '—'}
                    </div>
                    <div className="temp-unit">
                      °C
                      {cur.feels_like != null && (
                        <div style={{fontSize:'0.75rem',fontWeight:400,marginTop:4,color:'#5f7285'}}>
                          {isEn ? 'Feels like ' : 'Cảm giác '}{Math.round(cur.feels_like)}°
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="metric-row">
                    {[
                      { icon:'◔', label: isEn ? 'Humidity' : 'Độ ẩm',       val: cur.humidity != null ? `${cur.humidity}%` : '—' },
                      { icon:'↗', label: `${isEn ? 'Wind' : 'Gió'} ${windDir(cur.wind_dir)}`, val: cur.wind_speed != null ? `${cur.wind_speed} km/h` : '—' },
                      { icon:'◌', label: isEn ? 'Pressure' : 'Áp suất',      val: cur.pressure != null ? `${Math.round(cur.pressure)} hPa` : '—' },
                      { icon:'✦', label: isEn ? 'UV Index' : 'Chỉ số UV',    val: uvLabel(cur.uv_index, lang) },
                      { icon:'☁', label: isEn ? 'Cloud Cover' : 'Mây che phủ',  val: cur.cloud_cover != null ? `${cur.cloud_cover}%` : '—' },
                      { icon:'🌧', label: isEn ? 'Precipitation' : 'Mưa',          val: cur.precipitation != null ? `${cur.precipitation} mm` : '—' },
                    ].map(m => (
                      <div key={m.label} className="metric-box">
                        <div className="metric-icon">{m.icon}</div>
                        <div className="metric-label">{m.label}</div>
                        <div className="metric-value" style={{fontSize:'1.1rem'}}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {hourly.length > 0 && (
                  <section className="forecast-section">
                    <h3 className="forecast-header">{isEn ? '📈 24h Temperature Chart' : '📈 Biểu đồ nhiệt độ 24h'}</h3>
                    <TempChart hourly={hourly} />
                  </section>
                )}

                {hourly.length > 0 && (
                  <section className="forecast-section">
                    <h3 className="forecast-header">{isEn ? '⏱️ Next 6 Hours' : '⏱️ 6 giờ tới'}</h3>
                    <div className="forecast-grid">
                      {hourly.slice(0,6).map((h,i) => (
                        <div key={i} className="forecast-card">
                          <div className="time">{h.time}</div>
                          <div className="icon">{h.icon}</div>
                          <div className="temp">{h.temp != null ? `${Math.round(h.temp)}°C` : '—'}</div>
                          <div className="meta">{h.wind != null ? `${h.wind} km/h` : ''}</div>
                          {h.rain > 0 && <div className="meta" style={{color:'#4a9cc5'}}>🌧 {h.rain}mm</div>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* ══ Theo giờ ════════════════════════ */}
            {activeTab === 'hourly' && (
              <section className="forecast-section">
                <h3 className="forecast-header">{isEn ? `⏱️ 24h Details — ${displayLabel}` : `⏱️ Chi tiết 24h — ${displayLabel}`}</h3>
                <TempChart hourly={hourly} />
                <div className="hourly-table-wrap">
                  <table className="hourly-table">
                    <thead>
                      <tr>
                        <th>{isEn ? 'Time' : 'Giờ'}</th>
                        <th>{isEn ? 'Weather' : 'Thời tiết'}</th>
                        <th>{isEn ? 'Temp' : 'Nhiệt độ'}</th>
                        <th>{isEn ? 'Humidity' : 'Độ ẩm'}</th>
                        <th>{isEn ? 'Wind' : 'Gió'}</th>
                        <th>{isEn ? 'Rain' : 'Mưa'}</th>
                        <th>{isEn ? 'Clouds' : 'Mây'}</th>
                        <th>{isEn ? 'Visibility' : 'Tầm nhìn'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hourly.map((h, i) => (
                        <tr key={i} className={i === 0 ? 'hourly-row--now' : ''}>
                          <td className="col-time">
                            {h.time}
                            {i === 0 && <span className="now-badge">Now</span>}
                          </td>
                          <td>{h.icon} {h.condition}</td>
                          <td className="col-temp">{h.temp != null ? `${Math.round(h.temp)}°C` : '—'}</td>
                          <td>{h.humidity != null ? `${h.humidity}%` : '—'}</td>
                          <td>{h.wind != null ? `${h.wind}` : '—'}{h.wind_dir != null && <span className="wind-dir"> {windDir(h.wind_dir)}</span>}</td>
                          <td className={h.rain > 0 ? 'col-rain' : ''}>{h.rain != null ? (h.rain > 0 ? `${h.rain}mm` : '—') : '—'}</td>
                          <td>
                            {h.cloud != null ? (
                              <div className="cloud-bar-wrap">
                                <div className="cloud-bar" style={{width:`${h.cloud}%`}}/>
                                <span>{h.cloud}%</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td>{h.visibility != null ? `${h.visibility} km` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ══ 14 ngày ═════════════════════════ */}
            {activeTab === 'forecast' && (
              <section className="forecast-section">
                <h3 className="forecast-header">{isEn ? `📅 14-Day Forecast — ${displayLabel}` : `📅 Dự báo 14 ngày — ${displayLabel}`}</h3>
                <div className="daily-forecast">
                  {daily.map(day => {
                    const isOpen = selectedDay === day.date;
                    const fill = day.temp_max != null
                      ? Math.round(((day.temp_max - 15) / 25) * 100) : 50;
                    return (
                      <div key={day.date} className={`daily-row-wrap ${isOpen ? 'daily-row-wrap--open':''}`}>
                        <button
                          className={`daily-row ${isOpen ? 'daily-row--active':''}`}
                          onClick={() => setSelectedDay(isOpen ? null : day.date)}
                          aria-expanded={isOpen}
                          aria-controls={`detail-${day.date}`}
                        >
                          <div className="day-name">
                            <span>{day.icon}</span>
                            <span>{day.day}</span>
                            <span className="day-date">{day.date_label}</span>
                          </div>
                          <div className="temp-bar">
                            <div className="temp-fill" style={{width:`${Math.max(10,Math.min(fill,95))}%`}}/>
                          </div>
                          <div className="day-row-right">
                            {day.pop != null && <span className="pop-badge">💧{day.pop}%</span>}
                            <div className="temp-text">{day.temp_label}</div>
                            <svg className={`chevron-icon ${isOpen?'chevron-icon--open':''}`}
                              width="14" height="14" viewBox="0 0 24 24"
                              fill="none" stroke="currentColor" strokeWidth="2.5"
                              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </div>
                        </button>
                        {isOpen && (
                          <div id={`detail-${day.date}`} className="daily-detail">
                            <p className="daily-detail-text">
                              {day.icon} {day.condition} — {day.temp_min != null ? Math.round(day.temp_min) : '?'}° đến {day.temp_max != null ? Math.round(day.temp_max) : '?'}°C
                            </p>
                            <div className="daily-detail-grid">
                              {[
                                [isEn ? 'Rain probability' : 'Xác suất mưa', day.pop != null ? `${day.pop}%` : '—'],
                                [isEn ? 'Rainfall' : 'Lượng mưa',          day.rain != null ? `${day.rain} mm` : '—'],
                                [isEn ? 'Max wind' : 'Gió max',            day.wind != null ? `${day.wind} km/h` : '—'],
                                [isEn ? 'UV Index' : 'Chỉ số UV',          day.uv ?? '—'],
                                [isEn ? 'Sunrise' : 'Bình minh',           day.sunrise || '—'],
                                [isEn ? 'Sunset' : 'Hoàng hôn',            day.sunset  || '—'],
                              ].map(([lbl, val]) => (
                                <div key={lbl} className="detail-item">
                                  <span className="detail-label">{lbl}</span>
                                  <span className="detail-val">{val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
