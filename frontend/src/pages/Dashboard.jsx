import React, { useState, useMemo, useRef, useEffect } from 'react';
import './Dashboard.css';
import ListOfPlace from './ListOfPlace';
import { useDashboardData, useLocations, useDataRange, LOCATION_COLORS } from '../hooks/useDashboardData';

import { useLanguage } from '../i18n/LanguageContext';

const SVG_W = 1000;
const SVG_H = 310;

// Trả về chuỗi YYYY-MM-DD theo giờ địa phương
const getLocalYYYYMMDD = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Lấy ngày hôm nay
const getToday = () => getLocalYYYYMMDD(new Date());

// Lấy ngày cách đây N ngày (ví dụ 28 hoặc 30 ngày)
const getPastDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getLocalYYYYMMDD(d);
};

/** Tính toạ độ SVG từ giá trị thực */
function toY(value, maxVal) {
  const clamped = Math.min(Math.max(value ?? 0, 0), maxVal);
  return SVG_H - (clamped / maxVal) * SVG_H;
}

/** Build polyline points string từ mảng {date, value} */
function buildPoints(rows, slug, maxVal) {
  const valid = rows.filter((r) => r[slug] != null);
  if (valid.length < 2) return null;
  return valid
    .map((r, i) => {
      const x = (i / (valid.length - 1)) * SVG_W;
      const y = toY(r[slug], maxVal);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// ---- Spinner ----
function Spinner({ t }) {
  return (
    <div className="chart-spinner" aria-label={t('dashboard.loading')}>
      <div className="spinner-ring" />
      <span>{t('dashboard.loading')}</span>
    </div>
  );
}

// ---- Error banner ----
function ErrorBanner({ message, onRetry, t }) {
  return (
    <div className="chart-error" role="alert">
      <span>⚠ {t('dashboard.loadError')} {message}</span>
      <button onClick={onRetry} className="btn-retry">{t('dashboard.retry')}</button>
    </div>
  );
}

// ---- Empty state ----
function EmptyState({ range, onApplyRange, t, lang }) {
  const fmt = (d) =>
    d
      ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
          .format(new Date(`${d}T00:00:00`))
      : null;

  if (range && range.min_date && range.max_date) {
    return (
      <div className="chart-empty">
        <div className="chart-empty-content">
          <span className="chart-empty-icon">📅</span>
          <p className="chart-empty-title">{t('dashboard.noData')}</p>
          <p className="chart-empty-hint">
            {t('dashboard.dataAvailableFrom')} <strong>{range.label || range.location}</strong> {t('dashboard.hasFrom')}{' '}
            <strong>{fmt(range.min_date)}</strong> {t('dashboard.to')}{' '}
            <strong>{fmt(range.max_date)}</strong>.
          </p>
          {onApplyRange && (
            <button
              className="btn-apply-range"
              onClick={() => onApplyRange(range.min_date, range.max_date)}
            >
              {t('dashboard.applyRange')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="chart-empty">
      <span>{t('dashboard.noData')}</span>
    </div>
  );
}

// =============================================
export default function Dashboard() {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab]       = useState('chart');
  // Multi-select: mảng slug đang chọn, rỗng = tất cả
  const [startDate, setStartDate]       = useState(() => getPastDate(30));
  const [endDate, setEndDate]           = useState(() => getToday());
  const [activeMetric, setActiveMetric] = useState('aqi');
  const [pendingStart, setPendingStart] = useState(() => getPastDate(30));
  const [pendingEnd, setPendingEnd]     = useState(() => getToday());
  const [selectedSlugs, setSelectedSlugs] = useState([]);
  const [pendingSlugs, setPendingSlugs] = useState([]);
  const [selectedLine, setSelectedLine]   = useState(null);

  // Helper date format theo ngôn ngữ
  const formatDateLocale = (dateStr) => {
    if (!dateStr) return '';
    const locale = lang === 'en' ? 'en-US' : 'vi-VN';
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' })
      .format(new Date(`${dateStr}T00:00:00`));
  };

  // Metric config động theo ngôn ngữ
  const METRIC_CONFIG = useMemo(() => ({
    aqi:  { label: 'AQI', max: 300, yLabels: ['0', `50 · ${t('dashboard.good')}`, `100 · ${t('dashboard.moderate')}`, `150 · ${t('dashboard.unhealthySG')}`, `200 · ${t('dashboard.unhealthy')}`, `300 · ${t('dashboard.hazardous')}`] },
    pm25: { label: 'PM2.5 (µg/m³)', max: 200, yLabels: ['0', '40', '80', '120', '160', '200'] },
    pm10: { label: 'PM10 (µg/m³)',  max: 300, yLabels: ['0', '60', '120', '180', '240', '300'] },
  }), [t]);

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch locations từ BE
  const apiLocations = useLocations();
  const dataRange    = useDataRange(
    pendingSlugs.length === 1 ? pendingSlugs[0] : 'all'
  );
  const locations = apiLocations.length > 0 ? apiLocations : [
    { value: 'hanoi',       label: 'Hà Nội' },
    { value: 'da-nang',     label: 'Đà Nẵng' },
    { value: 'hue',         label: 'Huế' },
    { value: 'thai-nguyen', label: 'Thái Nguyên' },
    { value: 'quang-ninh',  label: 'Quảng Ninh' },
    { value: 'ha-tinh',     label: 'Hà Tĩnh' },
    { value: 'viet-tri',    label: 'Việt Trì' },
  ];

  // Fetch chart data — truyền mảng slugs
  const { data, loading, error, refetch } = useDashboardData({
    locations: selectedSlugs,   // [] = tất cả
    startDate,
    endDate,
    metric: activeMetric,
  });

  const metricCfg = METRIC_CONFIG[activeMetric];
  const rows = data?.rows ?? [];

  // Label hiển thị cho header chart
  const selectedLocationLabel = selectedSlugs.length === 0
    ? t('dashboard.allLocations')
    : selectedSlugs.length === 1
      ? locations.find((l) => l.value === selectedSlugs[0])?.label ?? selectedSlugs[0]
      : `${selectedSlugs.length} ${t('dashboard.locationsSelected')}`;

  // Slugs cần vẽ line
  const activeSlugs = useMemo(() => {
    if (!data) return [];
    return data.locations ?? [];
  }, [data]);

  // Bật/tắt làm sáng đường khi ấn vào địa điểm
  const toggleSelectLine = (slug) => {
    setSelectedLine((prev) => (prev === slug ? null : slug));
  };

  // Toggle 1 slug
  const toggleSlug = (slug) => {
    setPendingSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  // Chọn tất cả / bỏ chọn tất cả
  const toggleAll = () => {
    setPendingSlugs((prev) => (prev.length === locations.length ? [] : locations.map((l) => l.value)));
  };

  // Apply bộ lọc
  const handleApply = () => {
    setSelectedSlugs(pendingSlugs);
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
  };

  // Empty state gợi ý khoảng ngày
  const handleApplyRange = (min, max) => {
    setPendingStart(min);
    setPendingEnd(max);
    setStartDate(min);
    setEndDate(max);
  };

  return (
    <div className="aeropulse-container">
      <main className="main-content">

        {/* ---- Bộ lọc ---- */}
        <section className="filter-section">

          {/* Location multi-select dropdown */}
          <div className="input-group input-group--wide" ref={dropdownRef}>
            <label>{t('dashboard.location')}</label>
            <div className="multi-select-container">
              <button 
                type="button"
                className={`multi-select-trigger ${isDropdownOpen ? 'open' : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span>
                  {pendingSlugs.length === 0 ? t('dashboard.allLocations') : `${pendingSlugs.length} ${t('dashboard.locationsSelected')}`}
                </span>
                <span className="dropdown-arrow">▼</span>
              </button>

              {isDropdownOpen && (
                <div className="multi-select-dropdown">
                  <button
                    type="button"
                    className="multi-select-item"
                    onClick={toggleAll}
                  >
                    <div className="multi-select-checkbox">
                      {pendingSlugs.length === 0 && '✓'}
                    </div>
                    <strong>{t('dashboard.allLocations')}</strong>
                  </button>
                  
                  {locations.map((loc) => {
                    const active = pendingSlugs.includes(loc.value);
                    const color  = LOCATION_COLORS[loc.value] ?? '#888';
                    return (
                      <button
                        key={loc.value}
                        type="button"
                        className="multi-select-item"
                        onClick={() => toggleSlug(loc.value)}
                      >
                        <div 
                          className={`multi-select-checkbox ${active ? 'active' : ''}`}
                          style={active ? { background: color, borderColor: color } : {}}
                        >
                          {active && '✓'}
                        </div>
                        {loc.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Khoảng thời gian */}
          <div className="input-group">
            <label>{t('dashboard.timeRange')}</label>
            <div className="date-range">
              <input
                aria-label="Ngày bắt đầu"
                type="date"
                value={pendingStart}
                max={pendingEnd}
                onChange={(e) => setPendingStart(e.target.value)}
              />
              <span aria-hidden="true">{t('dashboard.to')}</span>
              <input
                aria-label="Ngày kết thúc"
                type="date"
                value={pendingEnd}
                min={pendingStart}
                onChange={(e) => setPendingEnd(e.target.value)}
              />
            </div>
          </div>

          <button className="btn-apply" type="button" onClick={handleApply}>
            {t('dashboard.apply')}
          </button>
        </section>

        {/* ---- Tabs ---- */}
        <div className="view-toggle-container">
          <div className="view-toggle">
            <button
              className={activeTab === 'chart' ? 'active' : ''}
              onClick={() => setActiveTab('chart')}
            >
              {t('dashboard.chartTab')}
            </button>
            <button
              className={activeTab === 'list' ? 'active' : ''}
              onClick={() => setActiveTab('list')}
            >
              {t('dashboard.anomalyTab')}
            </button>
          </div>
        </div>

        {/* ---- Tab content ---- */}
        {activeTab === 'chart' ? (
          <section className="chart-section">

            {/* Metric pills */}
            <div className="chart-type-pills">
              {(['aqi', 'pm25', 'pm10']).map((m) => (
                <button
                  key={m}
                  className={activeMetric === m ? 'active' : ''}
                  onClick={() => setActiveMetric(m)}
                >
                  {METRIC_CONFIG[m].label}
                </button>
              ))}
            </div>

            {/* Chart header */}
            <div className="chart-header-row">
              <div className="chart-title">
                <h3>{t('dashboard.metricOverTime', { metric: metricCfg.label })}</h3>
                <p>{selectedLocationLabel} · {formatDateLocale(startDate)} – {formatDateLocale(endDate)}</p>
              </div>

              {/* Legend tương tác — chỉ hiện nếu có data */}
              {activeSlugs.length > 0 && (
                <div className="chart-legend" role="toolbar" aria-label="Danh sách địa điểm trên biểu đồ">
                  {activeSlugs.map((slug) => {
                    const isSelected = slug === selectedLine;
                    const isDimmed = selectedLine && !isSelected;
                    const color = LOCATION_COLORS[slug] ?? '#888';
                    const label = data?.location_labels?.[slug] ?? slug;

                    return (
                      <button
                        key={slug}
                        type="button"
                        className={`legend-item ${isSelected ? 'legend-item--selected' : ''} ${isDimmed ? 'legend-item--dimmed' : ''}`}
                        style={{
                          borderColor: isSelected ? color : 'transparent',
                        }}
                        onClick={() => toggleSelectLine(slug)}
                        title={`Nhấp để ${isSelected ? 'bỏ chọn' : 'làm sáng'} đường ${label}`}
                      >
                        <span
                          className="dot"
                          style={{ background: color }}
                        />
                        <span className="legend-label">{label}</span>
                        {isSelected && <span className="legend-selected-badge">✓ {t('dashboard.active')}</span>}
                      </button>
                    );
                  })}

                  {selectedLine && (
                    <button
                      type="button"
                      className="legend-reset-btn"
                      onClick={() => setSelectedLine(null)}
                      title="Bỏ chọn để hiện đều tất cả các đường"
                    >
                      {t('dashboard.viewAll')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Banner hiển thị khi có địa điểm được ấn chọn */}
            {selectedLine && (
              <div
                className="chart-selected-banner"
                style={{
                  borderColor: LOCATION_COLORS[selectedLine] ?? '#1b64b6',
                }}
              >
                <span
                  className="selected-dot"
                  style={{ background: LOCATION_COLORS[selectedLine] ?? '#1b64b6' }}
                />
                <span className="selected-name">
                  {data?.location_labels?.[selectedLine] ?? selectedLine}
                </span>
                {rows.length > 0 && (() => {
                  const last = [...rows].reverse().find((r) => r[selectedLine] != null);
                  return last && last[selectedLine] != null ? (
                    <span className="selected-val">
                      · {t('dashboard.latest')} <strong>{Math.round(last[selectedLine])} {metricCfg.label.split(' ')[0]}</strong>
                    </span>
                  ) : null;
                })()}
                <button
                  type="button"
                  className="selected-close-btn"
                  onClick={() => setSelectedLine(null)}
                  title="Bỏ chọn"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Chart area */}
            <div className="chart-area">
              {/* Trục Y */}
              <div className="y-axis">
                {metricCfg.yLabels.map((lbl) => (
                  <span key={lbl}>{lbl}</span>
                ))}
              </div>

              {/* Lưới ngang */}
              <div className="grid-lines">
                {metricCfg.yLabels.map((lbl) => (
                  <div key={lbl} className="grid-line" />
                ))}
              </div>

              {/* Nội dung chart */}
              {loading ? (
                <Spinner t={t} />
              ) : error ? (
                <ErrorBanner message={error} onRetry={refetch} t={t} />
              ) : rows.length === 0 ? (
                <EmptyState range={dataRange} onApplyRange={handleApplyRange} t={t} lang={lang} />
              ) : (
                <svg
                  className={`svg-layer ${selectedLine ? 'has-selection' : ''}`}
                  preserveAspectRatio="none"
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  aria-label={`Biểu đồ ${metricCfg.label}`}
                  onClick={(e) => {
                    if (e.target.tagName === 'svg') setSelectedLine(null);
                  }}
                >
                  {activeSlugs.map((slug) => {
                    const isSelected = slug === selectedLine;
                    const isDimmed = selectedLine && !isSelected;
                    const color = LOCATION_COLORS[slug] ?? '#888';
                    const pts = buildPoints(rows, slug, metricCfg.max);
                    if (!pts) return null;

                    const lastRow = [...rows].reverse().find((r) => r[slug] != null);
                    const lastX = SVG_W;
                    const lastY = lastRow ? toY(lastRow[slug], metricCfg.max) : 0;

                    return (
                      <g
                        key={slug}
                        className={`chart-line-group ${isSelected ? 'is-selected' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                        onClick={() => toggleSelectLine(slug)}
                      >
                        {/* Đường trong suốt mở rộng vùng click/hover */}
                        <polyline
                          points={pts}
                          fill="none"
                          stroke="transparent"
                          strokeWidth="18"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          style={{ cursor: 'pointer' }}
                        />

                        {/* Đường hiển thị chính */}
                        <polyline
                          points={pts}
                          fill="none"
                          stroke={color}
                          strokeWidth={isSelected ? 3.6 : 2.4}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          className="line-main"
                          style={{ pointerEvents: 'none' }}
                        />

                        {/* Điểm cuối */}
                        <circle
                          cx={lastX}
                          cy={lastY}
                          r={isSelected ? 5.5 : 4}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth={isSelected ? 2 : 1}
                          className="line-dot"
                          style={{ cursor: 'pointer' }}
                        />
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Trục X — ngày */}
              {rows.length > 0 && (
                <div className="x-axis">
                  {rows
                    .filter((_, i) => {
                      // Hiện tối đa 8 nhãn trục X
                      const step = Math.max(1, Math.floor(rows.length / 7));
                      return i % step === 0 || i === rows.length - 1;
                    })
                    .map((r) => (
                      <span key={r.date}>{formatDateLocale(r.date)}</span>
                    ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <ListOfPlace />
        )}
      </main>
    </div>
  );
}