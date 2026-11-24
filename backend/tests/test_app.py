import json
import os
import sys
import unittest
from unittest.mock import patch

import pandas as pd

# Thêm thư mục gốc và backend vào sys.path để import trực tiếp
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
SCRIPTS_DIR = os.path.join(ROOT_DIR, "scripts")
for p in (BACKEND_DIR, SCRIPTS_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

import app as backend_app
import fetch_api


def make_sample_df():
    rows = []
    for i in range(15):
        rows.append({
            "location": "hanoi",
            "station_name": "Hanoi US Embassy",
            "aqi": 220 if i == 0 else 55 + (i % 5),
            "pm25": 150.0 if i == 0 else 18.0 + (i % 4),
            "pm10": 180.0 if i == 0 else 30.0,
            "temperature": 26.0,
            "humidity": 75.0,
            "wind": 1.2 if i == 0 else 2.5,
            "timestamp": f"2026-11-{(i % 9) + 10:02d}T08:00:00+07:00",
        })
        rows.append({
            "location": "hue",
            "station_name": "Hue Station",
            "aqi": 135 if i == 0 else 25 + (i % 3),
            "pm25": 65.0 if i == 0 else 10.0,
            "pm10": 80.0 if i == 0 else 18.0,
            "temperature": 24.0,
            "humidity": 82.0,
            "wind": 1.0 if i == 0 else 3.0,
            "timestamp": f"2026-11-{(i % 9) + 10:02d}T08:00:00+07:00",
        })
    return pd.DataFrame(rows)


class BackendTests(unittest.TestCase):
    def setUp(self):
        backend_app.app.testing = True
        self.client = backend_app.app.test_client()
        backend_app._cache["data"] = None
        backend_app._cache["timestamp"] = None
        backend_app._data_cache["df"] = None
        backend_app._data_cache["timestamp"] = None
        backend_app._report_cache.clear()

    def test_aqi_to_status(self):
        self.assertEqual(backend_app.aqi_to_status(35), ("Tốt", "success"))
        self.assertEqual(backend_app.aqi_to_status(85), ("Trung bình", "warning"))
        self.assertEqual(backend_app.aqi_to_status(120), ("Kém", "warning"))
        self.assertEqual(backend_app.aqi_to_status(175), ("Xấu", "danger"))
        self.assertEqual(backend_app.aqi_to_status(250), ("Nguy hiểm", "danger"))

    def test_health_endpoint(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("status", data)
        self.assertIn("cache", data)

    def test_chart_empty_returns_consistent_object(self):
        with patch.object(backend_app, "load_clean_data", return_value=make_sample_df()):
            res = self.client.get("/api/chart?start=2099-01-01&end=2099-01-02")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsInstance(data, dict)
        self.assertEqual(data["rows"], [])
        self.assertEqual(data["locations"], [])

    def test_locations_include_coords(self):
        with patch.object(backend_app, "load_clean_data", return_value=make_sample_df()):
            res = self.client.get("/api/locations")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(any(item["value"] == "hanoi" and "lat" in item and "lon" in item for item in data))

    def test_anomalies_per_location_and_no_gemini_crash(self):
        with patch.object(backend_app, "load_clean_data", return_value=make_sample_df()), \
             patch.object(backend_app, "gemini_client", None):
            res = self.client.get("/api/anomalies?refresh=true")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsInstance(data, list)
        self.assertTrue(all(item["aqi"] > 100 for item in data))

    def test_weather_zero_degree_formatting(self):
        fake_open_meteo = {
            "current": {
                "temperature_2m": 0,
                "apparent_temperature": -1,
                "relative_humidity_2m": 80,
                "wind_speed_10m": 3.0,
                "wind_direction_10m": 45,
                "surface_pressure": 1015,
                "uv_index": 2,
                "cloud_cover": 50,
                "precipitation": 0,
                "weather_code": 0,
                "time": "2026-11-24T08:00",
            },
            "hourly": {
                "time": ["2026-11-24T08:00", "2026-11-24T09:00"],
                "temperature_2m": [0, 1],
                "weather_code": [0, 95],
                "wind_speed_10m": [3, 4],
                "wind_direction_10m": [45, 45],
                "relative_humidity_2m": [80, 78],
                "precipitation": [0, 0],
                "cloud_cover": [50, 60],
                "visibility": [10000, 9000],
            },
            "daily": {
                "time": ["2026-11-24"],
                "weather_code": [0],
                "temperature_2m_max": [0],
                "temperature_2m_min": [0],
                "precipitation_sum": [0],
                "wind_speed_10m_max": [4],
                "uv_index_max": [2],
                "sunrise": ["2026-11-24T06:00"],
                "sunset": ["2026-11-24T17:15"],
                "precipitation_probability_max": [10],
            },
        }

        class FakeResp:
            def raise_for_status(self):
                pass
            def json(self):
                return fake_open_meteo

        backend_app._weather_cache.clear()
        with patch.object(backend_app.http_requests, "get", return_value=FakeResp()):
            res = self.client.get("/api/weather?location=hanoi")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["daily"][0]["temp_label"], "0°/0°")
        self.assertEqual(len(data["alerts"]), 1)
        self.assertEqual(data["alerts"][0]["time"], "09:00")

    def test_feedback_endpoint(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            fake_app_file = os.path.join(tmpdir, "backend", "app.py")
            os.makedirs(os.path.dirname(fake_app_file), exist_ok=True)
            with patch.object(backend_app, "__file__", fake_app_file):
                bad = self.client.post("/api/feedback", json={"name": "", "message": "hi"})
                self.assertEqual(bad.status_code, 400)

                ok = self.client.post("/api/feedback", json={"name": "Phong", "message": "Great UI"})
                self.assertEqual(ok.status_code, 201)
                self.assertTrue(ok.get_json()["ok"])

                with patch.dict(os.environ, {"SMTP_USER": "bot@gmail.com", "SMTP_PASS": "app-pass", "FEEDBACK_TO_EMAIL": "owner@gmail.com"}), \
                     patch("smtplib.SMTP") as mock_smtp:
                    res = self.client.post("/api/feedback", json={"name": "An", "message": "Test SMTP"})
                    self.assertEqual(res.status_code, 201)
                    mock_smtp.return_value.__enter__.return_value.send_message.assert_called_once()


class FetchScriptTests(unittest.TestCase):
    def test_distance_km_zero(self):
        self.assertAlmostEqual(fetch_api.distance_km(21.0, 105.8, 21.0, 105.8), 0.0, places=5)

    def test_fetch_handles_request_error(self):
        with patch.object(fetch_api.requests, "get", side_effect=RuntimeError("network down")):
            self.assertIsNone(fetch_api.fetch_aqi_by_location("hanoi", 21.0, 105.8))


if __name__ == "__main__":
    unittest.main()
