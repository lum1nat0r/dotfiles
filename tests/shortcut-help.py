"""Run from the repository root: python3 tests/shortcut-help.py."""

import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "E14/.config/hypr/scripts/shortcut-help.py"
spec = importlib.util.spec_from_file_location("shortcut_help", SCRIPT)
help_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(help_module)


class AliasTest(unittest.TestCase):
    def test_live_shell_preserves_values_and_uses_final_alias_definitions(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "plugin.zsh").write_text("alias from-plugin='printf plugin'\n")
            (root / ".zshrc").write_text(r'''
print 'startup chatter'
source "$ZDOTDIR/plugin.zsh"
alias replaced='old command'
alias replaced='printf "new=value"'
alias removed='gone'
unalias removed
alias literal='printf "%s\n" "$(touch $HOME/should-not-exist)"'
alias multiline=$'printf first\nprintf second'
alias -g PIPE='| cat'
alias -s log='less'
typeset -gA alias_descriptions
alias_descriptions[replaced]='Neue Beschreibung mit Umlauten: ändern'
''')
            with patch.dict(os.environ, HOME=directory, ZDOTDIR=directory):
                rows = help_module.alias_rows()
            entries = {(category, name): action for category, name, action in rows}
            self.assertEqual(entries[("Beschriebene Aliase", "replaced")],
                             'Neue Beschreibung mit Umlauten: ändern\nprintf "new=value"')
            self.assertEqual(entries[("Zsh-Aliase", "from-plugin")], "printf plugin")
            self.assertEqual(entries[("Zsh-Aliase", "literal")],
                             'printf "%s\\n" "$(touch $HOME/should-not-exist)"')
            self.assertEqual(entries[("Zsh-Aliase", "multiline")], "printf first\nprintf second")
            self.assertEqual(entries[("Globale Aliase", "PIPE")], "| cat")
            self.assertEqual(entries[("Suffix-Aliase", "log")], "less")
            self.assertNotIn("removed", [name for _, name, _ in rows])
            self.assertFalse((root / "should-not-exist").exists())

    def test_failed_shell_is_not_presented_as_an_empty_alias_list(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / ".zshrc").write_text("exit 3\n")
            with patch.dict(os.environ, HOME=directory, ZDOTDIR=directory):
                with self.assertRaises(subprocess.CalledProcessError):
                    help_module.alias_rows()


if __name__ == "__main__":
    unittest.main()
