"""Unit tests for todo_check_ready.py (stdlib unittest, no network)."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import todo_check_ready as mod  # noqa: E402


SAMPLE = """# My project TODO

Some intro prose.

## Backlog
- [ ] first task
- [ ] second task
- third loose item
* star item
"""


class TaskCountingTests(unittest.TestCase):
    def test_counts_list_items_and_headings_excluding_title(self):
        # "## Backlog" heading + 4 list items = 5
        self.assertEqual(mod.count_task_units(SAMPLE), 5)

    def test_empty_text_is_zero(self):
        self.assertEqual(mod.count_task_units(""), 0)

    def test_prose_only_is_zero(self):
        self.assertEqual(mod.count_task_units("# Title\n\njust words here\n"), 0)


class ReadinessThresholdTests(unittest.TestCase):
    def test_below_threshold(self):
        text = "# T\n- [ ] a\n- [ ] b\n"  # 2 units
        self.assertFalse(mod.is_ready(text, 3))

    def test_at_threshold(self):
        text = "# T\n- [ ] a\n- [ ] b\n- [ ] c\n"  # 3 units
        self.assertTrue(mod.is_ready(text, 3))

    def test_above_threshold(self):
        self.assertTrue(mod.is_ready(SAMPLE, 3))

    def test_empty_never_ready(self):
        self.assertFalse(mod.is_ready("   \n", 1))


class DebounceTests(unittest.TestCase):
    def test_notify_when_no_prior_state(self):
        self.assertTrue(mod.should_notify(SAMPLE, {}))

    def test_no_renotify_on_identical_content(self):
        state = {"hash": mod.content_hash(SAMPLE)}
        self.assertFalse(mod.should_notify(SAMPLE, state))

    def test_renotify_on_changed_content(self):
        state = {"hash": mod.content_hash(SAMPLE)}
        self.assertTrue(mod.should_notify(SAMPLE + "\n- [ ] more\n", state))

    def test_state_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = mod.state_path(Path(tmp), Path("/some/project"))
            mod.save_state(path, "abc123")
            loaded = mod.load_state(path)
            self.assertEqual(loaded["hash"], "abc123")
            self.assertIn("notified_at", loaded)


class BuildMessageTests(unittest.TestCase):
    def _write_todo(self, tmp):
        project = Path(tmp) / "proj"
        (project / "docs").mkdir(parents=True)
        todo = project / "docs" / "TODO.md"
        todo.write_text(SAMPLE, encoding="utf-8")
        return project, todo

    def test_contains_copy_paste_command_with_absolute_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            project, todo = self._write_todo(tmp)
            msg = mod.build_message(project, todo)
            project_abs = str(project.resolve())
            self.assertTrue(Path(project_abs).is_absolute())
            self.assertIn(f'cd {project_abs} && claude "{mod.ADOPT_PROMPT}"', msg)

    def test_contains_percent_encoded_custom_scheme_url(self):
        with tempfile.TemporaryDirectory() as tmp:
            project, todo = self._write_todo(tmp)
            msg = mod.build_message(project, todo)
            self.assertIn("claude-code://open?cwd=", msg)
            # the prompt has spaces and a slash; both must be percent-encoded
            self.assertIn("prompt=%2Fralphex%3Aralphex-adopt%20docs%2FTODO.md", msg)
            # a raw space from the prompt must not leak into the URL
            self.assertNotIn("prompt=/ralphex:ralphex-adopt docs/TODO.md", msg)

    def test_mentions_task_count_and_todo_prefix_and_ralphex(self):
        with tempfile.TemporaryDirectory() as tmp:
            project, todo = self._write_todo(tmp)
            msg = mod.build_message(project, todo)
            self.assertIn(str(mod.count_task_units(SAMPLE)), msg)
            self.assertIn("todo:", msg)
            self.assertIn("/ralphex:ralphex", msg)

    def test_both_link_forms_present(self):
        with tempfile.TemporaryDirectory() as tmp:
            project, todo = self._write_todo(tmp)
            msg = mod.build_message(project, todo)
            self.assertIn("claude ", msg)  # copy-paste command form
            self.assertIn("claude-code://", msg)  # custom-scheme URL form


class RunTests(unittest.TestCase):
    def _project(self, tmp, todo_text):
        project = Path(tmp) / "proj"
        (project / "docs").mkdir(parents=True)
        (project / "docs" / "TODO.md").write_text(todo_text, encoding="utf-8")
        return project

    def _config(self, project, tmp, **over):
        cfg = {
            "todo_path": "docs/TODO.md",
            "project_dir": str(project),
            "min_tasks": 3,
            "state_dir": str(Path(tmp) / "state"),
            "agent": "codex",
            "launch_agent": False,
        }
        cfg.update(over)
        return cfg

    def test_injected_sender_receives_message(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = self._project(tmp, SAMPLE)
            captured = {}

            def sender(msg):
                captured["msg"] = msg
                return True

            result = mod.run(self._config(project, tmp), sender=sender)
            self.assertTrue(result["ready"])
            self.assertTrue(result["notified"])
            self.assertIn("docs/TODO.md", captured["msg"])

    def test_not_ready_does_not_notify(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = self._project(tmp, "# T\n- [ ] only one\n")
            calls = []
            result = mod.run(
                self._config(project, tmp), sender=lambda m: calls.append(m) or True
            )
            self.assertFalse(result["ready"])
            self.assertFalse(result["notified"])
            self.assertEqual(calls, [])

    def test_missing_todo(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp) / "empty"
            (project / "docs").mkdir(parents=True)
            result = mod.run(self._config(project, tmp), sender=lambda m: True)
            self.assertEqual(result["reason"], "todo-missing")

    def test_debounce_second_run_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = self._project(tmp, SAMPLE)
            cfg = self._config(project, tmp)
            first = mod.run(cfg, sender=lambda m: True)
            self.assertTrue(first["notified"])
            second = mod.run(cfg, sender=lambda m: True)
            self.assertFalse(second["notified"])
            self.assertEqual(second["reason"], "unchanged")

    def test_dry_run_produces_message_without_sending(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = self._project(tmp, SAMPLE)
            calls = []
            cfg = self._config(project, tmp, dry_run=True)
            result = mod.run(cfg, sender=lambda m: calls.append(m) or True)
            self.assertEqual(result["reason"], "dry-run")
            self.assertFalse(result["notified"])
            self.assertIsNotNone(result["message"])
            self.assertEqual(calls, [])

    def test_plan_exists_skips(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = self._project(tmp, SAMPLE)
            (project / "docs" / "plans").mkdir()
            (project / "docs" / "plans" / "x.md").write_text("plan", encoding="utf-8")
            result = mod.run(self._config(project, tmp), sender=lambda m: True)
            self.assertTrue(result["ready"])
            self.assertEqual(result["reason"], "plan-exists")


if __name__ == "__main__":
    unittest.main()
