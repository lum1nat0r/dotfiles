"""Run from the repository root: python3 -B tests/weather.py."""
import contextlib
import copy
import datetime
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location(
    'weather', Path(__file__).resolve().parents[1] / 'E14/.config/music-island/weather.py',
)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class WeatherTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        environment = patch.dict(os.environ, {'XDG_CONFIG_HOME': temporary.name})
        environment.start()
        self.addCleanup(environment.stop)
        self.path = Path(temporary.name) / 'music-island/weather-location.json'
        self.location = dict(name='Testort', region='Testregion', latitude=0, longitude=0)
        self.payload = {
            'current': {'time': '2026-10-19T00:15', 'temperature_2m': 0, 'weather_code': 0, 'is_day': 0},
            'daily': {
                'time': [(datetime.date(2026, 10, 19) + datetime.timedelta(days=i)).isoformat() for i in range(5)],
                'weather_code': [0, 3, 61, 71, 95],
                'temperature_2m_min': [0, -2, 3, -5, 8],
                'temperature_2m_max': [0, 4, 9, 1, 15],
                'precipitation_probability_max': [0, 10, 80, 75, 100],
            },
        }

    def store(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.location), encoding='utf-8')
        return self.path.read_bytes()

    def http(self, payload):
        return patch.object(helper.urllib.request, 'urlopen', return_value=io.BytesIO(json.dumps(payload).encode()))

    def test_unconfigured_is_blank_and_never_contacts_network(self):
        with patch.object(helper.urllib.request, 'urlopen') as network:
            self.assertEqual(helper.run([]), dict(location='', temperature=None, code=0, isDay=True, days=[], error=''))
        network.assert_not_called()
        self.assertFalse(self.path.exists())

    def test_exact_five_local_dates_and_zero_values_survive(self):
        self.store()
        with self.http(self.payload):
            result = helper.run([])
        self.assertEqual(result['location'], 'Testort, Testregion')
        self.assertEqual(result['temperature'], 0)
        self.assertEqual(result['code'], 0)
        self.assertFalse(result['isDay'])
        self.assertEqual(result['error'], '')
        self.assertEqual(result['days'], [
            dict(date=date, code=code, min=low, max=high, precipitation=rain)
            for date, code, low, high, rain in zip(*[self.payload['daily'][key] for key in (
                'time', 'weather_code', 'temperature_2m_min', 'temperature_2m_max', 'precipitation_probability_max')])
        ])

    def test_set_location_resolves_in_german_and_persists_private_coordinates(self):
        geocoding = dict(results=[dict(name='Neustadt', admin1='Testland', country='Beispielland', latitude=12.5, longitude=-30)])
        responses = [io.BytesIO(json.dumps(data).encode()) for data in (geocoding, self.payload)]
        with patch.object(helper.urllib.request, 'urlopen', side_effect=responses):
            result = helper.run(['--set-location', 'Neustadt'])
        saved = json.loads(self.path.read_text(encoding='utf-8'))
        self.assertEqual(saved, dict(name='Neustadt', region='Testland, Beispielland', latitude=12.5, longitude=-30))
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(result['location'], 'Neustadt, Testland, Beispielland')
        self.assertEqual(result['error'], '')

    def test_unknown_city_preserves_setting_and_displays_previous_weather(self):
        original = self.store()
        responses = [io.BytesIO(json.dumps(data).encode()) for data in ({}, self.payload)]
        with patch.object(helper.urllib.request, 'urlopen', side_effect=responses):
            result = helper.run(['--set-location', 'Unbekannt'])
        self.assertEqual(self.path.read_bytes(), original)
        self.assertEqual(result['location'], 'Testort, Testregion')
        self.assertEqual(result['temperature'], 0)
        self.assertEqual(len(result['days']), 5)
        self.assertIn('Ort nicht gefunden', result['error'])

    def test_offline_and_invalid_json_keep_config_and_serialize(self):
        original = self.store()
        for response in (urllib.error.URLError('offline'), io.BytesIO(b'not json'),
                         io.BytesIO(b'[]'), io.BytesIO(b'{"error":true}')):
            with self.subTest(response=response):
                kwargs = {'side_effect': response} if isinstance(response, Exception) else {'return_value': response}
                with patch.object(helper.urllib.request, 'urlopen', **kwargs):
                    output = io.StringIO()
                    with contextlib.redirect_stdout(output):
                        helper.main([])
                result = json.loads(output.getvalue())
                self.assertTrue(result['error'])
                self.assertEqual(result['location'], 'Testort, Testregion')
                self.assertIsNone(result['temperature'])
                self.assertEqual(result['days'], [])
                self.assertEqual(self.path.read_bytes(), original)

    def test_invalid_forecast_never_emits_partial_or_nonfinite_weather(self):
        self.store()
        invalid = []
        for key, value in [('weather_code', [0]), ('temperature_2m_min', [None] * 5),
                           ('temperature_2m_max', [-100] * 5), ('precipitation_probability_max', [101] * 5),
                           ('time', ['2026-10-18'] * 5)]:
            payload = copy.deepcopy(self.payload)
            payload['daily'][key] = value
            invalid.append(payload)
        for key, value in [('temperature_2m', float('nan')), ('weather_code', False), ('is_day', 2), ('time', None)]:
            payload = copy.deepcopy(self.payload)
            payload['current'][key] = value
            invalid.append(payload)
        invalid.extend([{}, {'current': [], 'daily': {}}])
        for payload in invalid:
            with self.subTest(payload=payload), self.http(payload):
                result = helper.run([])
                self.assertTrue(result['error'])
                self.assertIsNone(result['temperature'])
                self.assertEqual(result['days'], [])
                json.dumps(result, allow_nan=False)

    def test_invalid_geocoding_and_failed_save_preserve_previous_location(self):
        original = self.store()
        for results in (None, {}, [None], [{'name': 'Broken', 'latitude': 200, 'longitude': 0}]):
            responses = [io.BytesIO(json.dumps(data).encode()) for data in (dict(results=results), self.payload)]
            with self.subTest(results=results), patch.object(helper.urllib.request, 'urlopen', side_effect=responses):
                result = helper.run(['--set-location', 'Broken'])
            self.assertTrue(result['error'])
            self.assertEqual(result['location'], 'Testort, Testregion')
            self.assertEqual(self.path.read_bytes(), original)
        responses = [io.BytesIO(json.dumps(data).encode()) for data in (dict(results=[self.location]), self.payload)]
        with patch.object(helper.urllib.request, 'urlopen', side_effect=responses), patch.object(helper.os, 'replace', side_effect=PermissionError):
            result = helper.run(['--set-location', 'Another'])
        self.assertIn('nicht gespeichert', result['error'])
        self.assertEqual(self.path.read_bytes(), original)
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_successful_location_selection_survives_forecast_outage(self):
        self.store()
        candidate = dict(name='Neuer Ort', latitude=42, longitude=7)
        responses = [io.BytesIO(json.dumps(dict(results=[candidate])).encode()),
                     urllib.error.URLError('offline')]
        with patch.object(helper.urllib.request, 'urlopen', side_effect=responses):
            result = helper.run(['--set-location', 'Neuer Ort'])
        self.assertEqual(json.loads(self.path.read_text())['name'], 'Neuer Ort')
        self.assertEqual(result['location'], 'Neuer Ort')
        self.assertIsNone(result['temperature'])
        self.assertEqual(result['days'], [])
        self.assertTrue(result['error'])

    def test_corrupt_saved_config_is_not_overwritten_or_used_for_network(self):
        self.path.parent.mkdir(parents=True)
        self.path.write_text('{broken', encoding='utf-8')
        with patch.object(helper.urllib.request, 'urlopen') as network:
            result = helper.run([])
        network.assert_not_called()
        self.assertTrue(result['error'])
        self.assertEqual(result['location'], '')
        self.assertEqual(self.path.read_text(), '{broken')

    def test_invalid_query_does_not_contact_network_without_old_location(self):
        for query in ('', '   ', 'x\nInjected', 'x' * 201):
            with self.subTest(query=query), patch.object(helper.urllib.request, 'urlopen') as network:
                result = helper.run(['--set-location', query])
                network.assert_not_called()
                self.assertTrue(result['error'])
                self.assertFalse(self.path.exists())


if __name__ == '__main__':
    unittest.main()
