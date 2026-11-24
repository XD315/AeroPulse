# AeroPulse

Hệ thống theo dõi chất lượng không khí và dự báo thời tiết tại các đô thị trọng điểm ở Việt Nam, trực quan hóa dữ liệu đa chiều, phát hiện bất thường bằng Machine Learning và tạo báo cáo giải thích bằng Gemini AI.

## Tính năng chính

- **Dashboard chất lượng không khí:** Theo dõi AQI, PM2.5, PM10 theo thời gian và so sánh nhiều địa điểm (Hà Nội, Đà Nẵng, Huế, Thái Nguyên, Quảng Ninh, Hà Tĩnh, Việt Trì).
- **Phát hiện bất thường (Anomaly Detection):** Kết hợp `IsolationForest` theo từng địa điểm và ngưỡng nghiệp vụ (`AQI > 100`) để lọc cảnh báo ô nhiễm thực sự.
- **Phân tích nguyên nhân bằng AI:** Tự động sinh báo cáo giả thuyết theo đặc thù địa lý/công nghiệp từng địa phương qua Gemini API (có fallback heuristic khi thiếu key hoặc hết quota).
- **Dự báo thời tiết & Bản đồ tương tác:** Xem thời tiết hiện tại, biểu đồ 24h, dự báo 14 ngày từ Open-Meteo, hỗ trợ định vị GPS và chọn tọa độ trên bản đồ Leaflet.
- **Gửi phản hồi trực tiếp:** Tiếp nhận góp ý qua API backend (lưu `data/feedback.jsonl`, hỗ trợ gửi thông báo về Discord Webhook hoặc Gmail SMTP mà không lộ email trên frontend).

## Cấu trúc thư mục

```text
AeroPulse/
├── backend/              # Flask API, ML anomaly detection, Gemini AI & feedback
│   ├── app.py
│   ├── requirements.txt
│   └── tests/
├── frontend/             # React + Vite UI
│   └── src/
├── scripts/              # Script thu thập dữ liệu WAQI (chạy thủ công hoặc GitHub Actions)
│   └── fetch_api.py
├── data/
│   └── api_data.csv      # Dữ liệu AQI lịch sử cập nhật mỗi giờ
└── .github/workflows/    # GitHub Actions tự động thu thập dữ liệu
```

## Yêu cầu hệ thống

- Python 3.10 trở lên
- Node.js 18+ và npm

## Cài đặt

Tại thư mục gốc của repository:

```powershell
# 1. Cài đặt Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt

# 2. Cài đặt Frontend
cd frontend
npm ci
cd ..
```

## Cấu hình biến môi trường

Tạo file `backend/.env` (tùy chọn theo nhu cầu sử dụng):

```dotenv
# Bật phân tích AI bằng Gemini
GEMINI_API_KEY=your_gemini_api_key

# Tùy chọn: nhận thông báo phản hồi qua Discord Webhook
FEEDBACK_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Tùy chọn: nhận thông báo phản hồi qua Gmail SMTP (dùng App Password)
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_gmail_app_password
FEEDBACK_TO_EMAIL=your_gmail@gmail.com
```

Nếu muốn chạy script thu thập dữ liệu WAQI thủ công, tạo `scripts/.env`:

```dotenv
WAQI_TOKEN=your_waqi_token
```

## Chạy ứng dụng

Mở 2 terminal tại thư mục gốc:

```powershell
# Terminal 1 — Backend (mặc định http://localhost:5000)
python backend/app.py
```

```powershell
# Terminal 2 — Frontend (Vite dev server)
cd frontend
npm run dev
```

### Thu thập dữ liệu WAQI thủ công (không bắt buộc)

```powershell
python scripts/fetch_api.py
```

## Kiểm thử

```powershell
# Unit test Backend & Script
.\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v

# Lint & Build Frontend
cd frontend
npm run lint
npm run build
```
