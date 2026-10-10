import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import './ListOfPlace.css';
import { useLanguage } from '../i18n/LanguageContext';

const API_BASE = 'http://localhost:5000';

// ---- Màu sắc theo statusType ----
const STATUS_COLORS = {
  danger:  { primary: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)' },
  success: { primary: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
  warning: { primary: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
};

// ---- Icon SVGs ----
const IconBrain = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.66A2.5 2.5 0 0 1 9.5 2z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.66A2.5 2.5 0 0 0 14.5 2z"/>
  </svg>
);

const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

// ---- Xuất file ----
function exportCSV(data) {
  const headers = ['STT', 'Địa điểm', 'Thời gian', 'AQI', 'Trạng thái'];
  const rows = data.map((d, i) => [i + 1, d.location, d.time, d.aqi, d.status]);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aeropulse-anomaly-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aeropulse-anomaly-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Skeleton card ----
function formatAnomalyTime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    return `${time} · Ngày ${date}`;
  } catch {
    return isoStr;
  }
}

function formatDateOnly(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return isoStr.slice(0, 10);
  }
}


// ---- Weather Loading — CSS animation cycle: Sun → Rain → Wind → Snow ----
function WeatherLoadingScene() {
  return (
    <div className="wl-scene" aria-hidden="true">

      {/* ========== SUN ========== */}
      <div className="wl-frame wl-frame--sun">
        <div className="wl-sun">
          <div className="wl-sun-core" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="wl-sun-ray" style={{ '--ray-i': i }} />
          ))}
        </div>
        <div className="wl-cloud wl-cloud--sun" />
      </div>

      {/* ========== RAIN ========== */}
      <div className="wl-frame wl-frame--rain">
        <div className="wl-cloud wl-cloud--dark wl-cloud--big" />
        <div className="wl-cloud wl-cloud--dark wl-cloud--small" />
        {[...Array(14)].map((_, i) => (
          <div key={i} className="wl-drop" style={{ '--drop-i': i }} />
        ))}
      </div>

      {/* ========== WIND ========== */}
      <div className="wl-frame wl-frame--wind">
        <div className="wl-cloud wl-cloud--wind" />
        {[0,1,2,3,4].map(i => (
          <div key={i} className="wl-wind-line" style={{ '--wind-i': i }} />
        ))}
      </div>

      {/* ========== SNOW ========== */}
      <div className="wl-frame wl-frame--snow">
        <div className="wl-cloud wl-cloud--snow" />
        {[...Array(16)].map((_, i) => (
          <div key={i} className="wl-flake" style={{ '--flake-i': i }}>❄</div>
        ))}
      </div>

    </div>
  )
}

// ---- Loading state (AI đang phân tích — có thể mất 1-2 phút) ----
function LoadingState({ t }) {
  return (
    <div className="anomaly-loading" role="status" aria-live="polite">
      <div className="anomaly-loading-inner">
        {/* Weather animation */}
        <WeatherLoadingScene />

        <p className="anomaly-loading-title">{t('anomaly.loadingTitle')}</p>
        <p className="anomaly-loading-hint">
          {t('anomaly.loadingHint1')}<br />
          {t('anomaly.loadingHint2')}
        </p>
      </div>
    </div>
  );
}


// ---- Error state ----
function ErrorState({ message, onRetry, t }) {
  return (
    <div className="anomaly-error" role="alert">
      <span className="anomaly-error-icon">⚠</span>
      <p>{t('anomaly.loadFailed')} <strong>{message}</strong></p>
      <button className="btn-retry-anomaly" onClick={onRetry}>
        <IconRefresh /> {t('dashboard.retry')}
      </button>
    </div>
  );
}

// ---- Empty state ----
function EmptyAnomalies({ t }) {
  return (
    <div className="anomaly-empty">
      <span>✅</span>
      <p>{t('anomaly.noAnomalies')}</p>
    </div>
  );
}

