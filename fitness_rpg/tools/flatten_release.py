"""Раскладывает сайт в одну папку без подпапок (js/, assets/, fonts/, vendor/).

Веб-загрузка GitHub («Upload files») часто теряет папки и кладёт все файлы в корень —
плоский сайт работает при любой такой загрузке.
Запуск: python tools/flatten_release.py ВХОДНАЯ_ПАПКА ВЫХОДНАЯ_ПАПКА
"""
import shutil
import sys
from pathlib import Path

# (файл, старый текст, новый текст): каждая замена обязана сработать
REWRITES = [
    ("index.html", 'href="assets/', 'href="'),
    ("index.html", 'src="assets/', 'src="'),
    ("index.html", '"./js/game.js"', '"./game.js"'),
    ("style.css", 'url("fonts/', 'url("'),
    ("manifest.webmanifest", '"src": "assets/', '"src": "'),
    ("sw.js", '"js/', '"'),
    ("sw.js", '"assets/', '"'),
    ("sw.js", '"fonts/', '"'),
    ("game.js", '"assets/atlas', '"atlas'),
    ("motion.js", '"../vendor/tasks-vision/"', '"./"'),
    ("motion.js", '"../vendor/pose_landmarker_lite.task"', '"./pose_landmarker_lite.task"'),
    ("motion.js", 'LOCAL_BASE + "wasm"', 'LOCAL_BASE.replace(/\\/$/, "")'),
]


def main(src, out):
    src, out = Path(src), Path(out)
    files = [p for p in src.rglob("*") if p.is_file()]
    names = [p.name for p in files]
    dup = {n for n in names if names.count(n) > 1}
    assert not dup, f"одинаковые имена в разных папках: {dup}"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    for p in files:
        shutil.copy2(p, out / p.name)
    for name, old, new in REWRITES:
        f = out / name
        text = f.read_text(encoding="utf-8")
        assert old in text, f"{name}: не найдено {old!r}"
        f.write_text(text.replace(old, new), encoding="utf-8")


if __name__ == "__main__":
    main(*sys.argv[1:3])
