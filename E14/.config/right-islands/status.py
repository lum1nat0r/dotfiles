#!/usr/bin/env python3
import json, subprocess, pathlib

def run(*cmd):
    try: return subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=1.5, text=True).strip()
    except (OSError, subprocess.SubprocessError): return ''

def read(p):
    try: return pathlib.Path(p).read_text().strip()
    except OSError: return ''

def percent(x):
    try: return max(0,min(100,int(float(x))))
    except ValueError: return 0

# CPU load via /proc/stat between invocations, cache last counters
cache=pathlib.Path('/tmp') / f'right-islands-cpu-{__import__("os").getuid()}'
parts=read('/proc/stat').splitlines()[0].split()[1:]
vals=[int(x) for x in parts]
total=sum(vals); idle=vals[3]+vals[4]
try:
    a,b=map(int,read(cache).split()); cpu=round(100*(1-(idle-b)/(total-a))) if total>a else 0
except (ValueError, ZeroDivisionError): cpu=0
try: cache.write_text(f'{total} {idle}')
except OSError: pass
mem={}
for line in read('/proc/meminfo').splitlines():
    k,_,v=line.partition(':')
    try: mem[k]=int(v.strip().split()[0])
    except (ValueError,IndexError): pass
mt=mem.get('MemTotal',1); used=mt-mem.get('MemAvailable',0)
ram=round(100*used/mt)
# hwmon: prefer CPU temp sensor labels, otherwise thermal_zone
candidates=[]
for p in pathlib.Path('/sys/class/hwmon').glob('hwmon*'):
    name=read(p/'name').lower()
    for inp in p.glob('temp*_input'):
        label=read(inp.with_name(inp.name.replace('_input','_label'))).lower()
        raw=read(inp)
        try: temp=int(raw)/1000
        except ValueError: continue
        if 0 < temp < 120:
            priority=0 if any(x in name+' '+label for x in ('coretemp','k10temp','tctl','package id','cpu')) else 1
            candidates.append((priority,temp))
if not candidates:
    for p in pathlib.Path('/sys/class/thermal').glob('thermal_zone*/temp'):
        try: candidates.append((2,int(read(p))/1000))
        except ValueError: pass
temp=round(sorted(candidates)[0][1]) if candidates else None
bats=list(pathlib.Path('/sys/class/power_supply').glob('BAT*'))
battery=percent(read(bats[0]/'capacity')) if bats else None
charging=read(bats[0]/'status').lower() in ('charging','full') if bats else False
wifi=run('nmcli','-t','-f','WIFI','general').lower()=='enabled'
# Read NetworkManager's cached access points; status updates must not trigger scans.
ssid=run('nmcli','-t','-f','ACTIVE,SSID','dev','wifi','--rescan','no').splitlines()
ssid=next((s.split(':',1)[1] for s in ssid if s.startswith('yes:')), '')
bt=run('bluetoothctl','show')
bt_on='Powered: yes' in bt
print(json.dumps({'cpu':cpu,'ram':ram,'temp':temp,'battery':battery,'charging':charging,'wifi':wifi,'ssid':ssid,'bluetooth':bt_on}))
