from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import math
from sklearn.ensemble import IsolationForest
from google import genai
from dotenv import load_dotenv
import os
import time
import requests as http_requests
from datetime import datetime, timedelta

# Tải .env từ cả thư mục backend lẫn root
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
load_dotenv()

app = Flask(__name__)
CORS(app)

gemini_api_key = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None

# ---- Cache trong RAM (15 phút để đảm bảo dữ liệu luôn mới) ----
_cache = {"data": None, "timestamp": None}

def is_cache_valid():
    if _cache["data"] is None or _cache["timestamp"] is None:
        return False
    return datetime.now() - _cache["timestamp"] < timedelta(minutes=15)


def generate_ai_report(row):
    """Tạo báo cáo giải thích bất thường bằng Gemini AI với fallback phân tích chuyên sâu.
    Prompt được làm giàu bằng đặc điểm địa lý/công nghiệp của từng địa điểm để
    tránh báo cáo chung chung, lặp nhau giữa các địa phương.
    """
    location_slug = str(row.get('location_slug', ''))
    location_label = str(row.get('location', row.get('location_slug', 'địa điểm này')))
    geo_context = LOCATION_CONTEXT.get(location_slug, 'khu vực tại Việt Nam')

    # Xác định mức độ bất thường
    aqi_val   = float(row.get('aqi') or 0)
    mean_val  = float(row.get('location_mean') or aqi_val)
    deviation = aqi_val - mean_val
    pm25_val  = float(row.get('pm25') or 0)
    pm10_val  = float(row.get('pm10') or 0)
    wind_val  = float(row.get('wind') or 0)
    hum_val   = float(row.get('humidity') or 0)
    temp_val  = float(row.get('temperature') or 0)
    timestamp = str(row.get('timestamp', ''))[:16]  # YYYY-MM-DDTHH:MM

    # Prompt phong phú, cụ thể theo từng địa điểm
    prompt = f"""Bạn là chuyên gia phân tích chất lượng không khí Việt Nam.

Địa điểm: {location_label}
Đặc điểm khu vực: {geo_context}
Thời điểm ghi nhận: {timestamp}

Chỉ số đo được:
- AQI: {aqi_val:.0f} (cao hơn mức trung bình lịch sử {mean_val:.1f} của địa phương tới {deviation:+.1f} điểm)
- PM2.5: {pm25_val:.1f} µg/m³ | PM10: {pm10_val:.1f} µg/m³
- Nhiệt độ: {temp_val:.1f}°C | Độ ẩm: {hum_val:.0f}% | Tốc độ gió: {wind_val:.1f} m/s

Dựa trên đặc điểm địa lý, nguồn phát thải và điều kiện khí tượng ĐẶC THÙ của {location_label}, hãy:
1. Đưa ra 2-3 nguyên nhân CỤ THỂ (liên hệ trực tiếp tới đặc điểm công nghiệp/địa hình/khí hậu của khu vực này, KHÔNG dùng câu chung chung).
2. Ghi rõ đây là phân tích giả thuyết dựa trên dữ liệu cảm biến.
3. Thêm 1 khuyến nghị sức khỏe phù hợp với người dân địa phương.
Viết súc tích, mỗi nguyên nhân 2-3 câu."""

    # Ưu tiên các model có quota cao
    models_to_try = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-flash-latest"]
    if gemini_client:
        for model_name in models_to_try:
            try:
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                if response and response.text:
                    return response.text
            except Exception as e:
                print(f"[AI] Model {model_name} không khả dụng: {e}")
                continue

    # ---- Fallback Heuristic — phân biệt theo đặc điểm địa điểm ----
    reasons = []

    # Lý do 1: PM2.5 — mô tả theo nguồn đặc trưng của địa phương
    if pm25_val > 45:
        if location_slug in ('thai-nguyen', 'viet-tri', 'ha-tinh'):
            reasons.append(
                f"Nồng độ bụi mịn PM2.5 rất cao ({pm25_val:.1f} µg/m³) — tại {location_label}, "
                f"nguồn phát thải chủ yếu từ hoạt động công nghiệp nặng (luyện kim, hóa chất) "
                f"đang hoạt động liên tục, đặc biệt trong ca đêm khi nhiệt độ thấp làm khói khó thoát."
            )
        elif location_slug == 'quang-ninh':
            reasons.append(
                f"PM2.5 đạt {pm25_val:.1f} µg/m³ — phù hợp với đặc trưng bụi than từ các mỏ khai thác "
                f"và hoạt động vận chuyển than bằng xe tải trên Quốc lộ 18. Bụi than có hạt siêu mịn "
                f"(< 1 µm) rất khó lọc và đặc biệt nguy hại cho phổi."
            )
        elif location_slug == 'hanoi':
            reasons.append(
                f"PM2.5 tăng lên {pm25_val:.1f} µg/m³ — tại Hà Nội, lúc này khả năng cao do "
                f"khí thải phương tiện giao thông dày đặc kết hợp với khói bếp than tổ ong "
                f"từ các khu dân cư lâu đời, đặc biệt vào buổi sáng sớm hoặc tối."
            )
        else:
            reasons.append(
                f"Nồng độ bụi mịn PM2.5 cao ({pm25_val:.1f} µg/m³) vượt ngưỡng WHO 25 µg/m³, "
                f"gợi ý có nguồn phát thải cục bộ đang hoạt động mạnh (đốt rơm rạ, xây dựng, giao thông)."
            )

    # Lý do 2: Điều kiện khí tượng bất lợi
    if wind_val <= 1.5:
        if location_slug == 'hue':
            reasons.append(
                f"Gió yếu ({wind_val} m/s) — Huế nằm trong địa hình lòng chảo giữa núi Trường Sơn và "
                f"đồng bằng ven biển, tạo ra hiện tượng nghịch nhiệt (thermal inversion) buổi sáng "
                f"khiến chất ô nhiễm bị nhốt sát mặt đất thay vì khuếch tán lên cao."
            )
        else:
            reasons.append(
                f"Tốc độ gió rất thấp ({wind_val} m/s) gây hiện tượng ứ đọng không khí cục bộ: "
                f"chất ô nhiễm từ giao thông và sinh hoạt không được pha loãng, tích tụ theo lớp "
                f"sát mặt đất — đây là nguyên nhân phổ biến làm AQI tăng đột biến vào buổi sáng "
                f"lặng gió tại {location_label}."
            )
    elif wind_val >= 4.0:
        if location_slug in ('da-nang', 'hue'):
            reasons.append(
                f"Gió mạnh từ biển ({wind_val} m/s) — vào mùa gió Đông Bắc, luồng gió ven biển "
                f"cuốn theo muối biển và hơi ẩm, làm tăng nồng độ sol khí (sea-salt aerosol), "
                f"góp phần đẩy chỉ số PM10 và AQI cao hơn bình thường."
            )
        else:
            reasons.append(
                f"Gió mạnh ({wind_val} m/s) đang vận chuyển bụi từ vùng lân cận đến {location_label}. "
                f"Khi gió thổi qua khu công trường, bãi đất trống hoặc vùng canh tác khô, "
                f"các hạt bụi thô PM10 bị cuốn xa hàng chục km."
            )

    # Lý do 3: Độ ẩm cao → aerosol hygroscopic growth
    if hum_val >= 80:
        reasons.append(
            f"Độ ẩm {hum_val:.0f}% tạo điều kiện cho hiện tượng hút ẩm của hạt sol khí "
            f"(aerosol hygroscopic growth): các hạt bụi hút nước và phình to gấp 1.5–3 lần, "
            f"làm tăng hệ số tán xạ ánh sáng và đẩy chỉ số AQI của máy đo quang học lên cao "
            f"dù lượng chất độc thực tế không tăng tương ứng."
        )

    # Fallback cuối nếu không có lý do nào khớp
    if not reasons:
        geo_hint = LOCATION_CONTEXT.get(location_slug, 'khu vực')
        reasons.append(
            f"Mức AQI {aqi_val:.0f} cao hơn trung bình {deviation:+.1f} điểm so với lịch sử tại {location_label}. "
            f"Xét theo đặc điểm của {geo_hint}, nhiều khả năng do sự kết hợp giữa hoạt động "
            f"kinh tế - xã hội cục bộ và điều kiện khí tượng bất lợi trong khung giờ đo đạc."
        )

    reasons_text = "\n\n".join([f"- **Nguyên nhân {i+1}:** {r}" for i, r in enumerate(reasons[:3])])

    # Khuyến nghị phân theo mức AQI
    if aqi_val > 200:
        advice = (f"Mức AQI {aqi_val:.0f} ở ngưỡng Nguy hiểm — người dân {location_label} "
                  f"nên ở trong nhà, đóng kín cửa, dùng máy lọc không khí và tránh mọi hoạt động ngoài trời.")
    elif aqi_val > 150:
        advice = (f"AQI {aqi_val:.0f} ở mức Xấu — đặc biệt trẻ em, người cao tuổi và người có "
                  f"bệnh hô hấp tại {location_label} nên hạn chế ra ngoài; nếu cần thiết hãy đeo khẩu trang N95.")
    else:
        advice = (f"AQI {aqi_val:.0f} ở mức Kém — người nhạy cảm tại {location_label} nên đeo "
                  f"khẩu trang khi di chuyển và tránh tập thể dục cường độ cao ngoài trời trong khung giờ này.")

    return (
        f"Dựa trên dữ liệu cảm biến và đặc điểm của {location_label}, hệ thống đưa ra các giả thuyết phân tích sau:\n\n"
        f"{reasons_text}\n\n"
        f"**Khuyến nghị sức khỏe:** {advice}"
    )