// ---- Component chính ----
export default function ListOfPlace() {
  const { lang, t } = useLanguage();
  const [aqiData, setAqiData]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [exportOpen, setExportOpen]   = useState(false);
  const [retryLoadingId, setRetryLoadingId] = useState(null);

  const getStatusText = (statusType, defaultStatus) => {
    if (lang === 'en') {
      if (statusType === 'danger') return 'Hazardous';
      if (statusType === 'warning') return 'Warning';
      if (statusType === 'success') return 'Normal';
    }
    return defaultStatus;
  };

  const fetchAnomalies = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    // Timeout 3 phút — AI generation có thể mất lâu
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3 * 60 * 1000);

    try {
      const url = forceRefresh ? `${API_BASE}/api/anomalies?refresh=true` : `${API_BASE}/api/anomalies`;
      const res = await fetch(url, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Lỗi server: HTTP ${res.status}`);
      const data = await res.json();
      setAqiData(data);
      if (data.length > 0) setActiveReport(data[0]);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Quá thời gian chờ (3 phút). Server có thể đang bận — thử lại sau.');
      } else {
        setError(err.message);
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  // ---- Retry AI Report ----
  const handleRetryReport = async (anomaly) => {
    if (retryLoadingId) return;
    setRetryLoadingId(anomaly.id);
    try {
      const res = await fetch(`${API_BASE}/api/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(anomaly),
      });
      if (!res.ok) throw new Error(`Lỗi server: HTTP ${res.status}`);
      const data = await res.json();
      
      if (data.report) {
        // Cập nhật lại aqiData
        setAqiData((prev) => prev.map(item => 
          item.id === anomaly.id ? { ...item, report: data.report } : item
        ));
        // Cập nhật activeReport nếu đang mở
        if (activeReport?.id === anomaly.id) {
          setActiveReport(prev => ({ ...prev, report: data.report }));
        }
      }
    } catch (err) {
      alert(`Không thể tải lại báo cáo: ${err.message}`);
    } finally {
      setRetryLoadingId(null);
    }
  };

  // ---- Render states ----
  if (loading) return <LoadingState t={t} />;
  if (error)   return <ErrorState message={error} onRetry={fetchAnomalies} t={t} />;
  if (aqiData.length === 0) return <EmptyAnomalies t={t} />;

  const activeColor = STATUS_COLORS[activeReport?.statusType] ?? STATUS_COLORS.warning;

  return (
    <div className="list-page-content">
      {/* ---- Header toolbar ---- */}
      <div className="list-toolbar">
        <h2 className="list-title">
          {t('anomaly.title')}
          <span className="list-count">{aqiData.length}</span>
        </h2>

        <div className="list-toolbar-actions">
          {/* Nút Làm mới */}
          <button
            type="button"
            className="btn-refresh-list"
            onClick={() => fetchAnomalies(true)}
            disabled={loading}
            title={t('anomaly.refresh')}
          >
            <IconRefresh />
            <span>{t('anomaly.refresh')}</span>
          </button>

          {/* Nút xuất file */}
          <div className="export-wrapper">
          <button
            id="export-toggle-btn"
            className="btn-export"
            aria-haspopup="true"
            aria-expanded={exportOpen}
            onClick={() => setExportOpen((v) => !v)}
          >
            <IconDownload />
            <span>{t('anomaly.export')}</span>
            <IconChevronDown />
          </button>
          {exportOpen && (
            <div className="export-menu" role="menu">
              <button
                role="menuitem"
                className="export-item"
                onClick={() => { exportCSV(aqiData); setExportOpen(false); }}
              >
                {t('anomaly.exportCsv')}
              </button>
              <button
                role="menuitem"
                className="export-item"
                onClick={() => { exportJSON(aqiData); setExportOpen(false); }}
              >
                {t('anomaly.exportJson')}
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* ---- 2-column grid ---- */}
      <div className="content-grid">

        {/* Cột trái: Danh sách cards */}
        <div className="list-column">
          <div className="aqi-cards-list">
            {aqiData.map((item) => {
              const isActive = activeReport?.id === item.id;
              const color = STATUS_COLORS[item.statusType] ?? STATUS_COLORS.warning;
              const statusText = getStatusText(item.statusType, item.status);
              return (
                <button
                  key={item.id}
                  className={`aqi-card ${item.statusType} ${isActive ? 'aqi-card--active' : ''}`}
                  style={isActive ? {
                    '--card-accent': color.primary,
                    '--card-accent-bg': color.bg,
                    '--card-accent-border': color.border,
                  } : {}}
                  onClick={() => setActiveReport(item)}
                  aria-pressed={isActive}
                  aria-label={`${item.location} – AQI ${item.aqi}`}
                >
                  <div className="card-header">
                    <div className="location-info">
                      <h3>{item.location}</h3>
                      <p>{formatAnomalyTime(item.time)}</p>
                    </div>
                    <div className="aqi-score-container">
                      <span className={`aqi-score ${item.statusType}`}>{item.aqi}</span>
                      <span className={`badge ${item.statusType}`}>{statusText}</span>
                    </div>
                  </div>
                  <p className="card-desc">{item.description}</p>
                  {isActive && (
                    <div className="card-active-indicator" aria-hidden="true">
                      {t('anomaly.viewingReport')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cột phải: AI báo cáo */}
        <div className="ai-column">
          <h2 className="section-title">{t('anomaly.aiPanelTitle')}</h2>

          {/* Tab bar */}
          <div className="ai-tabs" role="tablist" aria-label="Chọn khu vực báo cáo">
            {aqiData.map((item) => {
              const isActive = activeReport?.id === item.id;
              const color = STATUS_COLORS[item.statusType] ?? STATUS_COLORS.warning;
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={isActive}
                  className={`ai-tab ${isActive ? 'ai-tab--active' : ''}`}
                  style={isActive ? {
                    '--tab-color': color.primary,
                    '--tab-bg': color.bg,
                    '--tab-border': color.border,
                  } : {}}
                  onClick={() => setActiveReport(item)}
                  title={item.location}
                >
                  <span
                    className="ai-tab-dot"
                    style={{ background: color.primary }}
                    aria-hidden="true"
                  />
                  <span className="ai-tab-label">{item.location.split(' - ')[0]}</span>
                  <span
                    className={`ai-tab-badge ${item.statusType}`}
                    style={isActive ? { background: color.bg, color: color.primary } : {}}
                  >
                    {item.aqi}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Panel báo cáo AI */}
          {activeReport && (
            <div
              className="ai-analysis-panel"
              role="tabpanel"
              style={{
                '--panel-color': activeColor.primary,
                '--panel-bg': activeColor.bg,
                '--panel-border': activeColor.border,
              }}
            >
              {/* Header */}
              <div className="ai-panel-header">
                <div className="ai-header">
                  <IconBrain />
                  <span>{t('anomaly.aiReportFor')}{activeReport.location}</span>
                </div>
                <span className={`badge ${activeReport.statusType}`}>
                  {getStatusText(activeReport.statusType, activeReport.status)}
                </span>
              </div>

              {/* AQI nổi bật */}
              <div className="ai-aqi-highlight">
                <span className="ai-aqi-number" style={{ color: activeColor.primary }}>
                  {activeReport.aqi}
                </span>
                <div className="ai-aqi-meta">
                  <span className="ai-aqi-label">AQI</span>
                  <span className="ai-aqi-time">{formatDateOnly(activeReport.time)}</span>
                  {activeReport.pm25 != null && (
                    <span className="ai-aqi-time">PM2.5: {activeReport.pm25.toFixed(1)} µg/m³</span>
                  )}
                </div>
              </div>

              {/* Nội dung phân tích */}
              <div className="ai-content">
                {retryLoadingId === activeReport.id ? (
                  <div className="ai-retry-loading">
                    <div className="spinner-ring" style={{ width: '24px', height: '24px', borderWidth: '2px' }}></div>
                    <span>{t('anomaly.generatingAi')}</span>
                  </div>
                ) : (
                  <div className="markdown-body">
                    <ReactMarkdown>{activeReport.report}</ReactMarkdown>
                  </div>
                )}
                
                {/* Nút retry nếu báo cáo là fallback text */}
                {!retryLoadingId && activeReport.report && activeReport.report.includes('Báo cáo AI tạm thời không khả dụng') && (
                  <div className="ai-retry-action">
                    <button 
                      className="btn-retry-ai"
                      onClick={() => handleRetryReport(activeReport)}
                    >
                      {t('anomaly.retryAi')}
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="ai-footer">
                <span className="ai-disclaimer">
                  {t('anomaly.disclaimer')}
                </span>
                <button
                  className="btn-close-ai"
                  onClick={() => setActiveReport(aqiData[0])}
                  aria-label="Đóng báo cáo"
                >
                  <IconX />
                  <span>{t('anomaly.close')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}