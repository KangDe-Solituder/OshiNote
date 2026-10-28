"""Seed the isolated acceptance profile without touching production or credentials."""
import argparse
import os
from pathlib import Path
import shutil
import sqlite3


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True,
                        help='Directory containing a consistent oshinote.db and media copy')
    args = parser.parse_args()
    source = args.source.resolve()
    target = Path(os.environ['APPDATA']) / 'com.oshinote.resource-test'
    if target.exists():
        raise SystemExit('Test profile already exists; refusing to overwrite it: ' + str(target))
    if not (source / 'oshinote.db').is_file():
        raise SystemExit('Source database is missing')
    target.mkdir(parents=True)
    with sqlite3.connect((source / 'oshinote.db').as_uri() + '?mode=ro', uri=True) as original:
        with sqlite3.connect(target / 'oshinote.db') as copy:
            original.backup(copy)
            copy.execute('DELETE FROM sync_state')
            copy.execute('DELETE FROM sync_conflicts')
    for directory in ('media', 'fonts'):
        if (source / directory).is_dir():
            shutil.copytree(source / directory, target / directory)
    print('Isolated profile created: ' + str(target))


if __name__ == '__main__':
    main()
