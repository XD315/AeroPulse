import requests
import csv
import os
from datetime import datetime 
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("WAQI_TOKEN")

CITIES = ["ho-chi-minh", "hanoi", "da-nang", "can-tho", "hue"]
CSV_FILE = "data/api_data.csv"

def fetch_city_aqi(city):
    url = f"https://api.waqi.info/feed/{city}/?token={TOKEN}"
    response = requests.get(url)
    data = response.json()

    if data.get("status") != "ok":
        print(f"Lỗi với {city}: {data}")
        return None

    return {
        "city": city,
        "aqi": data["data"]["aqi"],
        "timestamp": datetime.now().isoformat()
    }


def save_to_csv(rows):
    file_exists = os.path.exists(CSV_FILE)
    os.makedirs(os.path.dirname(CSV_FILE), exist_ok=True)

    with open(CSV_FILE, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["city", "aqi", "timestamp"])
        if not file_exists:
            writer.writeheader()
        for row in rows:
            writer.writerow(row)


if __name__ == "__main__":
    results = []
    for city in CITIES:
        result = fetch_city_aqi(city)
        if result:
            results.append(result)
            print(result)

    save_to_csv(results)
    print(f"Đã lưu {len(results)} dòng.")