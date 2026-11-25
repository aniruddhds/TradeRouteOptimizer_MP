import unittest

from fastapi.testclient import TestClient

from backend.app.main import app


REQUEST = {
    "depot": {"name": "Hub", "location": {"lat": 12.9352, "lng": 77.6245}},
    "stops": [
        {
            "id": "S1",
            "name": "Indiranagar",
            "location": {"lat": 12.9784, "lng": 77.6408},
            "load_kg": 120,
            "window_start": "09:00",
            "window_end": "11:30",
        },
        {
            "id": "S2",
            "name": "Whitefield",
            "location": {"lat": 12.9698, "lng": 77.75},
            "load_kg": 200,
            "window_start": "10:00",
            "window_end": "13:00",
        },
    ],
    "vehicle": {"type": "van", "capacity_kg": 800},
    "departure_time": "09:00",
    "traffic": "moderate",
}


class RouteApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.client.__enter__()
        app.state.optimizer = None
        app.state.model_checkpoint = None

    def tearDown(self) -> None:
        self.client.__exit__(None, None, None)

    def test_health_matches_frontend_contract_without_model(self) -> None:
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "ok", "model_loaded": False, "model_checkpoint": None},
        )

    def test_compare_returns_baseline_and_honest_unavailable_model(self) -> None:
        response = self.client.post("/api/routes/compare", json=REQUEST)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["mode"], "unavailable")
        self.assertIsNone(body["optimized"])
        self.assertEqual([item["stop_id"] for item in body["baseline"]["sequence"]], ["S1", "S2"])
        self.assertEqual(len(body["baseline"]["geometry"]), 4)
        self.assertEqual(body["emission_assumptions"]["kg_co2_per_km"], 0.25)

    def test_compare_rejects_invalid_coordinates(self) -> None:
        invalid_request = {**REQUEST, "depot": {"name": "Hub", "location": {"lat": 120, "lng": 0}}}

        response = self.client.post("/api/routes/compare", json=invalid_request)

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
