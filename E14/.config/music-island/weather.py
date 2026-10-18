#!/usr/bin/env python3
"""Local, explicitly selected weather location; Open-Meteo needs no API key."""
import datetime
import http.client
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import urllib.parse
import urllib.request


class WeatherError(Exception):
    pass


def empty(location=''):
    return dict(location=location, temperature=None, code=0, isDay=True, days=[], error='')


def config_path():
    root = os.environ.get('XDG_CONFIG_HOME', '')
    return (Path(root) if root and Path(root).is_absolute() else Path.home() / '.config') / 'music-island/weather-location.json'


def number(value, low, high):
    if type(value) not in (int, float) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError('invalid number')
    return value


def text(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 200 or any(ord(c) < 32 for c in value):
        raise ValueError('invalid text')
    return value.strip()


def location_data(value):
    if not isinstance(value, dict):
        raise ValueError('invalid location')
    return dict(name=text(value.get('name')), region=text(value['region']) if value.get('region') else '',
                latitude=number(value.get('latitude'), -90, 90),
                longitude=number(value.get('longitude'), -180, 180))


def display_location(location):
    return ', '.join(dict.fromkeys(part for part in (location['name'], location['region']) if part))


def request_json(endpoint, params):
    request = urllib.request.Request(endpoint + '?' + urllib.parse.urlencode(params),
                                     headers={'User-Agent': 'MusicIsland/1.0'})
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            data = response.read(1_000_001)
        if len(data) > 1_000_000:
            raise ValueError('response too large')
        result = json.loads(data)
        if not isinstance(result, dict) or result.get('error'):
            raise ValueError('invalid response')
        return result
    except (OSError, ValueError, http.client.HTTPException, RecursionError) as error:
        raise WeatherError('Wetterdienst nicht erreichbar oder ungültige Antwort.') from error


def resolve(query):
    try:
        query = text(query)
    except ValueError as error:
        raise WeatherError('Bitte einen gültigen Ort eingeben.') from error
    result = request_json('https://geocoding-api.open-meteo.com/v1/search',
                          dict(name=query, count=1, language='de', format='json'))
    results = result.get('results', [])
    if results == []:
        raise WeatherError('Ort nicht gefunden. Bitte die Suche präzisieren.')
    try:
        if not isinstance(results, list):
            raise ValueError('invalid results')
        first = results[0]
        if not isinstance(first, dict):
            raise ValueError('invalid result')
        region = ', '.join(dict.fromkeys(text(first[key]) for key in ('admin1', 'country') if first.get(key)))
        return location_data(dict(first, region=region))
    except (ValueError, TypeError, IndexError) as error:
        raise WeatherError('Ungültige Ortsdaten vom Wetterdienst.') from error


def weather_code(value):
    if type(value) is not int or value not in {0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99}:
        raise ValueError('invalid weather code')
    return value


def forecast(location):
    data = request_json('https://api.open-meteo.com/v1/forecast', dict(
        latitude=location['latitude'], longitude=location['longitude'], timezone='auto', forecast_days=5,
        temperature_unit='celsius', current='temperature_2m,weather_code,is_day',
        daily='weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max'))
    try:
        current, daily = data['current'], data['daily']
        today = datetime.datetime.fromisoformat(current['time']).date()
        keys = ('time', 'weather_code', 'temperature_2m_min', 'temperature_2m_max', 'precipitation_probability_max')
        if any(not isinstance(daily[key], list) or len(daily[key]) != 5 for key in keys):
            raise ValueError('invalid daily lengths')
        if type(current['is_day']) is not int or current['is_day'] not in (0, 1):
            raise ValueError('invalid daylight')
        result = empty(display_location(location))
        result.update(temperature=number(current['temperature_2m'], -150, 100),
                      code=weather_code(current['weather_code']), isDay=bool(current['is_day']))
        for index in range(5):
            day = daily['time'][index]
            if day != (today + datetime.timedelta(days=index)).isoformat():
                raise ValueError('invalid forecast dates')
            low = number(daily['temperature_2m_min'][index], -150, 100)
            high = number(daily['temperature_2m_max'][index], low, 100)
            result['days'].append(dict(date=day, code=weather_code(daily['weather_code'][index]),
                                       min=low, max=high,
                                       precipitation=number(daily['precipitation_probability_max'][index], 0, 100)))
        return result
    except (KeyError, TypeError, ValueError, OverflowError) as error:
        raise WeatherError('Unvollständige oder ungültige Wetterdaten.') from error


def save_location(path, location):
    temporary = None
    try:
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as stream:
            temporary = stream.name
            json.dump(location, stream, ensure_ascii=False, allow_nan=False)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except OSError as error:
        raise WeatherError('Der Ort konnte nicht gespeichert werden.') from error
    finally:
        if temporary is not None:
            try:
                os.unlink(temporary)
            except OSError:
                pass


def run(args):
    path = config_path()
    location = None
    error = ''
    try:
        location = location_data(json.loads(path.read_text(encoding='utf-8')))
    except FileNotFoundError:
        pass
    except (OSError, ValueError, TypeError, RecursionError):
        error = 'Gespeicherter Ort ist nicht lesbar. Bitte den Ort erneut eingeben.'
    if args:
        if len(args) != 2 or args[0] != '--set-location':
            error = 'Aufruf: weather.py [--set-location ORT]'
        else:
            try:
                candidate = resolve(args[1])
                save_location(path, candidate)
                location, error = candidate, ''
            except WeatherError as failure:
                error = str(failure)
    result = empty(display_location(location) if location else '')
    if location:
        try:
            result = forecast(location)
        except WeatherError as failure:
            error = ' '.join(filter(None, (error, str(failure))))
    result['error'] = error
    return result


def main(args=None):
    print(json.dumps(run(sys.argv[1:] if args is None else args), ensure_ascii=False, allow_nan=False))


if __name__ == '__main__':
    main()
