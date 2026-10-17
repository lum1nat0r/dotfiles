#!/usr/bin/env python3
"""Read Spotify/MPRIS state and cache cover artwork without extra Python dependencies."""
import json, subprocess, pathlib, hashlib, urllib.request, urllib.parse, os

def player(*args):
    try:
        return subprocess.check_output(['playerctl', '-p', 'spotify', *args], stderr=subprocess.DEVNULL, timeout=2).decode().strip()
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        return ''

status = player('status')
if not status:
    print(json.dumps({'visible': False})); raise SystemExit
fields = player('metadata', '--format', '{{title}}\n{{artist}}\n{{mpris:artUrl}}\n{{mpris:length}}').splitlines()
fields += [''] * (4-len(fields))
title, artist, art, duration = fields[:4]
cache = pathlib.Path(os.environ.get('XDG_CACHE_HOME', pathlib.Path.home()/'.cache'))/'music-island'
cache.mkdir(parents=True, exist_ok=True)
cover = ''
if art:
    try:
        parsed = urllib.parse.urlparse(art)
        if parsed.scheme in ('http','https'):
            dest = cache/(hashlib.sha256(art.encode()).hexdigest()+'.jpg')
            if not dest.exists():
                req=urllib.request.Request(art,headers={'User-Agent':'MusicIsland/1.0'})
                with urllib.request.urlopen(req,timeout=2) as resp:
                    data=resp.read(3_000_001)
                if len(data)<=3_000_000:
                    dest.write_bytes(data)
            if dest.exists(): cover=str(dest)
        elif parsed.scheme=='file':
            candidate=urllib.parse.unquote(parsed.path)
            if pathlib.Path(candidate).is_file(): cover=candidate
    except (OSError,ValueError): pass
try: length=int(duration)//1_000_000
except ValueError: length=0
try: position=float(player('position'))
except ValueError: position=0
print(json.dumps({'visible':True,'playing':status=='Playing','title':title or 'Unknown track','artist':artist or 'Unknown artist','cover':cover,'duration':length,'position':position}))
