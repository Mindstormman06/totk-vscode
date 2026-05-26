"""Build a searchable RomFS file index for fast dump filtering."""

from __future__ import annotations

import os
from pathlib import Path

from archive_resolve import list_archive_files


_ARCHIVE_EXTENSIONS = (
    '.pack',
    '.sarc',
    '.genvb',
    '.blarc',
    '.bfarc',
    '.bntx',
    '.pack.zs',
    '.sarc.zs',
    '.genvb.zs',
    '.blarc.zs',
    '.bfarc.zs',
    '.bntx.zs',
)


def _normalize_rel(path_value: str) -> str:
    return path_value.replace('\\', '/').strip('/').lower()


def _is_archive_file(name: str) -> bool:
    lower = name.lower()
    return lower.endswith(_ARCHIVE_EXTENSIONS)


def build_romfs_index(romfs_path: str, output_path: str) -> dict:
    if not romfs_path:
        raise ValueError('TOTK_EDITOR_ROMFS is not set.')

    romfs_root = Path(romfs_path)
    if not romfs_root.is_dir():
        raise ValueError(f'RomFS path does not exist: {romfs_path}')

    index_lines: list[str] = [f'#root={_normalize_rel(str(romfs_root.resolve()))}']
    file_count = 0

    for root, _, files in os.walk(romfs_root):
        root_path = Path(root)
        for file_name in files:
            disk_path = root_path / file_name
            rel_path = _normalize_rel(str(disk_path.relative_to(romfs_root)))
            index_lines.append(rel_path)
            file_count += 1

            if not _is_archive_file(file_name):
                continue

            try:
                virtual_files = list_archive_files(str(disk_path), '', str(romfs_root))
            except Exception:
                continue

            for virtual_path in virtual_files:
                normalized_virtual = _normalize_rel(virtual_path)
                if not normalized_virtual:
                    continue
                index_lines.append(f'{rel_path}/{normalized_virtual}')
                file_count += 1

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text('\n'.join(index_lines) + '\n', encoding='utf-8')

    return {'path': str(out_file), 'count': file_count}
