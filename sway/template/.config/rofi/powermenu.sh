#!/usr/bin/env bash

# Rofi Power Menu for Sway
# Adapted from existing wofi powermenu

# Current Theme
dir="$HOME/.config/rofi"
theme='powermenu'

# CMDs
uptime="`uptime -p | sed -e 's/up //g'`"
host=`cat /etc/hostname`

# Options
shutdown='   Shutdown'
reboot='   Restart'
lock='   Lock'
suspend='   Suspend' 
hibernate='   Hibernate'
logout='   Logout'
yes='   Yes'
no='   No'

# Rofi CMD
rofi_cmd() {
	rofi -dmenu \
		-p "Power Menu" \
		-mesg "Uptime: $uptime" \
		-theme ${dir}/${theme}.rasi \
		-show-icons \
		-kb-row-up Up,Control+k,Shift+Tab,Shift+ISO_Left_Tab \
		-kb-row-down Down,Control+j \
		-kb-accept-entry Return,KP_Enter \
		-kb-remove-to-eol Control+Shift+e \
		-kb-mode-next Shift+Right,Control+Tab \
		-kb-mode-previous Shift+Left,Control+Shift+Tab \
		-kb-remove-char-back BackSpace
}

# Confirmation CMD
confirm_cmd() {
	rofi -theme-str 'window {location: center; anchor: center; fullscreen: false; width: 350px;}' \
		-theme-str 'mainbox {children: [ "message", "listview" ];}' \
		-theme-str 'listview {columns: 2; lines: 1;}' \
		-theme-str 'element-text {horizontal-align: 0.5;}' \
		-theme-str 'textbox {horizontal-align: 0.5;}' \
		-dmenu \
		-p 'Confirmation' \
		-mesg 'Are you Sure?' \
		-theme ${dir}/${theme}.rasi
}

# Ask for confirmation
confirm_exit() {
	echo -e "$yes\n$no" | confirm_cmd
}

# Pass variables to rofi dmenu
run_rofi() {
	echo -e "$lock\n$logout\n$suspend\n$hibernate\n$reboot\n$shutdown" | rofi_cmd
}

# Execute Command
run_cmd() {
	selected="$(confirm_exit)"
	if [[ "$selected" == "$yes" ]]; then
		if [[ $1 == '--shutdown' ]]; then
			systemctl poweroff
		elif [[ $1 == '--reboot' ]]; then
			systemctl reboot
		elif [[ $1 == '--suspend' ]]; then
			systemctl suspend
		elif [[ $1 == '--hibernate' ]]; then
			systemctl hibernate
		elif [[ $1 == '--logout' ]]; then
			swaymsg exit
		fi
	else
		exit 0
	fi
}

# Actions
chosen="$(run_rofi)"
case ${chosen} in
    $shutdown)
		run_cmd --shutdown
        ;;
    $reboot)
		run_cmd --reboot
        ;;
    $lock)
		if [[ -x '/usr/bin/swaylock' ]]; then
			swaylock
		elif [[ -x '/usr/bin/i3lock' ]]; then
			i3lock
		fi
        ;;
    $suspend)
		run_cmd --suspend
        ;;
    $hibernate)
		run_cmd --hibernate
        ;;
    $logout)
		run_cmd --logout
        ;;
esac