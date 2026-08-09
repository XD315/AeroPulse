import requests
import csv
import os
from datetime import datetime
from dotenv import load_dotenv
from math import radians, sin, cos, sqrt, atan2

load_dotenv()
TOKEN = os.getenv("WAQI_TOKEN")

LOCATIONS = {
    "hanoi": (21.0491, 105.8831),
    "da-nang": (16.074, 108.217),
    "hue": (16.46226, 107.596351),
    "thai-nguyen": (21.593151, 105.8431043),
    "quang-ninh": (21.006153, 106.859097),
    "ha-tinh": (18.0145193, 106.3990682),
    "viet-tri": (21.33847, 105.3673),
    "ho-chi-minh": (10.7769, 106.7009),  # thường xuyên thiếu dữ liệu — xem DECISIONS.md
}

CSV_FILE = "data/api_data.csv"


def get_iaqi_value(iaqi, key):
    value = iaqi.get(key, {})
    if isinstance(value, dict):
        return value.get("v", "")
    return value


def distance_km(lat1, lng1, lat2, lng2):
    R = 6371  # bán kính Trái Đất (km)
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))


def fetch_aqi_by_location(name, lat, lng, max_distance_km=30):
    url = f"https://api.waqi.info/feed/geo:{lat};{lng}/?token={TOKEN}"
    response = requests.get(url)
    data = response.json()

    if data.get("status") != "ok":
        print(f"Lỗi với {name}: {data}")
        return None

    station_lat, station_lng = data["data"]["city"]["geo"]
    dist = distance_km(lat, lng, station_lat, station_lng)

    if dist > max_distance_km:
        print(f"Bỏ qua {name}: trạm gần nhất cách {dist:.0f}km, vượt ngưỡng {max_distance_km}km")
        return None

    iaqi = data["data"].get("iaqi", {})
    print(f"{name}: trạm cách {dist:.1f}km ({data['data']['city']['name']})")
    return {
        "location": name,
        "station_name": data["data"]["city"]["name"],
        "aqi": data["data"]["aqi"],
        "pm25": iaqi.get("pm25", {}).get("v", ""),
        "pm10": iaqi.get("pm10", {}).get("v", ""),
        "temperature": iaqi.get("t", {}).get("v", ""),
        "humidity": iaqi.get("h", {}).get("v", ""),
        "wind": iaqi.get("w", {}).get("v", ""),
        "timestamp": datetime.now().isoformat()
    }


def save_to_csv(rows):
    file_exists = os.path.exists(CSV_FILE)
    os.makedirs(os.path.dirname(CSV_FILE), exist_ok=True)

    #fieldnames = ["location", "station_name", "aqi", "pm25", "pm10", "timestamp"]
    # Nếu bật thời tiết, đổi thành:
    fieldnames = ["location", "station_name", "aqi", "pm25", "pm10", "temperature", "humidity", "wind", "timestamp"]

    with open(CSV_FILE, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        for row in rows:
            writer.writerow(row)


if __name__ == "__main__":
    results = []
    for name, (lat, lng) in LOCATIONS.items():
        result = fetch_aqi_by_location(name, lat, lng)
        if result:
            results.append(result)
            print(result)

    save_to_csv(results)
    print(f"Đã lưu {len(results)} dòng.")