def load_clean_data():
    """
    Tải dữ liệu từ GitHub tự động của AeroPulse (ưu tiên GitHub để lấy bản cập nhật mới nhất từ GitHub Actions bot).
    Thêm tham số timestamp chống cache CDN của GitHub raw.
    Nếu mất mạng hoặc GitHub lỗi, fallback đọc file cục bộ.
    """
    df = None
    try:
        url = f"https://raw.githubusercontent.com/XD315/AeroPulse/main/data/api_data.csv?t={int(time.time())}"
        resp = http_requests.get(url, headers={'Cache-Control': 'no-cache'}, timeout=12)
        if resp.status_code == 200:
            import io
            df = pd.read_csv(io.StringIO(resp.text))
            print(f"[data] Loaded {len(df)} rows fresh from GitHub repository.")
    except Exception as e:
        print(f"[data] Không thể tải từ GitHub ({e}), chuyển sang đọc file cục bộ...")

    if df is None:
        local_path = os.path.join(os.path.dirname(__file__), "..", "data", "api_data.csv")
        if os.path.exists(local_path):
            df = pd.read_csv(local_path)
            print(f"[data] Loaded {len(df)} rows from local storage.")
        else:
            raise RuntimeError("Không tìm thấy dữ liệu từ GitHub lẫn file cục bộ!")

    df = df[df['location'] != 'ho-chi-minh'].copy()
    df['pm25'] = pd.to_numeric(df['pm25'], errors='coerce')
    df['pm10'] = pd.to_numeric(df['pm10'], errors='coerce')
    df['aqi']  = pd.to_numeric(df['aqi'], errors='coerce')
    df['temperature'] = pd.to_numeric(df['temperature'], errors='coerce').fillna(28.0)
    df['humidity']    = pd.to_numeric(df['humidity'], errors='coerce').fillna(75.0)
    df['wind']        = pd.to_numeric(df['wind'], errors='coerce').fillna(2.0)
    df['pm25'] = df['pm25'].fillna(df['pm25'].median())
    df['pm10'] = df['pm10'].fillna(df['pm10'].median())
    return df

