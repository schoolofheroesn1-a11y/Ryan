"""Номер версии в адресах скриптов и атласа собранного сайта: game.js?v=37.

Браузер, офлайн-кэш и кэш хостинга (nginx перед Apache на sweb) тогда не смешают старые и новые файлы:
новый game.js с устаревшим gear.js — это вечная «Загрузка…». Версия берётся из sw.js (ash-and-iron-vN).
Запуск: python3 tools/cache_bust.py ПАПКА_САЙТА
"""
import re
import sys
from pathlib import Path


def main(site):
    site = Path(site)
    ver = re.search(r'ash-and-iron-v(\d+)', (site / "sw.js").read_text(encoding="utf-8")).group(1)
    q = f"?v={ver}"
    imp = re.compile(r'((?:from|import)\s*\(?\s*")(\./[\w-]+\.m?js)(")')
    asset = re.compile(r'"(atlas\.(?:json|png))"')
    for f in list(site.glob("*.js")) + [site / "index.html"]:
        if f.name == "sw.js":
            continue
        s = f.read_text(encoding="utf-8")
        out = imp.sub(lambda m: m.group(1) + m.group(2) + q + m.group(3), s)
        out = asset.sub(lambda m: f'"{m.group(1)}{q}"', out)
        if out != s:
            f.write_text(out, encoding="utf-8")
    print(f"версия файлов: v{ver}")


if __name__ == "__main__":
    main(sys.argv[1])
