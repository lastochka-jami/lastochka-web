#!/usr/bin/python3
"""Forced SSH command. Runs as lastochka-deploy, never as root."""
import fcntl
import grp
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request

BASE = Path('/opt/lastochka-web')


def extract(archive, destination):
    with tarfile.open(archive, 'r:gz') as bundle:
        members = bundle.getmembers()
        if len(members) > 50000 or sum(m.size for m in members) > 1024**3:
            raise ValueError('Archive exceeds release limits')
        for member in members:
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts:
                raise ValueError('Unsafe archive path')
            if not (member.isfile() or member.isdir()):
                raise ValueError('Only regular files and directories are allowed')
            if path.parts and (path.parts[0] in {'.data', 'node'} or path.parts[0].startswith('.env')):
                raise ValueError('Runtime and secrets must not be uploaded')
            member.uid = os.getuid()
            member.gid = os.getgid()
            member.mode = 0o755 if member.isdir() or member.mode & 0o111 else 0o644
        bundle.extractall(destination, members=members)


def restart():
    subprocess.run(['sudo', '-n', '/usr/bin/systemctl', 'restart', 'lastochka-web.service'], check=True, timeout=40)


def point(link, target):
    pending = link.with_name('pending')
    pending.unlink(missing_ok=True)
    pending.symlink_to(target)
    os.replace(pending, link)


def healthy(revision, prefix='/shop'):
    for _ in range(20):
        try:
            with urllib.request.urlopen('http://127.0.0.1:13001' + prefix + '/__deploy_revision.txt', timeout=3) as response:
                if response.read().decode().strip() == revision:
                    break
        except (OSError, ValueError):
            pass
        time.sleep(1)
    else:
        raise RuntimeError('New revision did not become ready')
    for path in ['/', '/catalog', '/search']:
        with urllib.request.urlopen('http://127.0.0.1:13001' + prefix + path, timeout=20) as response:
            if response.status != 200:
                raise RuntimeError('HTTP smoke failed: ' + path)


def activate(release, revision):
    link = BASE / 'links/current'
    previous = link.resolve(strict=True)
    try:
        point(link, release)
        restart()
        healthy(revision)
    except BaseException:
        point(link, previous)
        restart()
        print('Deployment failed; previous release restored', file=sys.stderr)
        raise


def main():
    match = re.fullmatch(r'deploy ([0-9a-f]{40})', os.environ.get('SSH_ORIGINAL_COMMAND', ''))
    if not match:
        raise ValueError('Only deploy <commit SHA> is allowed')
    revision = match[1]
    # Serialize uploads and activation, including manual invocations.
    with (BASE / 'links/deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        with tempfile.TemporaryDirectory(dir=BASE / 'incoming') as temporary:
            archive = Path(temporary) / 'release.tgz'
            with archive.open('wb') as output:
                total = 0
                while chunk := sys.stdin.buffer.read(1024 * 1024):
                    total += len(chunk)
                    if total > 300 * 1024**2:
                        raise ValueError('Upload exceeds 300 MiB')
                    output.write(chunk)
            release = Path(tempfile.mkdtemp(prefix=revision + '-', dir=BASE / 'releases'))
            try:
                extract(archive, release)
                for name in ['server.js', '.next/BUILD_ID', 'public']:
                    if not (release / name).exists():
                        raise ValueError('Incomplete standalone build: ' + name)
                (release / 'node').symlink_to(BASE / 'runtime/node')
                (release / 'public/__deploy_revision.txt').write_text(revision + '\n')
                # Only Next cache/server output is writable by the runtime user.
                group = grp.getgrnam('lastochka-web').gr_gid
                for entry in [release / '.next', *(release / '.next').rglob('*')]:
                    os.chown(entry, -1, group)
                    entry.chmod(entry.stat().st_mode | 0o020)
                activate(release, revision)
            except BaseException:
                if (BASE / 'links/current').resolve() != release:
                    shutil.rmtree(release)
                raise
        # Keep current + two previous automatically uploaded releases.
        releases = sorted((p for p in (BASE / 'releases').iterdir() if re.fullmatch(r'[0-9a-f]{40}-.+', p.name)), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in releases[3:]:
            if old != (BASE / 'links/current').resolve():
                shutil.rmtree(old)
        print('Deployed ' + revision, flush=True)


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, lambda *_: sys.exit('Deployment interrupted'))
    main()
