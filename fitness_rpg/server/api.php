<?php
// Сервер мультиплеера Ash & Iron для обычного хостинга (PHP 7.1+, MySQL; для проверки — SQLite).
// Кладётся рядом с index.html. Настройки базы — lb_config.php (из lb_config.example.php, не в git).
// Все запросы — POST с JSON {action, token?, ...}; ответ — JSON.
//
//   register / login / me / sync  — аккаунт, результат и характеристики героя
//   top                           — рейтинг по побеждённым боссам
//   arena / challenge_start / challenge_end — «Бросить вызов»: лестница игроков и ботов
//   redeem                        — коды активации платного контента (server/codes.php)
//   duel_create / duel_join / duel_sync / duel_leave — дуэль в реальном времени (комната по коду)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

const TOP = 50;
const ATTEMPTS_PER_DAY = 10;
const CHALLENGE_REACH = 3;      // вызов — 3 игрокам выше и 3 ниже в лестнице
const BOTS = 30;
const SESSION_DAYS = 180;
const ROOM_TTL = 1800;          // комната дуэли живёт полчаса
const ROOM_IDLE = 20;           // соперник «вышел», если не отвечает 20 с
const REF_ITEM = 'sword_kin';   // облик за приглашённого друга (обоим: и пригласившему, и другу)
const REF_BOSSES = 1;           // награда — когда приглашённый победит первого босса (защита от пустых аккаунтов)