# Nhãn tiếng Việt cho từng location slug
LOCATION_LABELS = {
    'hanoi':       'Hà Nội',
    'da-nang':     'Đà Nẵng',
    'hue':         'Huế',
    'thai-nguyen': 'Thái Nguyên',
    'quang-ninh':  'Quảng Ninh',
    'ha-tinh':     'Hà Tĩnh',
    'viet-tri':    'Việt Trì',
}

# Đặc điểm địa lý và công nghiệp của từng địa phương — dùng để làm giàu prompt AI
LOCATION_CONTEXT = {
    'hanoi':       'đô thị trung tâm đông dân nhất miền Bắc, mật độ phương tiện giao thông rất cao, có các khu công nghiệp ven đô (Bắc Thăng Long, Nội Bài), thường xuất hiện nghịch nhiệt buổi sáng vào mùa đông',
    'da-nang':     'thành phố ven biển miền Trung, kinh tế du lịch và dịch vụ là chủ đạo, ít công nghiệp nặng, chịu ảnh hưởng gió biển thường xuyên và bão vào tháng 9–11',
    'hue':         'thành phố di sản lịch sử ven sông Hương, địa hình lòng chảo giữa dãy Trường Sơn và biển nên dễ tích tụ ô nhiễm, ít công nghiệp, thường mưa nhiều nhất Việt Nam vào tháng 10–12',
    'thai-nguyen': 'trung tâm công nghiệp luyện kim và thép lớn nhất miền Bắc (Khu KCN Sông Công, Gang Thép Thái Nguyên), nguồn phát thải bụi và SO2 từ nhà máy là đặc trưng cần phân tích đặc biệt',
    'quang-ninh':  'vùng khai thác than lớn nhất Việt Nam (Hạ Long, Cẩm Phả), hoạt động nổ mìn và vận chuyển than tạo ra lượng bụi PM10 và PM2.5 rất lớn, cảng biển Cái Lân cũng góp phần phát thải',
    'ha-tinh':     'tỉnh có Khu Kinh tế Vũng Áng với tổ hợp thép Formosa — một trong những nguồn phát thải công nghiệp lớn nhất Việt Nam, cộng thêm cảng biển và hoạt động logistic',
    'viet-tri':    'đô thị công nghiệp hóa chất và giấy tại ngã ba sông Lô - sông Hồng (Tập đoàn Hóa chất Việt Nam, Giấy Bãi Bằng), đặc trưng ô nhiễm hơi hóa học và bụi gỗ giấy',
}

