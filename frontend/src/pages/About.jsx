import { useEffect, useRef, lazy, Suspense, useState } from 'react'
import './About.css'
import { useLanguage } from '../i18n/LanguageContext'

const ParticleBackground = lazy(() => import('../components/ParticleBackground'))

// Hook tuỳ chỉnh: theo dõi phần tử khi scroll vào màn hình
function useScrollReveal() {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const items = el.querySelectorAll('.reveal-item')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [])

  return containerRef
}

// ---- Icons ----
const IconDatabase = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
  </svg>
)

const IconBrain = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.66A2.5 2.5 0 0 1 9.5 2z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.66A2.5 2.5 0 0 0 14.5 2z"/>
  </svg>
)

const IconSparkles = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z"/>
    <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
  </svg>
)

const IconAlertTriangle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

const IconMail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
)

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const IconSend = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
  </svg>
)

// ---- Contact Modal ----
function ContactModal({ onClose }) {
  const { t } = useLanguage()
  const [name, setName]       = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent]       = useState(false)
  const overlayRef            = useRef(null)

  // Đóng khi click ra ngoài
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  // Đóng khi nhấn Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !message.trim()) return

    const subject = encodeURIComponent(`[AeroPulse] Feedback from ${name}`)
    const body    = encodeURIComponent(
      `Name: ${name}\n\nMessage / Feedback:\n${message}\n\n---\nSent from AeroPulse`
    )
    window.location.href = `mailto:xuanduy3105@gmail.com?subject=${subject}&body=${body}`
    setSent(true)
  }

  return (
    <div
      ref={overlayRef}
      className="contact-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('about.modalTitle')}
      onClick={handleOverlayClick}
    >
      <div className="contact-modal">
        {/* Header */}
        <div className="contact-modal-header">
          <div className="contact-modal-title">
            <span className="contact-modal-icon"><IconMail /></span>
            <h2>{t('about.modalTitle')}</h2>
          </div>
          <button
            className="contact-close-btn"
            onClick={onClose}
            aria-label={t('about.closeBtn')}
          >
            <IconX />
          </button>
        </div>

        {sent ? (
          /* Trạng thái đã gửi */
          <div className="contact-success">
            <div className="contact-success-icon">✉️</div>
            <h3>{t('about.successTitle')}</h3>
            <p>{t('about.successDesc')}</p>
            <button className="contact-btn-primary" onClick={onClose}>{t('about.closeBtn')}</button>
          </div>
        ) : (
          /* Form */
          <form className="contact-form" onSubmit={handleSubmit} noValidate>
            <div className="contact-field">
              <label htmlFor="contact-name">{t('about.nameLabel')} <span aria-hidden="true">*</span></label>
              <input
                id="contact-name"
                type="text"
                placeholder={t('about.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                maxLength={80}
              />
            </div>

            <div className="contact-field">
              <label htmlFor="contact-message">{t('about.msgLabel')} <span aria-hidden="true">*</span></label>
              <textarea
                id="contact-message"
                placeholder={t('about.msgPlaceholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                maxLength={2000}
              />
              <span className="contact-char-count">{message.length}/2000</span>
            </div>

            <div className="contact-form-footer">
              <span className="contact-to-hint">
                <IconMail /> {t('about.sendTo')} <strong>xuanduy3105@gmail.com</strong>
              </span>
              <button
                type="submit"
                className="contact-btn-primary"
                disabled={!name.trim() || !message.trim()}
              >
                <IconSend />
                {t('about.submitBtn')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ---- Component chính ----
function About() {
  const pageRef = useScrollReveal()
  const { lang, t } = useLanguage()
  const [showContact, setShowContact] = useState(false)

  const isEn = lang === 'en'

  const sections = [
    {
      id: 'datasource',
      icon: <IconDatabase />,
      title: isEn ? 'Data Sources' : 'Nguồn dữ liệu',
      delay: 0,
      content: isEn ? (
        <p>
          AQI data is acquired from the <strong>WAQI API</strong> and synchronized hourly via automated background workflows.
          The platform monitors 7 key urban centers: Hanoi, Da Nang, Hue, Thai Nguyen, Quang Ninh, Ha Tinh, and Viet Tri.
        </p>
      ) : (
        <p>
          Dữ liệu AQI lấy từ <strong>WAQI API</strong>, được cập nhật mỗi giờ qua GitHub Actions.
          Hệ thống theo dõi 7 địa điểm: Hà Nội, Đà Nẵng, Huế, Thái Nguyên, Quảng Ninh, Hà Tĩnh và Việt Trì.
        </p>
      ),
    },
    {
      id: 'anomaly',
      icon: <IconBrain />,
      title: isEn ? 'Anomaly Detection Methods' : 'Phương pháp phát hiện bất thường',
      delay: 80,
      content: isEn ? (
        <p>
          The system evaluated 3 techniques: grouped Z-score, IQR, and{' '}
          <strong>multivariate Isolation Forest</strong> (combining AQI, PM2.5, temperature, humidity, and wind).
          While IQR is sensitive in volatile regions, Isolation Forest captures complex multi-variable interactions
          and serves as the official anomaly detection model.
        </p>
      ) : (
        <p>
          Hệ thống đã thử nghiệm 3 phương pháp: Z-score theo nhóm, IQR và{' '}
          <strong>Isolation Forest đa chiều</strong> (kết hợp AQI, PM2.5, nhiệt độ, độ ẩm, gió).
          IQR nhạy hơn Z-score ở nơi dao động mạnh; Isolation Forest phát hiện thêm bất thường
          qua tổ hợp nhiều yếu tố và được chọn làm phương pháp chính thức.
        </p>
      ),
    },
    {
      id: 'ai',
      icon: <IconSparkles />,
      title: isEn ? 'About AI Reports' : 'Về báo cáo AI',
      delay: 160,
      content: isEn ? (
        <p>
          Analytical explanations generated by the <strong>Gemini API</strong> represent rational hypotheses
          derived from atmospheric data, rather than verified conclusions supported by on-site field evidence.
        </p>
      ) : (
        <p>
          Báo cáo giải thích nguyên nhân do <strong>Gemini API</strong> sinh ra là giả thuyết
          dựa trên suy luận logic, không phải kết luận đã xác minh bằng bằng chứng thực địa.
        </p>
      ),
    },
  ]

  return (
    <main className="about-page" ref={pageRef} style={{ position: 'relative' }}>

      {/* Three.js particle background */}
      <Suspense fallback={null}>
        <ParticleBackground style={{ borderRadius: 'inherit' }} />
      </Suspense>

      {/* Hero intro */}
      <header className="about-intro reveal-item" style={{ '--reveal-delay': '0ms' }}>
        <p className="about-kicker">
          {isEn ? 'ENVIRONMENTAL MONITORING PLATFORM' : 'HỆ THỐNG GIÁM SÁT MÔI TRƯỜNG'}
        </p>
        <h1>{isEn ? 'About AeroPulse' : 'Giới thiệu AeroPulse'}</h1>
        <p>
          {isEn
            ? 'AeroPulse is a real-time air quality monitoring system designed to help users identify atmospheric anomalies and understand underlying causes via AI analysis.'
            : 'AeroPulse là hệ thống theo dõi chất lượng không khí theo thời gian thực, giúp người dùng nhận biết các điểm AQI bất thường và hiểu nguyên nhân bằng phân tích AI.'}
        </p>
        <p>
          {isEn
            ? 'The platform combines environmental telemetry from WAQI, detects anomalies using machine learning models, and generates intelligible diagnostic reports via Gemini AI.'
            : 'Dự án kết hợp dữ liệu môi trường từ WAQI, phát hiện bất thường bằng mô hình học máy và hỗ trợ giải thích bằng Gemini để tạo báo cáo dễ hiểu cho người dùng.'}
        </p>
        <p>
          {isEn
            ? 'Our mission is to transform air quality pollution metrics into actionable, intuitive, and accessible intelligence for the public.'
            : 'Mục tiêu của AeroPulse là biến dữ liệu ô nhiễm không khí thành thông tin trực quan, dễ đọc và dễ hành động hơn cho cộng đồng.'}
        </p>
      </header>

      {/* Alert box */}
      <aside
        className="about-alert reveal-item"
        role="note"
        aria-label={isEn ? 'Monitoring scope note' : 'Lưu ý về phạm vi theo dõi'}
        style={{ '--reveal-delay': '60ms' }}
      >
        <span className="about-alert-icon">
          <IconAlertTriangle />
        </span>
        <div>
          <h2>{isEn ? 'Monitoring Scope Note' : 'Lưu ý về phạm vi theo dõi'}</h2>
          <p>
            {isEn
              ? 'Ho Chi Minh City is currently not included in the monitoring list due to the absence of a stable public station within a reasonable radius (nearest station is over 47 km away). This is a real-world infrastructure constraint rather than a software defect.'
              : 'TP.HCM không được đưa vào danh sách theo dõi do không có trạm quan trắc công khai ổn định trong bán kính hợp lý (trạm gần nhất cách hơn 47 km). Đây là hạn chế thực tế của hạ tầng giám sát môi trường, không phải lỗi hệ thống.'}
          </p>
        </div>
      </aside>

      {/* Feature sections */}
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="about-section reveal-item"
          style={{ '--reveal-delay': `${section.delay + 120}ms` }}
        >
          <div className="section-header">
            <span className="section-icon" aria-hidden="true">{section.icon}</span>
            <h2>{section.title}</h2>
          </div>
          {section.content}
        </section>
      ))}

      {/* ---- Contact CTA ---- */}
      <div className="contact-cta reveal-item" style={{ '--reveal-delay': '480ms' }}>
        <p className="contact-cta-hint">{t('about.ctaHint')}</p>
        <button
          id="btn-open-contact"
          className="contact-cta-btn"
          onClick={() => setShowContact(true)}
        >
          <IconMail />
          {t('about.ctaBtn')}
        </button>
      </div>

      {/* Modal */}
      {showContact && <ContactModal onClose={() => setShowContact(false)} />}

    </main>
  )
}

export default About
