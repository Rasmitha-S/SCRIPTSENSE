import os
import sys
import requests

base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

BASE_URL = "http://127.0.0.1:8000"

class ApiClient:
    def __init__(self):
        self.is_live = False
        try:
            r = requests.get(f"{BASE_URL}/", timeout=0.8)
            if r.status_code == 200:
                self.is_live = True
        except Exception:
            self.is_live = False

        if not self.is_live:
            from fastapi.testclient import TestClient
            from main import app
            self._client = TestClient(app)
        else:
            self._client = requests

    def _normalize_url(self, url: str) -> str:
        if not self.is_live and url.startswith(BASE_URL):
            return url.replace(BASE_URL, "")
        return url

    def get(self, url, **kwargs):
        url = self._normalize_url(url)
        return self._client.get(url, **kwargs)

    def post(self, url, **kwargs):
        url = self._normalize_url(url)
        return self._client.post(url, **kwargs)

    def put(self, url, **kwargs):
        url = self._normalize_url(url)
        return self._client.put(url, **kwargs)

    def delete(self, url, **kwargs):
        url = self._normalize_url(url)
        return self._client.delete(url, **kwargs)

def get_client():
    return ApiClient()
