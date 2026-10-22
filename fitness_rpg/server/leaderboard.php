<?php
// Рейтинг Ash & Iron на обычном хостинге (PHP 7.1+, MySQL). Кладётся рядом с index.html.
// Настройки базы — в lb_config.php (создаётся на сервере из lb_config.example.php, в git не хранится).
//   GET  leaderboard.php?player_id=…   -> {"rows":[…топ 50…],"rank":N}
//   POST leaderboard.php  {player_id, secret, name, bosses, level, wave} -> {"ok":true}
// Строку игрока может менять только устройство, которое её создало (секрет хранится как хэш).

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

const TOP = 50;
const WRITES_PER_MINUTE = 20;

function reply($code, $data) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$cfgFile = __DIR__ . '/lb_config.php';
if (!is_file($cfgFile)) reply(503, ['error' => 'not configured']);
$cfg = require $cfgFile;

try {
    $db = new PDO($cfg['dsn'], isset($cfg['user']) ? $cfg['user'] : null, isset($cfg['pass']) ? $cfg['pass'] : null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $mysql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    if ($mysql) $db->exec('SET NAMES utf8mb4');
    // таблицы создаются при первом запросе
    $db->exec('CREATE TABLE IF NOT EXISTS lb_players (
        player_id CHAR(36) PRIMARY KEY,
        secret_hash CHAR(64) NOT NULL,
        name VARCHAR(16) NOT NULL,
        bosses INT NOT NULL DEFAULT 0,
        level INT NOT NULL DEFAULT 1,
        wave INT NOT NULL DEFAULT 1,
        updated_at INT NOT NULL
    )' . ($mysql ? ' DEFAULT CHARSET=utf8mb4' : ''));
    $db->exec('CREATE TABLE IF NOT EXISTS lb_hits (ip_hash CHAR(64) NOT NULL, t INT NOT NULL)');
} catch (Exception $e) {
    reply(503, ['error' => 'database unavailable']);
}

function clean_name($s) {
    $s = preg_replace('/[\x00-\x1F\x7F<>]/u', '', (string)$s);
    $s = trim(preg_replace('/\s+/u', ' ', $s));
    return mb_substr($s, 0, 16, 'UTF-8');
}

function int_in($v, $min, $max) {
    if (!is_numeric($v)) return null;
    $v = (int)$v;
    return ($v < $min || $v > $max) ? null : $v;
}

$uuid = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = $db->query('SELECT player_id, name, bosses, level, wave FROM lb_players
        ORDER BY bosses DESC, level DESC, wave DESC LIMIT ' . TOP)->fetchAll();
    foreach ($rows as &$r) foreach (['bosses', 'level', 'wave'] as $k) $r[$k] = (int)$r[$k];
    unset($r);
    $rank = null;
    $id = isset($_GET['player_id']) ? $_GET['player_id'] : '';
    if (preg_match($uuid, $id)) {
        $me = $db->prepare('SELECT bosses, level, wave FROM lb_players WHERE player_id = ?');
        $me->execute([$id]);
        if ($m = $me->fetch()) {
            $q = $db->prepare('SELECT COUNT(*) FROM lb_players WHERE bosses > ? OR (bosses = ? AND level > ?)
                OR (bosses = ? AND level = ? AND wave > ?)');
            $q->execute([$m['bosses'], $m['bosses'], $m['level'], $m['bosses'], $m['level'], $m['wave']]);
            $rank = (int)$q->fetchColumn() + 1;
        }
    }
    reply(200, ['rows' => $rows, 'rank' => $rank]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['error' => 'method']);

// защита от потока запросов: не больше WRITES_PER_MINUTE записей в минуту с одного адреса
$now = time();
$ipHash = hash('sha256', (isset($cfg['salt']) ? $cfg['salt'] : '') . $_SERVER['REMOTE_ADDR']);
$db->prepare('DELETE FROM lb_hits WHERE t < ?')->execute([$now - 60]);
$hits = $db->prepare('SELECT COUNT(*) FROM lb_hits WHERE ip_hash = ?');
$hits->execute([$ipHash]);
if ((int)$hits->fetchColumn() >= WRITES_PER_MINUTE) reply(429, ['error' => 'too many requests']);
$db->prepare('INSERT INTO lb_hits (ip_hash, t) VALUES (?, ?)')->execute([$ipHash, $now]);

$in = json_decode(file_get_contents('php://input', false, null, 0, 2048), true);
if (!is_array($in)) reply(400, ['error' => 'bad json']);
$id = isset($in['player_id']) ? (string)$in['player_id'] : '';
$secret = isset($in['secret']) ? (string)$in['secret'] : '';
$name = clean_name(isset($in['name']) ? $in['name'] : '');
$bosses = int_in(isset($in['bosses']) ? $in['bosses'] : null, 0, 1000);
$level = int_in(isset($in['level']) ? $in['level'] : null, 1, 2000);
$wave = int_in(isset($in['wave']) ? $in['wave'] : null, 1, 5000);
if (!preg_match($uuid, $id) || strlen($secret) < 16 || strlen($secret) > 128 || mb_strlen($name, 'UTF-8') < 2
    || $bosses === null || $level === null || $wave === null) reply(400, ['error' => 'bad data']);
$hash = hash('sha256', $secret);

$cur = $db->prepare('SELECT secret_hash, bosses, level, wave FROM lb_players WHERE player_id = ?');
$cur->execute([$id]);
$row = $cur->fetch();
if (!$row) {
    $db->prepare('INSERT INTO lb_players (player_id, secret_hash, name, bosses, level, wave, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$id, $hash, $name, $bosses, $level, $wave, $now]);
    reply(200, ['ok' => true]);
}
if (!hash_equals($row['secret_hash'], $hash)) reply(403, ['error' => 'not your row']);
// результат в рейтинге не уменьшается; имя можно менять
$better = [$bosses, $level, $wave] > [(int)$row['bosses'], (int)$row['level'], (int)$row['wave']];
if (!$better) list($bosses, $level, $wave) = [(int)$row['bosses'], (int)$row['level'], (int)$row['wave']];
$db->prepare('UPDATE lb_players SET name = ?, bosses = ?, level = ?, wave = ?, updated_at = ? WHERE player_id = ?')
    ->execute([$name, $bosses, $level, $wave, $now, $id]);
reply(200, ['ok' => true]);