def aqi_to_status(aqi):
    """Chuyển AQI thành trạng thái + loại màu."""
    if aqi <= 50:
        return 'Tốt', 'success'
    elif aqi <= 100:
        return 'Trung bình', 'warning'
    elif aqi <= 150:
        return 'Kém', 'warning'
    elif aqi <= 200:
        return 'Xấu', 'danger'
    else:
        return 'Nguy hiểm', 'danger'


@app.route('/api/anomalies')
def get_anomalies():
    # Hỗ trợ query ?refresh=true để xóa cache và phân tích lại ngay lập tức
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'

    if not force_refresh and is_cache_valid():
        print("[cache] Returning cached anomalies")
        return jsonify(_cache["data"])

    print("[cache] Computing fresh anomalies (sorting by latest timestamp)...")
    df = load_clean_data()

    # Sắp xếp theo thời gian MỚI NHẤT lên đầu để không lấy dữ liệu cũ từ tháng 8
    df['timestamp_dt'] = pd.to_datetime(df['timestamp'], errors='coerce')
    df = df.sort_values('timestamp_dt', ascending=False)

    # DATA SCIENCE: Dùng IsolationForest để phát hiện bất thường
    # contamination=0.03: chỉ đánh dấu 3% data là bất thường (giảm false positive so với 0.05)
    df['location_mean'] = df.groupby('location')['aqi'].transform('mean')
    features = df[['aqi', 'pm25', 'temperature', 'humidity', 'wind']]
    model = IsolationForest(contamination=0.03, random_state=42)
    df['is_anomaly'] = model.fit_predict(features)

    # Lấy bản ghi bất thường MỚI NHẤT cho mỗi địa điểm (head(1) sau khi đã sắp xếp giảm dần)
    # Thêm filter AQI > 100: theo ngưỡng WHO, AQI ≤ 100 là chấp nhận được → không cần cảnh báo
    anomalies = (
        df[(df['is_anomaly'] == -1) & (df['aqi'] > 100)]
        .groupby('location')
        .head(1)
    )

    results = []
    for _, row in anomalies.iterrows():
        status, status_type = aqi_to_status(int(row['aqi']))
        location_slug = row['location']
        location_label = LOCATION_LABELS.get(location_slug, location_slug)

        # Tạo dict enriched với location_slug để generate_ai_report tra cứu geo context đúng
        row_dict = row.to_dict()
        row_dict['location_slug'] = location_slug   # slug gốc (ví dụ: 'thai-nguyen')
        row_dict['location']      = location_label  # nhãn tiếng Việt (ví dụ: 'Thái Nguyên')
        row_dict['location_mean'] = float(row['location_mean'])

        results.append({
            'id':           int(row.name),
            'location':     location_label,
            'location_slug': location_slug,
            'station_name': row.get('station_name', ''),
            'time':         str(row['timestamp']),
            'aqi':          int(row['aqi']),
            'pm25':         float(row['pm25']),
            'pm10':         float(row['pm10']),
            'temperature':  float(row['temperature']),
            'humidity':     float(row['humidity']),
            'wind':         float(row['wind']),
            'location_mean': float(row['location_mean']),
            'status':       status,
            'statusType':   status_type,
            'description':  f"PM2.5: {row['pm25']:.1f} µg/m³ · Nhiệt độ: {row['temperature']}°C · Độ ẩm: {row['humidity']}%",
            'report':       generate_ai_report(row_dict),
        })

    # Lưu vào cache
    _cache["data"] = results
    _cache["timestamp"] = datetime.now()
    print(f"[cache] Saved {len(results)} fresh anomalies to cache at {datetime.now().strftime('%H:%M:%S')}")

    return jsonify(results)


