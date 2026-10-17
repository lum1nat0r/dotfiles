#!/usr/bin/env bash
if ! command -v swaync-client >/dev/null 2>&1; then
  printf '{"text":"󰂚","tooltip":"swaync not installed"}\n'; exit 0
fi
count=$(swaync-client -c 2>/dev/null) || count=0
[[ "$count" =~ ^[0-9]+$ ]] || count=0
if [[ "$count" -gt 0 ]]; then
  printf '{"text":"󰂚 %s","tooltip":"%s notifications"}\n' "$count" "$count"
else
  printf '{"text":"󰂜","tooltip":"No notifications"}\n'
fi
