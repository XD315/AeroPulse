import requests
import os
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("WAQI_TOKEN")

latlngbox = "10.65,106.55,10.90,106.80"

url = f"https://api.waqi.info/map/bounds/?latlng={latlngbox}&token={TOKEN}"
response = requests.get(url)
data = response.json()

print("Status:", data.get("status"))
print("Số trạm tìm được:", len(data.get("data", [])))
print(data)