@app.route('/api/health')
def health_check():
    cache_status = "valid" if is_cache_valid() else "empty"
    cache_age = None
    if _cache["timestamp"]:
        cache_age = int((datetime.now() - _cache["timestamp"]).total_seconds() / 60)
    return jsonify({
        "status": "Server đang chạy",
        "cache": cache_status,
        "cache_age_minutes": cache_age,
    })


@app.route('/api/generate-report', methods=['POST'])
def retry_generate_report():
    row = request.json
    # row được FE gửi lên: đã có location (label), location_slug, aqi, location_mean, pm25, v.v.
    # Đảm bảo location_slug có mặt (FE gửi từ aqiData đã có sẵn field này)
    if 'location_slug' not in row and 'location' in row:
        # Tra ngược slug từ label nếu FE chưa gửi slug
        slug_map = {v: k for k, v in LOCATION_LABELS.items()}
        row['location_slug'] = slug_map.get(row['location'], row['location'])

    report = generate_ai_report(row)
    return jsonify({"report": report})


@app.route('/api/data')
def get_data():
    df = load_clean_data()
    data = df.tail(20).to_dict(orient='records')
    return jsonify(data)


@app.route('/api/chart')
def get_chart_data():
    """
    Trả dữ liệu AQI / PM2.5 / PM10 theo ngày cho từng location.
    Query params:
      - location: slug hoặc 'all'  (mặc định: 'all')
      - start   : YYYY-MM-DD        (mặc định: 30 ngày trước)
      - end     : YYYY-MM-DD        (mặc định: hôm nay)
      - metric  : aqi | pm25 | pm10 (mặc định: aqi)
    """
    from flask import request
    location = request.args.get('location', 'all')
    start    = request.args.get('start',    None)
    end      = request.args.get('end',      None)
    metric   = request.args.get('metric',   'aqi')

    if metric not in ('aqi', 'pm25', 'pm10'):
        metric = 'aqi'

    df = load_clean_data()
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['date'] = df['timestamp'].dt.date.astype(str)

    # Lọc ngày
    if start:
        df = df[df['date'] >= start]
    if end:
        df = df[df['date'] <= end]

    # Lọc location — hỗ trợ nhiều location: ?locations=hanoi,da-nang,hue
    locations_param = request.args.get('locations', '')   # ưu tiên param mới
    location        = request.args.get('location', 'all') # backward compat

    selected = []
    if locations_param:
        selected = [s.strip() for s in locations_param.split(',') if s.strip()]

    if selected:
        df = df[df['location'].isin(selected)]
    elif location != 'all':
        df = df[df['location'] == location]
    # else: giữ tất cả

    if df.empty:
        return jsonify([])

    # Group theo date + location, lấy mean
    grouped = (
        df.groupby(['date', 'location'])[metric]
        .mean()
        .reset_index()
        .rename(columns={metric: 'value'})
    )
    grouped['value'] = grouped['value'].round(1)
    grouped['location_label'] = grouped['location'].map(
        lambda s: LOCATION_LABELS.get(s, s)
    )

    # Pivot thành {date, hanoi: x, da-nang: y, ...}
    pivot = grouped.pivot(index='date', columns='location', values='value').reset_index()
    pivot.columns.name = None

    # Chuyển NaN -> None an toàn (fillna(None) không đáng tin với float columns)
    raw_records = pivot.to_dict(orient='records')
    records = [
        {
            k: (None if isinstance(v, float) and math.isnan(v) else v)
            for k, v in row.items()
        }
        for row in raw_records
    ]

    return jsonify({
        'metric': metric,
        'locations': sorted(grouped['location'].unique().tolist()),
        'location_labels': LOCATION_LABELS,
        'rows': records,
    })


