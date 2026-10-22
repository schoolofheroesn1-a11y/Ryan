"""Новые коды активации платного контента для server/codes.php.

  python tools/make_codes.py weapon_barbell 5   -> 5 новых кодов на гриф (строки для codes.php и сами коды)

Коды выводятся только на экран: в репозиторий кладётся лишь их хэш.
"""
import hashlib
import secrets
import sys

ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def new_code():
    return "ASH-" + "-".join("".join(secrets.choice(ABC) for _ in range(4)) for _ in range(3))


if __name__ == "__main__":
    item, n = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 1
    for _ in range(n):
        code = new_code()
        print(f"    '{hashlib.sha256(code.replace('-', '').encode()).hexdigest()}' => '{item}',  // выдать: {code}")
