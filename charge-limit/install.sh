#!/bin/sh
set -eu
[ "$(id -u)" -eq 0 ] || { echo 'Als root ausführen.' >&2; exit 1; }
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install -d -m 755 /usr/local/libexec /etc/systemd/system /etc/polkit-1/rules.d
install -o root -g root -m 755 "$source_dir/e14-charge-limit.py" /usr/local/libexec/e14-charge-limit
install -o root -g root -m 644 "$source_dir/e14-charge-limit.service" /etc/systemd/system/e14-charge-limit.service
install -o root -g root -m 644 "$source_dir/49-e14-charge-limit.rules" /etc/polkit-1/rules.d/49-e14-charge-limit.rules
systemctl daemon-reload
systemctl enable --now e14-charge-limit.service