@app.route('/api/locations')
def get_locations():
    """Trả danh sách locations có trong data."""
    df = load_clean_data()
    slugs = sorted(df['location'].unique().tolist())
    result = [{'value': s, 'label': LOCATION_LABELS.get(s, s)} for s in slugs]
    return jsonify(result)


@app.route('/api/data-range')
def get_data_range():
    """
    Trả khoảng ngày có dữ liệu cho một location.
    Query param: location (slug hoặc 'all')
    Response: { location, label, min_date, max_date, total_records }
    """
    from flask import request
    location = request.args.get('location', 'all')

    df = load_clean_data()
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['date'] = df['timestamp'].dt.date.astype(str)

    if location != 'all':
        df = df[df['location'] == location]

    if df.empty:
        return jsonify({
            'location': location,
            'label': LOCATION_LABELS.get(location, location),
            'min_date': None,
            'max_date': None,
            'total_records': 0,
        })

    return jsonify({
        'location': location,
        'label': LOCATION_LABELS.get(location, location),
        'min_date': df['date'].min(),
        'max_date': df['date'].max(),
        'total_records': len(df),
    })


# ============================================================
# WEATHER FORECAST — Open-Meteo proxy
# ============================================================

# Toạ độ các địa điểm theo dõi
LOCATION_COORDS = {
    'hanoi':       {'lat': 21.0285, 'lon': 105.8542, 'label': 'Hà Nội'},
    'da-nang':     {'lat': 16.0544, 'lon': 108.2022, 'label': 'Đà Nẵng'},
    'hue':         {'lat': 16.4637, 'lon': 107.5909, 'label': 'Huế'},
    'thai-nguyen': {'lat': 21.5942, 'lon': 105.8480, 'label': 'Thái Nguyên'},
    'quang-ninh':  {'lat': 20.9598, 'lon': 107.0421, 'label': 'Quảng Ninh'},
    'ha-tinh':     {'lat': 18.3333, 'lon': 105.9000, 'label': 'Hà Tĩnh'},
    'viet-tri':    {'lat': 21.3016, 'lon': 105.4015, 'label': 'Việt Trì'},
}

# Cache thời tiết — key: location slug, value: {data, timestamp}
_weather_cache = {}
WEATHER_CACHE_MINUTES = 30


def is_weather_cache_valid(slug):
    entry = _weather_cache.get(slug)
    if not entry:
        return False
    return datetime.now() - entry['timestamp'] < timedelta(minutes=WEATHER_CACHE_MINUTES)


def weather_icon(code):
    """WMO weather code → emoji icon + mô tả tiếng Việt."""
    mapping = {
        0:  ('☀️', 'Trời quang'),
        1:  ('🌤️', 'Ít mây'),
        2:  ('⛅', 'Có mây'),
        3:  ('☁️', 'Nhiều mây'),
        45: ('🌫️', 'Sương mù'),
        48: ('🌫️', 'Sương muối'),
        51: ('🌦️', 'Mưa phùn nhẹ'),
        53: ('🌦️', 'Mưa phùn'),
        55: ('🌧️', 'Mưa phùn dày'),
        61: ('🌧️', 'Mưa nhẹ'),
        63: ('🌧️', 'Mưa vừa'),
        65: ('🌧️', 'Mưa to'),
        71: ('🌨️', 'Tuyết nhẹ'),
        73: ('🌨️', 'Tuyết vừa'),
        75: ('🌨️', 'Tuyết dày'),
        80: ('🌦️', 'Mưa rào nhẹ'),
        81: ('🌦️', 'Mưa rào'),
        82: ('⛈️', 'Mưa rào mạnh'),
        95: ('⛈️', 'Dông'),
        96: ('⛈️', 'Dông có mưa đá'),
        99: ('⛈️', 'Dông có mưa đá nặng'),
    }
    icon, desc = mapping.get(code, ('🌡️', 'Không xác định'))
    return icon, desc


