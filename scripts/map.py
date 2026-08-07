import requests
import os
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("WAQI_TOKEN")

latlngbox = "9.00,105.00,22.00,109.00"

url = f"https://api.waqi.info/map/bounds/?latlng={latlngbox}&token={TOKEN}"
response = requests.get(url)
data = response.json()

print("Status:", data.get("status"))
print("Số trạm tìm được:", len(data.get("data", [])))
print(data)