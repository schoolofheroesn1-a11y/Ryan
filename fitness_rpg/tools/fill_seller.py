"""Вписывает реквизиты продавца в страницы документов собранного сайта.

Данные берутся из deploy/seller.json (не хранится в репозитории):
{"name": "...", "status": "самозанятый", "inn": "...", "email": "...", "telegram": "https://t.me/..."}
"""
import json
import re
import sys
from pathlib import Path

PAGES = ("offer.html", "prices.html", "contacts.html", "privacy.html")


def fill(html, s):
    tg = s["telegram"]
    handle = "@" + tg.rstrip("/").rsplit("/", 1)[-1]
    status = s["status"]
    long_status = status + " (плательщик налога на профессиональный доход)" if status.startswith("самозанят") else status
    subs = {
        "ФИО": s["name"],
        "ИНН": s["inn"],
        "email": f'<a href="mailto:{s["email"]}">{s["email"]}</a>',
        "@юзернейм": f'<a href="{tg}">{handle}</a>',
        "самозанятый —": long_status,
        "самозанятый": status,
    }

    def repl(m):
        text = m.group(1)
        for key, value in subs.items():
            if text.startswith(key):
                return value
        raise SystemExit(f"неизвестное поле: {text}")

    return re.sub(r'<span class="fill">\[ЗАПОЛНИТЬ: ([^\]]*)\]</span>', repl, html)


def main(out_dir, seller_file):
    seller = Path(seller_file)
    if not seller.exists():
        print("seller.json нет — в документах остаются места для заполнения")
        return
    s = json.loads(seller.read_text(encoding="utf-8"))
    for name in PAGES:
        p = Path(out_dir) / name
        if p.exists():
            p.write_text(fill(p.read_text(encoding="utf-8"), s), encoding="utf-8")


if __name__ == "__main__":
    main(*sys.argv[1:3])