@app.route('/api/weather')
def get_weather():
    """
    Trả dữ liệu thời tiết từ Open-Meteo API.
    Query params:
      - location : slug (hanoi, da-nang, ...) — ưu tiên nếu có
      - lat, lon : tọa độ GPS tùy ý (dùng khi location = 'gps')
    Response: { location, label, current, hourly[24], daily[14], alerts[] }
    """
    slug = request.args.get('location', 'hanoi').lower()
    lat_param = request.args.get('lat')
    lon_param = request.args.get('lon')

    # Hỗ trợ GPS tùy ý
    if slug == 'gps' and lat_param and lon_param:
        try:
            lat = float(lat_param)
            lon = float(lon_param)
        except ValueError:
            return jsonify({'error': 'lat/lon không hợp lệ'}), 400
        coords = {'lat': lat, 'lon': lon, 'label': f'Vị trí của bạn ({lat:.3f}, {lon:.3f})'}
        cache_key = f'gps_{lat:.4f}_{lon:.4f}'
    elif slug in LOCATION_COORDS:
        coords   = LOCATION_COORDS[slug]
        cache_key = slug
    else:
        return jsonify({'error': f'Địa điểm "{slug}" không hỗ trợ. Dùng: {list(LOCATION_COORDS.keys())} hoặc location=gps&lat=...&lon=...'}), 400

    # Trả cache nếu còn hiệu lực
    if is_weather_cache_valid(cache_key):
        print(f"[weather cache] HIT for {cache_key}")
        return jsonify(_weather_cache[cache_key]['data'])

    print(f"[weather cache] MISS for {cache_key} — fetching Open-Meteo...")

    # Gọi Open-Meteo — thêm cloud_cover, precipitation, visibility, wind_direction
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={coords['lat']}&longitude={coords['lon']}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,"
        f"weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,uv_index,"
        f"cloud_cover,precipitation"
        f"&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,"
        f"relative_humidity_2m,precipitation,cloud_cover,visibility"
        f"&daily=weather_code,temperature_2m_max,temperature_2m_min,"
        f"precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset,"
        f"precipitation_probability_max"
        f"&timezone=Asia%2FBangkok&forecast_days=14"
    )

    try:
        resp = http_requests.get(url, timeout=10)
        resp.raise_for_status()
        raw = resp.json()
    except Exception as e:
        print(f"[weather] Lỗi Open-Meteo: {e}")
        return jsonify({'error': f'Không thể lấy dữ liệu thời tiết: {str(e)}'}), 503

    # --- Parse current ---
    cur = raw.get('current', {})
    cur_icon, cur_desc = weather_icon(cur.get('weather_code', 0))
    current = {
        'temperature':   cur.get('temperature_2m'),
        'feels_like':    cur.get('apparent_temperature'),
        'humidity':      cur.get('relative_humidity_2m'),
        'wind_speed':    cur.get('wind_speed_10m'),
        'wind_dir':      cur.get('wind_direction_10m'),
        'pressure':      cur.get('surface_pressure'),
        'uv_index':      cur.get('uv_index'),
        'cloud_cover':   cur.get('cloud_cover'),
        'precipitation': cur.get('precipitation'),
        'weather_code':  cur.get('weather_code'),
        'icon':          cur_icon,
        'condition':     cur_desc,
        'time':          cur.get('time'),
    }

    # --- Parse hourly (24h tiếp theo, đầy đủ fields) ---
    h = raw.get('hourly', {})
    times_h   = h.get('time', [])
    temps_h   = h.get('temperature_2m', [])
    codes_h   = h.get('weather_code', [])
    winds_h   = h.get('wind_speed_10m', [])
    winddir_h = h.get('wind_direction_10m', [])
    humids_h  = h.get('relative_humidity_2m', [])
    rain_h    = h.get('precipitation', [])
    cloud_h   = h.get('cloud_cover', [])
    vis_h     = h.get('visibility', [])  # mét

    now_str = cur.get('time', '')[:13]
    start_i = 0
    for i, t in enumerate(times_h):
        if t[:13] >= now_str:
            start_i = i
            break

    hourly = []
    for i in range(start_i, min(start_i + 24, len(times_h))):
        icon_h, desc_h = weather_icon(codes_h[i] if i < len(codes_h) else 0)
        vis_m = vis_h[i] if i < len(vis_h) else None
        vis_km = round(vis_m / 1000, 1) if vis_m is not None else None
        hourly.append({
            'time':        times_h[i][11:16] if i < len(times_h) else '',
            'full_time':   times_h[i] if i < len(times_h) else '',
            'temp':        temps_h[i] if i < len(temps_h) else None,
            'humidity':    humids_h[i] if i < len(humids_h) else None,
            'wind':        winds_h[i] if i < len(winds_h) else None,
            'wind_dir':    winddir_h[i] if i < len(winddir_h) else None,
            'rain':        rain_h[i] if i < len(rain_h) else None,
            'cloud':       cloud_h[i] if i < len(cloud_h) else None,
            'visibility':  vis_km,
            'icon':        icon_h,
            'condition':   desc_h,
        })

    # --- Parse daily (14 ngày) ---
    d = raw.get('daily', {})
    times_d   = d.get('time', [])
    codes_d   = d.get('weather_code', [])
    tmax_d    = d.get('temperature_2m_max', [])
    tmin_d    = d.get('temperature_2m_min', [])
    rain_d    = d.get('precipitation_sum', [])
    wind_d    = d.get('wind_speed_10m_max', [])
    uv_d      = d.get('uv_index_max', [])
    sunrise_d = d.get('sunrise', [])
    sunset_d  = d.get('sunset', [])
    pop_d     = d.get('precipitation_probability_max', [])  # % xác suất mưa

    DAY_VI = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']

    daily = []
    for i, date_str in enumerate(times_d):
        icon_d, desc_d = weather_icon(codes_d[i] if i < len(codes_d) else 0)
        try:
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            day_name   = 'Hôm nay' if i == 0 else ('Ngày mai' if i == 1 else DAY_VI[dt.weekday()])
            date_label = dt.strftime('%d/%m/%Y')
        except Exception:
            day_name   = date_str
            date_label = date_str

        t_max = tmax_d[i] if i < len(tmax_d) else None
        t_min = tmin_d[i] if i < len(tmin_d) else None
        sr = sunrise_d[i][11:16] if i < len(sunrise_d) and sunrise_d[i] else ''
        ss = sunset_d[i][11:16]  if i < len(sunset_d)  and sunset_d[i]  else ''

        daily.append({
            'date':       date_str,
            'date_label': date_label,
            'day':        day_name,
            'icon':       icon_d,
            'condition':  desc_d,
            'temp_max':   t_max,
            'temp_min':   t_min,
            'temp_label': f"{round(t_max) if t_max else '?'}°/{round(t_min) if t_min else '?'}°",
            'rain':       rain_d[i] if i < len(rain_d) else None,
            'pop':        pop_d[i]  if i < len(pop_d)  else None,   # xác suất mưa %
            'wind':       wind_d[i] if i < len(wind_d) else None,
            'uv':         uv_d[i]   if i < len(uv_d)   else None,
            'sunrise':    sr,
            'sunset':     ss,
        })

    # --- Cảnh báo thời tiết: dựa vào weather_code ---
    DANGER_CODES = {
        55: '🌧️ Mưa phùn dày — hạn chế di chuyển',
        65: '🌧️ Mưa to — nguy cơ ngập úng',
        75: '🌨️ Tuyết dày — nguy hiểm',
        82: '⛈️ Mưa rào mạnh — cẩn thận lũ quét',
        95: '⛈️ Dông mạnh — tránh hoạt động ngoài trời',
        96: '⛈️ Dông kèm mưa đá — ở trong nhà',
        99: '⛈️ Dông mưa đá nặng — nguy hiểm cực cao',
    }
    alerts = []
    cur_code = cur.get('weather_code', 0)
    if cur_code in DANGER_CODES:
        alerts.append({'type': 'danger', 'message': DANGER_CODES[cur_code], 'time': 'Hiện tại'})
    # Kiểm tra hourly 6h tới
    for item in hourly[:6]:
        code_h = next((codes_h[start_i + hourly.index(item)] for _ in [1] if True), 0)
        wmo = codes_h[start_i + hourly.index(item)] if (start_i + hourly.index(item)) < len(codes_h) else 0
        if wmo in DANGER_CODES and wmo != cur_code:
            alerts.append({'type': 'warning', 'message': DANGER_CODES[wmo], 'time': item['time']})
            break
    # UV cao
    if cur.get('uv_index') and cur['uv_index'] >= 8:
        alerts.append({'type': 'uv', 'message': f'☀️ Chỉ số UV rất cao ({cur["uv_index"]}) — dùng kem chống nắng', 'time': 'Hiện tại'})

    result = {
        'location':   cache_key,
        'label':      coords['label'],
        'current':    current,
        'hourly':     hourly,
        'daily':      daily,
        'alerts':     alerts,
        'fetched_at': datetime.now().isoformat(),
    }

    _weather_cache[cache_key] = {'data': result, 'timestamp': datetime.now()}
    print(f"[weather cache] Saved weather for {cache_key}")

    return jsonify(result)


if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)