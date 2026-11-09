import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('receive', Path(__file__).with_name('receive.py'))
receive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receive)


class DeployTests(unittest.TestCase):
    def test_unsafe_upload_does_not_escape_release(self):
        for name, symlink in [('../outside', False), ('/tmp/outside', False), ('link', True), ('.env', False), ('node', False)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                archive = root / 'test.tgz'
                with tarfile.open(archive, 'w:gz') as tar:
                    info = tarfile.TarInfo(name)
                    if symlink:
                        info.type = tarfile.SYMTYPE
                        info.linkname = '/etc/passwd'
                        tar.addfile(info)
                    else:
                        info.size = 1
                        tar.addfile(info, io.BytesIO(b'x'))
                with self.assertRaises(ValueError):
                    receive.extract(archive, root / 'release')
                self.assertFalse((root / 'outside').exists())

    def test_retention_permission_error_does_not_fail_deployment(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'links').mkdir()
            (root / 'releases').mkdir()
            releases = []
            for index in range(5):
                release = root / 'releases' / (str(index) * 40 + '-release')
                release.mkdir()
                releases.append(release)
            # Even an older active release must be preserved.
            (root / 'links/current').symlink_to(releases[0])
            with patch.object(receive, 'BASE', root), patch.object(receive.shutil, 'rmtree', side_effect=PermissionError('cache')) as remove, patch('sys.stderr', new_callable=io.StringIO) as errors:
                receive.prune_releases()
            self.assertTrue(remove.called)
            self.assertNotIn(releases[0], [call.args[0] for call in remove.call_args_list])
            self.assertIn('Warning:', errors.getvalue())

    def test_failed_healthcheck_restores_previous_release(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'links').mkdir()
            previous = root / 'previous'
            previous.mkdir()
            new = root / 'new'
            new.mkdir()
            link = root / 'links/current'
            link.symlink_to(previous)
            with patch.object(receive, 'BASE', root), patch.object(receive, 'restart') as restart, patch.object(receive, 'healthy', side_effect=RuntimeError('failed smoke')):
                with self.assertRaises(RuntimeError):
                    receive.activate(new, 'a' * 40)
            self.assertEqual(link.resolve(), previous.resolve())
            self.assertEqual(restart.call_count, 2)


if __name__ == '__main__':
    unittest.main()
