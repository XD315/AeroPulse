# AeroPulse

AeroPulse theo dõi chất lượng không khí tại các địa điểm ở Việt Nam, trực quan hóa dữ liệu, phát hiện bất thường và cung cấp gợi ý giải thích bằng AI.

## Chức năng

- Theo dõi AQI, PM2.5, PM10, nhiệt độ, độ ẩm và tốc độ gió.
- Xem dữ liệu theo địa điểm, biểu đồ và bản đồ thời tiết.
- Phát hiện các điểm AQI bất thường và tạo báo cáo giải thích bằng Gemini khi có API key.

## Yêu cầu

- Python 3.10 trở lên
- Node.js và npm

## Cài đặt

Tại thư mục gốc của repo, cài các dependency backend:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
```

Cài dependency frontend:

```powershell
cd frontend
npm ci
cd ..
```

## Cấu hình API key

Tạo `backend/.env` nếu cần bật báo cáo AI:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
```

Để tải dữ liệu mới từ WAQI, tạo `scripts/.env`:

```dotenv
WAQI_TOKEN=your_waqi_token
```

Không đưa các file `.env` hoặc API key lên Git. Ứng dụng có thể đọc dữ liệu hiện có từ `data/api_data.csv`; tải dữ liệu mới là bước tùy chọn.

## Chạy ứng dụng

Mở hai terminal tại thư mục gốc repo. Chạy backend ở terminal thứ nhất:

```powershell
python backend/app.py
```

Chạy frontend ở terminal thứ hai:

```powershell
cd frontend
npm run dev
```

Mở URL Vite hiển thị trong terminal. Backend mặc định chạy tại `http://localhost:5000`.

Để lấy dữ liệu mới trước khi chạy ứng dụng:

```powershell
python scripts/fetch_api.py
```

