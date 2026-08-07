import requests
import csv
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("WAQI_TOKEN")

# Toạ độ các trạm ĐÃ XÁC NHẬN đang hoạt động (lấy từ map/bounds)
LOCATIONS = {
    "hanoi": (21.0491, 105.8831),
    "da-nang": (16.074, 108.217),
     "ho-chi-minh": (10.7769, 106.7009),
    "hue": (16.46226, 107.596351),
    "thai-nguyen": (21.593151, 105.8431043),
    "quang-ninh": (21.006153, 106.859097),
    "ha-tinh": (18.0145193, 106.3990682),
    "viet-tri": (21.33847, 105.3673),
    "tay-ninh": (11.030287, 106.35631),  # gần TP.HCM nhất hiện có
}

CSV_FILE = "data/api_data.csv"


def fetch_aqi_by_location(name, lat, lng):
    url = f"https://api.waqi.info/feed/geo:{lat};{lng}/?token={TOKEN}"
    response = requests.get(url)
    data = response.json()

    if data.get("status") != "ok":
        print(f"Lỗi với {name}: {data}")
        return None

    return {
        "location": name,
        "station_name": data["data"]["city"]["name"],
        "aqi": data["data"]["aqi"],
        "timestamp": datetime.now().isoformat()
    }


def save_to_csv(rows):
    file_exists = os.path.exists(CSV_FILE)
    os.makedirs(os.path.dirname(CSV_FILE), exist_ok=True)

    fieldnames = ["location", "station_name", "aqi", "timestamp"]
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