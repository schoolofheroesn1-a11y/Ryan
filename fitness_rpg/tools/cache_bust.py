"""Отпечаток содержимого в адресах скриптов и атласа собранного сайта: gear.js?v=3f9a1c2e.

Браузер, офлайн-кэш и кэш хостинга (nginx перед Apache на sweb) тогда не смешают старые и новые файлы:
новый game.js с устаревшим gear.js — это вечная «Загрузка…». Отпечаток меняется только у изменившегося
файла (и у тех, кто его подключает), поэтому при обновлении сайта перезаливать нужно не всё.
Запуск: python3 tools/cache_bust.py ПАПКА_САЙТА [ПРОШЛАЯ_СБОРКА]  — со второй папкой печатает, какие файлы изменились.
"""
import hashlib
import re
import sys
from pathlib import Path

IMP = re.compile(r'((?:from|import)\s*\(?\s*")(\./([\w-]+\.m?js))(")')
ASSET = re.compile(r'"(atlas\.(?:json|png)|[\w-]+\.(?:m4a|ogg)|music\.json)"')


def digest(data):
    return hashlib.sha256(data).hexdigest()[:8]


def main(site, previous=None):
    site = Path(site)
    texts = {f.name: f.read_text(encoding="utf-8") for f in list(site.glob("*.js")) + [site / "index.html"] if f.name != "sw.js"}
    assets = {f.name: digest(f.read_bytes()) for f in site.iterdir()
              if f.name in ("atlas.json", "atlas.png", "music.json") or f.suffix in (".m4a", ".ogg")}
    done, busy = {}, set()

    def final(name):
        """Текст файла с отпечатками подключённых модулей (сначала обрабатываются они)."""
        if name in done:
            return done[name]
        if name in busy:  # циклический импорт: оставляем как есть
            return texts[name]
        busy.add(name)
        s = texts[name]
        s = IMP.sub(lambda m: m.group(1) + m.group(2) + "?v=" + digest(final(m.group(3)).encode()) + m.group(4)
                    if m.group(3) in texts else m.group(0), s)
        s = ASSET.sub(lambda m: f'"{m.group(1)}?v={assets[m.group(1)]}"' if m.group(1) in assets else m.group(0), s)
        busy.discard(name)
        done[name] = s
        return s

    for name in texts:
        out = final(name)
        if out != texts[name]:
            (site / name).write_text(out, encoding="utf-8")
    if previous and Path(previous).is_dir():
        changed = [f.name for f in sorted(site.iterdir()) if f.is_file() and
                   (not (Path(previous) / f.name).exists() or (Path(previous) / f.name).read_bytes() != f.read_bytes())]
        print("изменились:", " ".join(changed) if changed else "ничего")


if __name__ == "__main__":
    main(*sys.argv[1:3])
