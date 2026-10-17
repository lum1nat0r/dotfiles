"""Run from the repository root: python3 tests/charge-limit.py."""

import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    'charge_limit', Path(__file__).resolve().parents[1] / 'charge-limit/e14-charge-limit.py',
)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class Battery:
    """Firmware model: start must remain below end; writes may be refused."""
    def __init__(self, limit):
        self.values = {'charge_control_start_threshold': limit - 5,
                       'charge_control_end_threshold': limit}
        self.ignore_end = False
        self.delay = False
        self.settled = True

    def __truediv__(self, name):
        battery = self

        class Threshold:
            def read_text(self):
                if not battery.settled:
                    return '0' if name == 'charge_control_start_threshold' else '100'
                return str(battery.values[name])

            def write_text(self, text):
                value = int(text)
                if name == 'charge_control_end_threshold' and battery.ignore_end:
                    return
                candidate = dict(battery.values, **{name: value})
                if not 0 <= candidate['charge_control_start_threshold'] < candidate['charge_control_end_threshold'] <= 100:
                    raise OSError('Invalid firmware threshold order')
                battery.values = candidate
                battery.settled = not battery.delay

        return Threshold()


class ChargeLimitTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        original = helper.BATTERY, helper.STATE, helper.LOCK
        self.addCleanup(lambda: self.restore(original))
        helper.BATTERY = Battery(100)
        helper.STATE = root / 'state/limit'
        helper.LOCK = root / 'lock'
        sleep = patch.object(helper.time, 'sleep', side_effect=lambda _seconds:
                             setattr(helper.BATTERY, 'settled', True))
        sleep.start()
        self.addCleanup(sleep.stop)

    def restore(self, original):
        helper.BATTERY, helper.STATE, helper.LOCK = original

    def test_lowering_and_raising_preserves_valid_hysteresis(self):
        for old, new in ((100, 70), (70, 100), (80, 75), (75, 80)):
            with self.subTest(old=old, new=new):
                helper.BATTERY = Battery(old)
                helper.apply_limit(new)
                self.assertEqual(helper.BATTERY.values, {
                    'charge_control_start_threshold': new - 5,
                    'charge_control_end_threshold': new,
                })

    def test_only_supported_percentages_cross_privileged_boundary(self):
        for value in ('69', '71', '101', '-1', '80.0', '../80', '80;id', '', '--help'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                helper.main([value])
        self.assertFalse(helper.STATE.exists())
        self.assertEqual(helper.BATTERY.values['charge_control_end_threshold'], 100)
        for limit in range(70, 101, 5):
            self.assertEqual(helper.parse_limit(str(limit)), limit)

    def test_saved_choice_is_restored_after_firmware_reset(self):
        helper.main(['85'])
        self.assertEqual(helper.STATE.read_text(), '85\n')
        helper.BATTERY = Battery(100)
        helper.main(['--restore'])
        self.assertEqual(helper.BATTERY.values['charge_control_end_threshold'], 85)
        self.assertEqual(helper.BATTERY.values['charge_control_start_threshold'], 80)

    def test_delayed_firmware_is_confirmed_before_saving(self):
        helper.BATTERY.delay = True
        helper.main(['85'])
        self.assertEqual(helper.STATE.read_text(), '85\n')
        self.assertEqual(helper.BATTERY.values['charge_control_end_threshold'], 85)

    def test_firmware_refusal_does_not_save_unapplied_choice(self):
        helper.main(['80'])
        helper.BATTERY.ignore_end = True
        with self.assertRaises(OSError):
            helper.main(['70'])
        self.assertEqual(helper.STATE.read_text(), '80\n')

    def test_corrupt_saved_limit_does_not_change_hardware(self):
        helper.STATE.parent.mkdir()
        helper.STATE.write_text('42\n')
        with self.assertRaises(ValueError):
            helper.main(['--restore'])
        self.assertEqual(helper.BATTERY.values['charge_control_end_threshold'], 100)


if __name__ == '__main__':
    unittest.main()