function reply($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function fail($error, $code = 400) { reply(['error' => $error], $code); }
function rid($bytes = 8) { return bin2hex(random_bytes($bytes)); }

$cfgFile = __DIR__ . '/lb_config.php';
if (!is_file($cfgFile)) fail('not configured', 503);
$cfg = require $cfgFile;
date_default_timezone_set(isset($cfg['timezone']) ? $cfg['timezone'] : 'Europe/Moscow');

try {
    $db = new PDO($cfg['dsn'], isset($cfg['user']) ? $cfg['user'] : null, isset($cfg['pass']) ? $cfg['pass'] : null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $mysql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    if ($mysql) $db->exec('SET NAMES utf8mb4');
    $cs = $mysql ? ' DEFAULT CHARSET=utf8mb4' : '';
    $db->exec("CREATE TABLE IF NOT EXISTS mp_accounts (
        id CHAR(16) PRIMARY KEY, login VARCHAR(20) NULL UNIQUE, pass_hash VARCHAR(255) NULL,
        name VARCHAR(16) NOT NULL, is_bot INT NOT NULL DEFAULT 0,
        bosses INT NOT NULL DEFAULT 0, level INT NOT NULL DEFAULT 1, wave INT NOT NULL DEFAULT 1,
        hero TEXT NULL, unlocks TEXT NULL, arena_pos INT NOT NULL,
        att_day CHAR(10) NULL, att_used INT NOT NULL DEFAULT 0, created INT NOT NULL)$cs");
    try { // приглашения друзей: столбцы добавляются к уже созданной таблице
        $db->query('SELECT invite_code FROM mp_accounts LIMIT 0');
    } catch (Exception $e) {
        foreach (['invite_code VARCHAR(8) NULL', 'invited_by CHAR(16) NULL', 'ref_done INT NOT NULL DEFAULT 0'] as $col) {
            try { $db->exec("ALTER TABLE mp_accounts ADD COLUMN $col"); } catch (Exception $e2) { /* уже есть */ }
        }
    }
    try { // режим без камеры (хардкор): свой рекорд, рейтинг и сохранение
        $db->query('SELECT bosses_btn FROM mp_accounts LIMIT 0');
    } catch (Exception $e) {
        foreach (['bosses_btn INT NOT NULL DEFAULT 0', 'level_btn INT NOT NULL DEFAULT 1', 'wave_btn INT NOT NULL DEFAULT 1',
                  'save_btn TEXT NULL', 'save_btn_at BIGINT NOT NULL DEFAULT 0'] as $col) {
            try { $db->exec("ALTER TABLE mp_accounts ADD COLUMN $col"); } catch (Exception $e2) { /* уже есть */ }
        }
    }
    try { // облачное сохранение основного сюжета
        $db->query('SELECT save_data FROM mp_accounts LIMIT 0');
    } catch (Exception $e) {
        foreach (['save_data TEXT NULL', 'save_at BIGINT NOT NULL DEFAULT 0'] as $col) {
            try { $db->exec("ALTER TABLE mp_accounts ADD COLUMN $col"); } catch (Exception $e2) { /* уже есть */ }
        }
    }
    try { // медали дуэлей и итог комнаты: тоже добавляются к уже созданным таблицам
        $db->query('SELECT medals FROM mp_accounts LIMIT 0');
    } catch (Exception $e) {
        try { $db->exec('ALTER TABLE mp_accounts ADD COLUMN medals INT NOT NULL DEFAULT 0'); } catch (Exception $e2) { /* уже есть */ }
    }
    $db->exec("CREATE TABLE IF NOT EXISTS mp_sessions (token_hash CHAR(64) PRIMARY KEY, account_id CHAR(16) NOT NULL, created INT NOT NULL)$cs");
    $db->exec("CREATE TABLE IF NOT EXISTS mp_fights (id CHAR(16) PRIMARY KEY, account_id CHAR(16) NOT NULL, opp_id CHAR(16) NOT NULL, created INT NOT NULL, done INT NOT NULL DEFAULT 0)$cs");
    $db->exec("CREATE TABLE IF NOT EXISTS mp_hits (ip_hash CHAR(64) NOT NULL, kind VARCHAR(8) NOT NULL, t INT NOT NULL)$cs");
    $db->exec("CREATE TABLE IF NOT EXISTS mp_rooms (code CHAR(4) PRIMARY KEY, host_id CHAR(16) NOT NULL, guest_id CHAR(16) NULL,
        host_seen INT NOT NULL, guest_seen INT NOT NULL DEFAULT 0, created INT NOT NULL)$cs");
    $db->exec("CREATE TABLE IF NOT EXISTS mp_events (room CHAR(4) NOT NULL, side INT NOT NULL, seq INT NOT NULL, payload TEXT NOT NULL, t INT NOT NULL,
        PRIMARY KEY (room, side, seq))$cs");
    try {
        $db->query('SELECT done FROM mp_rooms LIMIT 0');
    } catch (Exception $e) {
        try { $db->exec('ALTER TABLE mp_rooms ADD COLUMN done INT NOT NULL DEFAULT 0'); } catch (Exception $e2) { /* уже есть */ }
    }
} catch (Exception $e) {
    fail('database unavailable', 503);
}

$now = time();
$ipHash = hash('sha256', (isset($cfg['salt']) ? $cfg['salt'] : '') . $_SERVER['REMOTE_ADDR']);

/** Не больше $max событий вида $kind за $window секунд с одного адреса (IP хранится хэшем). */
function limit($kind, $max, $window) {
    global $db, $now, $ipHash;
    $db->prepare('DELETE FROM mp_hits WHERE t < ?')->execute([$now - 3600]);
    $q = $db->prepare('SELECT COUNT(*) FROM mp_hits WHERE ip_hash = ? AND kind = ? AND t >= ?');
    $q->execute([$ipHash, $kind, $now - $window]);
    if ((int)$q->fetchColumn() >= $max) fail('too many requests', 429);
    $db->prepare('INSERT INTO mp_hits (ip_hash, kind, t) VALUES (?, ?, ?)')->execute([$ipHash, $kind, $now]);
}

function clean_name($s) {
    $s = preg_replace('/[^\p{L}\p{N} _-]/u', '', (string)$s);
    $s = trim(preg_replace('/\s+/u', ' ', $s));
    $s = mb_substr($s, 0, 16, 'UTF-8');
    $low = mb_strtolower(preg_replace('/[\s_-]/u', '', $s), 'UTF-8');
    foreach (['хуй', 'хуе', 'пизд', 'ебл', 'ебат', 'бляд', 'сука', 'fuck', 'shit', 'nigg', 'cunt', 'whore'] as $w) {
        if (mb_strpos($low, $w, 0, 'UTF-8') !== false) return '';
    }
    return mb_strlen($s, 'UTF-8') >= 2 ? $s : '';
}

function int_in($v, $min, $max, $def) {
    if (!is_numeric($v)) return $def;
    return max($min, min($max, (int)$v));
}

const SWORDS = ['rusty', 'steel', 'great', 'giant', 'ash', 'radiator', 'seraph', 'barbell'];
const RELICS = ['armor', 'kingarmor', 'wingarmor', 'amulet'];
const SKINS = ['void', 'sun', 'frost', 'phoenix', 'kin'];
const OUTFITS = ['samurai'];

/** Характеристики героя для боёв с ним (бот играет его снаряжением и силой). */
function clean_hero($h) {
    if (!is_array($h)) return null;
    $looks = [];
    foreach ((isset($h['looks']) && is_array($h['looks'])) ? $h['looks'] : [] as $k) if (in_array($k, RELICS, true)) $looks[] = $k;
    return [
        'sword' => (isset($h['sword']) && in_array($h['sword'], SWORDS, true)) ? $h['sword'] : 'rusty',
        'looks' => array_values(array_unique($looks)),
        'skin' => (isset($h['skin']) && in_array($h['skin'], SKINS, true)) ? $h['skin'] : null,
        'outfit' => (isset($h['outfit']) && in_array($h['outfit'], OUTFITS, true)) ? $h['outfit'] : null,
        'level' => int_in(isset($h['level']) ? $h['level'] : 1, 1, 2000, 1),
        'maxHp' => int_in(isset($h['maxHp']) ? $h['maxHp'] : 92, 50, 3000, 92),
        'damage' => int_in(isset($h['damage']) ? $h['damage'] : 13, 1, 600, 13),
        'crit' => max(1.0, min(3.0, (float)(isset($h['crit']) ? $h['crit'] : 1.5))),
        'taken' => max(0.5, min(1.0, (float)(isset($h['taken']) ? $h['taken'] : 1))),
        'estus' => int_in(isset($h['estus']) ? $h['estus'] : 3, 0, 6, 3),
        'stamina' => int_in(isset($h['stamina']) ? $h['stamina'] : 68, 20, 2000, 68),
        'cost' => int_in(isset($h['cost']) ? $h['cost'] : 20, 5, 100, 20),
        'regen' => int_in(isset($h['regen']) ? $h['regen'] : 12, 1, 500, 12),
    ];
}

/** Боты лестницы: создаются один раз, сильнее те, кто выше. */
function ensure_bots() {
    global $db, $now;
    if ((int)$db->query('SELECT COUNT(*) FROM mp_accounts WHERE is_bot = 1')->fetchColumn() > 0) return;
    $names = ['Сир Мордред', 'Пепельная Вдова', 'Брат Ульрих', 'Гримм Кузнец', 'Ведьма Ильва', 'Рагнар Седой',
        'Леди Морвен', 'Старый Хорст', 'Тёмный Эйрик', 'Сестра Агата', 'Бьорн Молот', 'Вальдемар', 'Ловчий Тис',
        'Мастер Олаф', 'Хельга Щит', 'Рыцарь Тени', 'Кейл Бродяга', 'Отшельник Ян', 'Дама Розалин', 'Гуннар',
        'Страж Эдгар', 'Ивар Хромой', 'Сигрун', 'Брат Феликс', 'Торвальд', 'Мира Лучница', 'Ульф Рыжий',
        'Послушник Лев', 'Бран', 'Новобранец Тим'];
    $ins = $db->prepare('INSERT INTO mp_accounts (id, name, is_bot, bosses, level, wave, hero, arena_pos, created)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)');
    for ($i = 1; $i <= BOTS; $i++) {
        $t = (BOTS + 1 - $i) / BOTS;                       // 1 — самый сильный
        $level = 2 + (int)round($t * $t * 44);
        $s = 1 + intdiv($level - 1 + 2, 3);
        $v = 1 + intdiv($level - 1 + 1, 3);
        $e = 1 + intdiv($level - 1, 3);
        $sword = $t > 0.85 ? 'giant' : ($t > 0.65 ? 'great' : ($t > 0.4 ? 'steel' : 'rusty'));
        $dmg = ['rusty' => 0, 'steel' => 5, 'great' => 12, 'giant' => 20][$sword];
        $looks = $t > 0.9 ? ['armor', 'kingarmor'] : ($t > 0.6 ? ['armor'] : []);
        $hero = ['sword' => $sword, 'looks' => $looks, 'skin' => null, 'level' => $level,
            'maxHp' => 80 + 12 * $v, 'damage' => 10 + 3 * $s + $dmg, 'crit' => $sword === 'rusty' || $sword === 'steel' ? 1.5 : 1.75,
            'taken' => in_array('kingarmor', $looks, true) ? 0.65 : (in_array('armor', $looks, true) ? 0.75 : 1),
            'estus' => 3, 'stamina' => 60 + 8 * $e, 'cost' => $sword === 'giant' ? 32 : ($sword === 'great' ? 28 : 20), 'regen' => 10 + 2 * $e];
        $bosses = (int)floor(($level - 2) / 5);
        $ins->execute([rid(), $names[$i - 1], $bosses, $level, 1 + $bosses * 5, json_encode($hero), $i, $now]);
    }
}

function account_by_token($token) {
    global $db, $now;
    if (!is_string($token) || strlen($token) !== 64) return null;
    $q = $db->prepare('SELECT a.* FROM mp_sessions s JOIN mp_accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.created > ?');
    $q->execute([hash('sha256', $token), $now - SESSION_DAYS * 86400]);
    $a = $q->fetch();
    return $a ?: null;
}

function need_account($in) {
    $a = account_by_token(isset($in['token']) ? $in['token'] : '');
    if (!$a) fail('auth', 401);
    return $a;
}

const INVITE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Уникальный код приглашения аккаунта (создаётся при первом запросе). */
function invite_code($a) {
    global $db;
    if (!empty($a['invite_code'])) return $a['invite_code'];
    for ($try = 0; $try < 20; $try++) {
        $code = '';
        for ($i = 0; $i < 6; $i++) $code .= INVITE_ABC[random_int(0, strlen(INVITE_ABC) - 1)];
        $q = $db->prepare('SELECT COUNT(*) FROM mp_accounts WHERE invite_code = ?');
        $q->execute([$code]);
        if ((int)$q->fetchColumn() === 0) {
            $db->prepare('UPDATE mp_accounts SET invite_code = ? WHERE id = ?')->execute([$code, $a['id']]);
            return $code;
        }
    }
    return '';
}

function invite_info($a) {
    global $db;
    $q = $db->prepare('SELECT COUNT(*) AS n, COALESCE(SUM(ref_done), 0) AS done FROM mp_accounts WHERE invited_by = ?');
    $q->execute([$a['id']]);
    $r = $q->fetch();
    return ['code' => invite_code($a), 'invited' => (int)$r['n'], 'done' => (int)$r['done'], 'reward' => REF_ITEM,
        'need_bosses' => REF_BOSSES, 'by_friend' => !empty($a['invited_by']), 'friend_done' => (int)$a['ref_done'] === 1];
}

function grant_unlock($id, $item) {
    global $db;
    $a = reload($id);
    if (!$a) return;
    $u = json_decode($a['unlocks'] ?: '[]', true) ?: [];
    if (in_array($item, $u, true)) return;
    $u[] = $item;
    $db->prepare('UPDATE mp_accounts SET unlocks = ? WHERE id = ?')->execute([json_encode($u), $id]);
}

function public_account($a) {
    return [
        'invite' => invite_info($a),
        'id' => $a['id'], 'login' => $a['login'], 'name' => $a['name'],
        'best' => ['bosses' => (int)$a['bosses'], 'level' => (int)$a['level'], 'wave' => (int)$a['wave']],
        'best_btn' => ['bosses' => (int)$a['bosses_btn'], 'level' => (int)$a['level_btn'], 'wave' => (int)$a['wave_btn']],
        'unlocks' => json_decode($a['unlocks'] ?: '[]', true) ?: [],
        'arena_pos' => (int)$a['arena_pos'],
        'medals' => isset($a['medals']) ? (int)$a['medals'] : 0,
        'attempts' => attempts_left($a),
    ];
}

function attempts_left($a) {
    return $a['att_day'] === date('Y-m-d') ? max(0, ATTEMPTS_PER_DAY - (int)$a['att_used']) : ATTEMPTS_PER_DAY;
}

function new_session($accountId) {
    global $db, $now;
    $token = rid(32);
    $db->prepare('INSERT INTO mp_sessions (token_hash, account_id, created) VALUES (?, ?, ?)')->execute([hash('sha256', $token), $accountId, $now]);
    return $token;
}

/** Режим игры: "cam" — с камерой, "btn" — без камеры (хардкор). У каждого свой рекорд, рейтинг и сохранение. */
function game_mode($in) {
    return isset($in['mode']) && $in['mode'] === 'btn' ? 'btn' : 'cam';
}

/** Столбцы рекорда режима: [боссы, уровень, раунд]. */
function best_cols($mode) {
    return $mode === 'btn' ? ['bosses_btn', 'level_btn', 'wave_btn'] : ['bosses', 'level', 'wave'];
}

/** Результат не уменьшается (сравнение: боссы, затем уровень, затем раунд); герой обновляется. */
function apply_sync($a, $in) {
    global $db;
    $b = isset($in['best']) && is_array($in['best']) ? $in['best'] : [];
    $new = [int_in(isset($b['bosses']) ? $b['bosses'] : 0, 0, 1000, 0), int_in(isset($b['level']) ? $b['level'] : 1, 1, 2000, 1),
        int_in(isset($b['wave']) ? $b['wave'] : 1, 1, 5000, 1)];
    [$cb, $cl, $cw] = best_cols(game_mode($in));
    $old = [(int)$a[$cb], (int)$a[$cl], (int)$a[$cw]];
    $best = $new > $old ? $new : $old;
    $hero = clean_hero(isset($in['hero']) ? $in['hero'] : null);
    $db->prepare("UPDATE mp_accounts SET $cb = ?, $cl = ?, $cw = ?, hero = COALESCE(?, hero) WHERE id = ?")
        ->execute([$best[0], $best[1], $best[2], $hero ? json_encode($hero) : null, $a['id']]);
    // приглашённый победил первого босса: облик получают он и тот, кто его пригласил
    if (!empty($a['invited_by']) && (int)$a['ref_done'] === 0 && $best[0] >= REF_BOSSES) {
        $db->prepare('UPDATE mp_accounts SET ref_done = 1 WHERE id = ?')->execute([$a['id']]);
        grant_unlock($a['id'], REF_ITEM);
        grant_unlock($a['invited_by'], REF_ITEM);
    }
}

function reload($id) {
    global $db;
    $q = $db->prepare('SELECT * FROM mp_accounts WHERE id = ?');
    $q->execute([$id]);
    return $q->fetch();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('method', 405);
$in = json_decode(file_get_contents('php://input', false, null, 0, 16384), true);
if (!is_array($in)) fail('bad json');
$action = isset($in['action']) ? (string)$in['action'] : '';

// ---------------------------------------------------------------- аккаунт
if ($action === 'register') {
    limit('reg', 5, 3600);
    $login = strtolower(trim(isset($in['login']) ? (string)$in['login'] : ''));
    $pass = isset($in['password']) ? (string)$in['password'] : '';
    $name = clean_name(isset($in['name']) ? $in['name'] : '');
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $login)) fail('login');
    if (strlen($pass) < 6 || strlen($pass) > 72) fail('password');
    if ($name === '') $name = $login;
    $q = $db->prepare('SELECT COUNT(*) FROM mp_accounts WHERE login = ?');
    $q->execute([$login]);
    if ((int)$q->fetchColumn() > 0) fail('login taken', 409);
    ensure_bots();
    $id = rid();
    $pos = (int)$db->query('SELECT COALESCE(MAX(arena_pos), 0) FROM mp_accounts')->fetchColumn() + 1; // новичок — в конец лестницы
    $ref = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', isset($in['ref']) ? (string)$in['ref'] : ''));
    $by = null;
    if ($ref !== '') { // код друга: кто пригласил
        $q = $db->prepare('SELECT id FROM mp_accounts WHERE invite_code = ? AND is_bot = 0');
        $q->execute([$ref]);
        $by = $q->fetchColumn() ?: null;
        if (!$by) fail('bad ref');
    }
    $db->prepare('INSERT INTO mp_accounts (id, login, pass_hash, name, arena_pos, created, invited_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$id, $login, password_hash($pass, PASSWORD_DEFAULT), $name, $pos, $now, $by]);
    apply_sync(reload($id), $in);
    reply(['token' => new_session($id), 'account' => public_account(reload($id))]);
}

if ($action === 'login') {
    limit('login', 20, 600);
    $login = strtolower(trim(isset($in['login']) ? (string)$in['login'] : ''));
    $q = $db->prepare('SELECT * FROM mp_accounts WHERE login = ? AND is_bot = 0');
    $q->execute([$login]);
    $a = $q->fetch();
    if (!$a || !password_verify(isset($in['password']) ? (string)$in['password'] : '', $a['pass_hash'])) fail('wrong login', 403);
    $db->prepare('DELETE FROM mp_sessions WHERE created < ?')->execute([$now - SESSION_DAYS * 86400]);
    reply(['token' => new_session($a['id']), 'account' => public_account($a)]);
}

if ($action === 'logout') {
    $db->prepare('DELETE FROM mp_sessions WHERE token_hash = ?')->execute([hash('sha256', isset($in['token']) ? (string)$in['token'] : '')]);
    reply(['ok' => true]);
}

if ($action === 'me') reply(['account' => public_account(need_account($in))]);

if ($action === 'sync') {
    $a = need_account($in);
    apply_sync($a, $in);
    if (isset($in['name'])) {
        $name = clean_name($in['name']);
        if ($name === '') fail('name');
        $db->prepare('UPDATE mp_accounts SET name = ? WHERE id = ?')->execute([$name, $a['id']]);
    }
    reply(['account' => public_account(reload($a['id']))]);
}

// ---------------------------------------------------------------- облачное сохранение основного сюжета
/** Пустой прогресс (новый телефон, очищенный браузер): такой не должен затирать сохранение в аккаунте. */
function save_pristine($s) {
    if (!is_array($s) || !empty($s['reset'])) return false; // «Новая игра» — сознательный сброс
    $lvl = (isset($s['strength']) ? (int)$s['strength'] : 1) + (isset($s['vigor']) ? (int)$s['vigor'] : 1) + (isset($s['endurance']) ? (int)$s['endurance'] : 1);
    return (isset($s['wave']) ? (int)$s['wave'] : 1) <= 1 && $lvl <= 3 && empty($s['bossesDefeated']);
}

/** Столбцы облачного сохранения режима: [данные, время]. */
function save_cols($mode) {
    return $mode === 'btn' ? ['save_btn', 'save_btn_at'] : ['save_data', 'save_at'];
}

if ($action === 'save_get') {
    $a = need_account($in);
    [$cd, $ct] = save_cols(game_mode($in));
    $save = $a[$cd] ? json_decode($a[$cd], true) : null;
    reply(['save' => $save, 'at' => (int)$a[$ct]]);
}

if ($action === 'save_put') {
    $a = need_account($in);
    limit('save', 120, 600);
    $save = isset($in['save']) && is_array($in['save']) ? $in['save'] : null;
    $raw = $save ? json_encode($save) : '';
    if (!$save || strlen($raw) > 20000) fail('save');
    $at = int_in(isset($in['at']) ? $in['at'] : 0, 0, PHP_INT_MAX, 0);
    [$cd, $ct] = save_cols(game_mode($in));
    $old = $a[$cd] ? json_decode($a[$cd], true) : null;
    $stored = false;
    // хранится более свежее сохранение; пустое не затирает настоящий прогресс
    if ($at >= (int)$a[$ct] && !(save_pristine($save) && $old && !save_pristine($old))) {
        $db->prepare("UPDATE mp_accounts SET $cd = ?, $ct = ? WHERE id = ?")->execute([$raw, $at, $a['id']]);
        $stored = true;
    }
    reply(['ok' => true, 'stored' => $stored, 'at' => $stored ? $at : (int)$a[$ct]]);
}

// ---------------------------------------------------------------- рейтинг по боссам
if ($action === 'top') {
    $mode = game_mode($in);
    [$cb, $cl, $cw] = best_cols($mode);
    // в рейтинге режима — только те, кто в нём играл
    $rows = $db->query("SELECT id, name, $cb AS bosses, $cl AS level, $cw AS wave, hero FROM mp_accounts
        WHERE is_bot = 0 AND ($cb > 0 OR $cl > 1 OR $cw > 1)
        ORDER BY $cb DESC, $cl DESC, $cw DESC, created ASC LIMIT " . TOP)->fetchAll();
    foreach ($rows as &$r) {
        foreach (['bosses', 'level', 'wave'] as $k) $r[$k] = (int)$r[$k];
        $r['look'] = hero_look(json_decode($r['hero'] ?: 'null', true)); // иконка игрока в списке
        unset($r['hero']);
    }
    unset($r);
    $rank = null;
    $a = account_by_token(isset($in['token']) ? $in['token'] : '');
    if ($a) {
        $q = $db->prepare("SELECT COUNT(*) FROM mp_accounts WHERE is_bot = 0 AND ($cb > ? OR ($cb = ? AND $cl > ?)
            OR ($cb = ? AND $cl = ? AND $cw > ?))");
        $q->execute([$a[$cb], $a[$cb], $a[$cl], $a[$cb], $a[$cl], $a[$cw]]);
        $rank = (int)$q->fetchColumn() + 1;
    }
    reply(['rows' => $rows, 'rank' => $rank, 'mode' => $mode]);
}

// ---------------------------------------------------------------- бросить вызов
/** Облик для иконки: меч, доспехи, облики из лавки — без характеристик. */
function hero_look($hero) {
    if (!is_array($hero)) return ['sword' => 'rusty', 'looks' => [], 'skin' => null, 'outfit' => null];
    return ['sword' => isset($hero['sword']) ? $hero['sword'] : 'rusty', 'looks' => isset($hero['looks']) ? $hero['looks'] : [],
        'skin' => isset($hero['skin']) ? $hero['skin'] : null, 'outfit' => isset($hero['outfit']) ? $hero['outfit'] : null];
}

function arena_row($r, $me) {
    $hero = json_decode($r['hero'] ?: 'null', true);
    return ['id' => $r['id'], 'pos' => (int)$r['arena_pos'], 'name' => $r['name'], 'bot' => (bool)$r['is_bot'], 'look' => hero_look($hero),
        'level' => $hero ? (int)$hero['level'] : (int)$r['level'], 'me' => $r['id'] === $me['id'],
        'can' => $r['id'] !== $me['id'] && abs((int)$r['arena_pos'] - (int)$me['arena_pos']) <= CHALLENGE_REACH];
}

if ($action === 'arena') {
    $a = need_account($in);
    ensure_bots();
    $pos = (int)$a['arena_pos'];
    $q = $db->prepare('SELECT * FROM mp_accounts WHERE arena_pos <= 3 OR (arena_pos BETWEEN ? AND ?) ORDER BY arena_pos');
    $q->execute([$pos - 8, $pos + 8]);
    $rows = array_map(function ($r) use ($a) { return arena_row($r, $a); }, $q->fetchAll());
    reply(['rows' => $rows, 'pos' => $pos, 'attempts' => attempts_left($a), 'per_day' => ATTEMPTS_PER_DAY,
        'total' => (int)$db->query('SELECT COUNT(*) FROM mp_accounts')->fetchColumn()]);
}

if ($action === 'challenge_start') {
    $a = need_account($in);
    if (attempts_left($a) <= 0) fail('no attempts', 409);
    $q = $db->prepare('SELECT * FROM mp_accounts WHERE id = ?');
    $q->execute([isset($in['opponent']) ? (string)$in['opponent'] : '']);
    $o = $q->fetch();
    if (!$o || $o['id'] === $a['id'] || abs((int)$o['arena_pos'] - (int)$a['arena_pos']) > CHALLENGE_REACH) fail('opponent', 409);
    $used = $a['att_day'] === date('Y-m-d') ? (int)$a['att_used'] + 1 : 1;
    $db->prepare('UPDATE mp_accounts SET att_day = ?, att_used = ? WHERE id = ?')->execute([date('Y-m-d'), $used, $a['id']]);
    $fight = rid();
    $db->prepare('DELETE FROM mp_fights WHERE created < ?')->execute([$now - 86400]);
    $db->prepare('INSERT INTO mp_fights (id, account_id, opp_id, created) VALUES (?, ?, ?, ?)')->execute([$fight, $a['id'], $o['id'], $now]);
    $hero = json_decode($o['hero'] ?: 'null', true) ?: clean_hero([]);
    reply(['fight' => $fight, 'opponent' => ['id' => $o['id'], 'name' => $o['name'], 'pos' => (int)$o['arena_pos'], 'hero' => $hero],
        'attempts' => ATTEMPTS_PER_DAY - $used]);
}

if ($action === 'challenge_end') {
    $a = need_account($in);
    $q = $db->prepare('SELECT * FROM mp_fights WHERE id = ? AND account_id = ? AND done = 0');
    $q->execute([isset($in['fight']) ? (string)$in['fight'] : '', $a['id']]);
    $f = $q->fetch();
    if (!$f || $now - (int)$f['created'] > 1800) fail('fight', 409);
    $db->prepare('UPDATE mp_fights SET done = 1 WHERE id = ?')->execute([$f['id']]);
    $won = !empty($in['won']) && $now - (int)$f['created'] >= 8; // бой короче 8 секунд не засчитывается
    $moved = false;
    if ($won) {
        $o = reload($f['opp_id']);
        $me = reload($a['id']);
        if ($o && (int)$o['arena_pos'] !== (int)$me['arena_pos']) { // победа: встаём на место соперника, он — на наше
            $db->beginTransaction();
            $db->prepare('UPDATE mp_accounts SET arena_pos = ? WHERE id = ?')->execute([(int)$me['arena_pos'], $o['id']]);
            $db->prepare('UPDATE mp_accounts SET arena_pos = ? WHERE id = ?')->execute([(int)$o['arena_pos'], $me['id']]);
            $db->commit();
            $moved = true;
        }
    }
    reply(['won' => $won, 'moved' => $moved, 'account' => public_account(reload($a['id']))]);
}

// ---------------------------------------------------------------- коды активации
if ($action === 'redeem') {
    limit('code', 10, 600);
    $codes = is_file(__DIR__ . '/codes.php') ? require __DIR__ . '/codes.php' : [];
    $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', isset($in['code']) ? (string)$in['code'] : ''));
    $item = isset($codes[hash('sha256', $code)]) ? $codes[hash('sha256', $code)] : null;
    if (!$item) fail('bad code', 404);
    $a = account_by_token(isset($in['token']) ? $in['token'] : '');
    if ($a) { // у аккаунта покупка сохраняется на всех устройствах
        $u = json_decode($a['unlocks'] ?: '[]', true) ?: [];
        if (!in_array($item, $u, true)) $u[] = $item;
        $db->prepare('UPDATE mp_accounts SET unlocks = ? WHERE id = ?')->execute([json_encode($u), $a['id']]);
    }
    reply(['item' => $item]);
}

// ---------------------------------------------------------------- дуэль
function room_for($a, $code) {
    global $db;
    $q = $db->prepare('SELECT * FROM mp_rooms WHERE code = ?');
    $q->execute([strtoupper((string)$code)]);
    $r = $q->fetch();
    if (!$r || ($r['host_id'] !== $a['id'] && $r['guest_id'] !== $a['id'])) fail('room', 404);
    return $r;
}

function duel_side($a, $r) { return $r['host_id'] === $a['id'] ? 0 : 1; }

function duel_opponent($r, $side) {
    $id = $side === 0 ? $r['guest_id'] : $r['host_id'];
    if (!$id) return null;
    $o = reload($id);
    return ['name' => $o['name'], 'hero' => json_decode($o['hero'] ?: 'null', true) ?: clean_hero([])];
}

/**
 * Медали дуэлей: проигравший (он сам сообщает «dead», в том числе когда сдаётся) теряет одну, но не ниже нуля,
 * победитель получает одну. Считается один раз за комнату и только если бой начался — оба нажали «готов».
 */
function duel_medals($r, $loserSide) {
    global $db;
    if (!$r['guest_id']) return;
    $q = $db->prepare("SELECT COUNT(DISTINCT side) FROM mp_events WHERE room = ? AND payload LIKE '%\"t\":\"ready\"%'");
    $q->execute([$r['code']]);
    if ((int)$q->fetchColumn() < 2) return;
    $u = $db->prepare('UPDATE mp_rooms SET done = 1 WHERE code = ? AND done = 0');
    $u->execute([$r['code']]);
    if ($u->rowCount() !== 1) return; // итог уже засчитан
    $loser = $loserSide === 0 ? $r['host_id'] : $r['guest_id'];
    $winner = $loserSide === 0 ? $r['guest_id'] : $r['host_id'];
    $db->prepare('UPDATE mp_accounts SET medals = medals + 1 WHERE id = ?')->execute([$winner]);
    $db->prepare('UPDATE mp_accounts SET medals = CASE WHEN medals > 0 THEN medals - 1 ELSE 0 END WHERE id = ?')->execute([$loser]);
}

if ($action === 'duel_create') {
    $a = need_account($in);
    limit('room', 20, 600);
    apply_sync($a, $in);
    $db->prepare('DELETE FROM mp_events WHERE room IN (SELECT code FROM mp_rooms WHERE created < ? OR host_id = ?)')->execute([$now - ROOM_TTL, $a['id']]);
    $db->prepare('DELETE FROM mp_rooms WHERE created < ? OR host_id = ?')->execute([$now - ROOM_TTL, $a['id']]);
    $abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    for ($try = 0; $try < 20; $try++) {
        $code = '';
        for ($i = 0; $i < 4; $i++) $code .= $abc[random_int(0, strlen($abc) - 1)];
        try {
            $db->prepare('INSERT INTO mp_rooms (code, host_id, host_seen, created) VALUES (?, ?, ?, ?)')->execute([$code, $a['id'], $now, $now]);
            reply(['code' => $code, 'side' => 0]);
        } catch (Exception $e) { /* код занят — следующий */ }
    }
    fail('busy', 503);
}

if ($action === 'duel_join') {
    $a = need_account($in);
    limit('join', 30, 600);
    apply_sync($a, $in);
    $q = $db->prepare('SELECT * FROM mp_rooms WHERE code = ? AND created >= ?');
    $q->execute([strtoupper(isset($in['code']) ? (string)$in['code'] : ''), $now - ROOM_TTL]);
    $r = $q->fetch();
    if (!$r) fail('room', 404);
    if ($r['host_id'] === $a['id']) fail('own room', 409);
    if ($r['guest_id'] && $r['guest_id'] !== $a['id']) fail('room full', 409);
    $db->prepare('UPDATE mp_rooms SET guest_id = ?, guest_seen = ? WHERE code = ?')->execute([$a['id'], $now, $r['code']]);
    $r['guest_id'] = $a['id'];
    reply(['code' => $r['code'], 'side' => 1, 'opponent' => duel_opponent($r, 1)]);
}

if ($action === 'duel_sync') {
    $a = need_account($in);
    $r = room_for($a, isset($in['code']) ? $in['code'] : '');
    $side = duel_side($a, $r);
    $db->prepare('UPDATE mp_rooms SET ' . ($side === 0 ? 'host_seen' : 'guest_seen') . ' = ? WHERE code = ?')->execute([$now, $r['code']]);
    $events = isset($in['events']) && is_array($in['events']) ? array_slice($in['events'], 0, 20) : [];
    if ($events) {
        $q = $db->prepare('SELECT COALESCE(MAX(seq), 0) FROM mp_events WHERE room = ? AND side = ?');
        $q->execute([$r['code'], $side]);
        $seq = (int)$q->fetchColumn();
        $ins = $db->prepare('INSERT INTO mp_events (room, side, seq, payload, t) VALUES (?, ?, ?, ?, ?)');
        foreach ($events as $e) {
            $p = json_encode($e);
            if (is_array($e) && strlen($p) <= 300) $ins->execute([$r['code'], $side, ++$seq, $p, $now]);
            if (is_array($e) && isset($e['t']) && $e['t'] === 'dead') duel_medals($r, $side);
        }
    }
    $q = $db->prepare('SELECT seq, payload FROM mp_events WHERE room = ? AND side = ? AND seq > ? ORDER BY seq LIMIT 50');
    $q->execute([$r['code'], 1 - $side, int_in(isset($in['ack']) ? $in['ack'] : 0, 0, PHP_INT_MAX, 0)]);
    $out = array_map(function ($row) { return ['seq' => (int)$row['seq'], 'e' => json_decode($row['payload'], true)]; }, $q->fetchAll());
    $seen = $side === 0 ? (int)$r['guest_seen'] : (int)$r['host_seen'];
    reply(['events' => $out, 'opponent' => duel_opponent($r, $side),
        'opponent_gone' => $seen > 0 && $now - $seen > ROOM_IDLE]);
}

if ($action === 'duel_leave') {
    $a = need_account($in);
    $r = room_for($a, isset($in['code']) ? $in['code'] : '');
    $db->prepare('DELETE FROM mp_events WHERE room = ?')->execute([$r['code']]);
    $db->prepare('DELETE FROM mp_rooms WHERE code = ?')->execute([$r['code']]);
    reply(['ok' => true]);
}

fail('action');
