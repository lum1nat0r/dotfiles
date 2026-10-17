#!/usr/bin/python3 -I
"""Root-owned E14 charge limit helper; no user-supplied paths or commands."""

import fcntl
from pathlib import Path
import sys
import time

BATTERY = Path('/sys/class/power_supply/BAT0')
STATE = Path('/var/lib/e14-charge-limit/limit')
LOCK = Path('/run/e14-charge-limit.lock')
LIMITS = tuple(range(70, 101, 5))


def parse_limit(value):
    if value not in tuple(map(str, LIMITS)):
        raise ValueError('Ladegrenze muss 70–100 % in 5er-Schritten sein')
    return int(value)


def apply_limit(limit):
    start = BATTERY / 'charge_control_start_threshold'
    end = BATTERY / 'charge_control_end_threshold'
    # Lower the start first when reducing the limit; raise the end first otherwise.
    values = [(start, limit - 5), (end, limit)]
    if int(start.read_text()) < limit:
        values.reverse()
    for path, value in values:
        path.write_text(f'{value}\n')
    # E14 EC readback briefly reverts to 0/100 for ~2.3 s after a threshold write.
    time.sleep(3)
    if int(start.read_text()) != limit - 5 or int(end.read_text()) != limit:
        raise OSError('Firmware hat die Ladegrenze nicht übernommen')


def main(args):
    if len(args) != 1:
        raise ValueError('Aufruf: e14-charge-limit {70|75|80|85|90|95|100|--restore}')
    restoring = args[0] == '--restore'
    limit = None if restoring else parse_limit(args[0])
    with LOCK.open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if restoring:
            limit = parse_limit(STATE.read_text().strip()) if STATE.exists() else 80
        apply_limit(limit)
        STATE.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
        temporary = STATE.with_suffix('.tmp')
        temporary.write_text(f'{limit}\n')
        temporary.replace(STATE)
    print(limit)


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except (OSError, ValueError) as error:
        print(f'Ladegrenze: {error}', file=sys.stderr)
        sys.exit(1)
