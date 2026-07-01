<?php
// Utilidades sueltas compartidas por los controllers.

// id con prefijo, equivalente a `${prefix}-${randomUUID()}` del Node
function gen_id($prefix) {
    return $prefix . '-' . uuidv4();
}

function uuidv4() {
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40); // version 4
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80); // variant
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

// milisegundos epoch actuales (equivalente a Date.now())
function now_ms() {
    return (int) round(microtime(true) * 1000);
}

// ms epoch -> string ISO-8601 con milisegundos y Z, igual a Date.toISOString()
function iso_from_ms($ms) {
    $s  = intdiv($ms, 1000);
    $ms = $ms % 1000;
    return gmdate('Y-m-d\TH:i:s', $s) . sprintf('.%03dZ', $ms);
}

// timestamp ISO del momento actual
function now_iso() {
    return iso_from_ms(now_ms());
}

// milisegundos epoch a partir de un string ISO (para comparar vencimientos)
function iso_to_ms($iso) {
    if (!$iso) return 0;
    $ts = strtotime($iso);
    return $ts === false ? 0 : $ts * 1000;
}

// 7 dias en ms, el ciclo de vigencia por defecto de las plantillas
define('SIETE_DIAS_MS', 7 * 24 * 60 * 60 * 1000);

// json_encode con los flags del proyecto
function jenc($v) {
    return json_encode($v, JSON_FLAGS);
}

// json_encode legible (indentado) para escribir los archivos de datos
function jenc_pretty($v) {
    return json_encode($v, JSON_FLAGS | JSON_PRETTY_PRINT);
}

// json_decode tolerante; assoc=false conserva la diferencia entre {} y []
function jdec($s, $assoc = false) {
    if ($s === null || $s === '') return null;
    return json_decode($s, $assoc);
}

// lee un campo de un item que puede venir como array asociativo o como objeto
function field($m, $k, $def = null) {
    if (is_array($m))  return array_key_exists($k, $m) ? $m[$k] : $def;
    if (is_object($m)) return isset($m->$k) ? $m->$k : $def;
    return $def;
}
