<?php
// app/helpers.php
declare(strict_types=1);

/* =========================
   CONFIG
========================= */
function cfg(string $key)
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = require __DIR__ . '/config.php';
    }
    return $cfg[$key] ?? null;
}

/* =========================
   STR / NORMALIZAÇÃO
========================= */
function _u($value): string
{
    if ($value === null) {
        return '';
    }
    $value = (string) $value;
    $enc = mb_detect_encoding($value, ['UTF-8', 'ISO-8859-1', 'Windows-1252'], true);
    return $enc && $enc !== 'UTF-8' ? mb_convert_encoding($value, 'UTF-8', $enc) : $value;
}

function squash_spaces(string $value): string
{
    $value = str_replace(["\xC2\xA0", "\xE2\x80\x8B"], ' ', _u($value));
    $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
    return trim($value);
}

function remove_accents(string $value): string
{
    $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', _u($value));
    return $converted !== false ? $converted : $value;
}

function normalize_header_key(string $header): string
{
    $header = mb_strtolower(squash_spaces(remove_accents($header)), 'UTF-8');
    $map = [
        'origem'      => 'origem',
        'pagamento 1' => 'pagamento_1',
        'pgto 1'      => 'pagamento_1',
        'data 1'      => 'data_1',
        'pagamento 2' => 'pagamento_2',
        'data 2'      => 'data_2',
        'pagamento 3' => 'pagamento_3',
        'data 3'      => 'data_3',
        'pagamento 4' => 'pagamento_4',
        'data 4'      => 'data_4',
        'pagamento 5' => 'pagamento_5',
        'data 5'      => 'data_5',
    ];
    if (isset($map[$header])) {
        return $map[$header];
    }
    $header = preg_replace('/[^a-z0-9]+/', '_', $header) ?? $header;
    return trim($header, '_');
}

/* =========================
   CSV
========================= */
function csv_get_assoc(string $pathOrUrl): array
{
    if (preg_match('#^https?://#i', $pathOrUrl)) {
        $ctx = stream_context_create(['http' => ['timeout' => 25, 'header' => "User-Agent: PHP\r\n"]]);
        $handle = @fopen($pathOrUrl, 'r', false, $ctx);
    } else {
        $handle = @fopen($pathOrUrl, 'r');
    }

    if (!$handle) {
        return [];
    }

    $head = fgetcsv($handle, 0, ',', '"', '\\');
    if ($head === false) {
        fclose($handle);
        return [];
    }

    $separator = count($head) === 1 ? ';' : ',';
    if ($separator === ';') {
        rewind($handle);
        $head = fgetcsv($handle, 0, ';', '"', '\\');
    }

    $header = array_map('normalize_header_key', $head);
    $rows = [];
    while (($data = fgetcsv($handle, 0, $separator, '"', '\\')) !== false) {
        if (count($data) === 1 && ($data[0] === null || trim((string)$data[0]) === '')) {
            continue;
        }
        $row = [];
        foreach ($header as $i => $key) {
            $row[$key] = _u($data[$i] ?? '');
        }
        $rows[] = $row;
    }
    fclose($handle);
    return $rows;
}

/* =========================
   MONEY / DATES / ORIGIN
========================= */
function parse_money($value): float
{
    if ($value === null) {
        return 0.0;
    }
    $value = mb_strtolower(trim(_u($value)), 'UTF-8');
    $value = str_replace(['r$', ' '], '', $value);
    $value = str_replace('.', '', $value);
    $value = str_replace(',', '.', $value);
    return is_numeric($value) ? (float)$value : 0.0;
}

function parse_date_any($value): ?string
{
    $value = trim(_u($value));
    if ($value === '') {
        return null;
    }

    if (preg_match('/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/', $value, $match)) {
        $day = (int)$match[1];
        $month = (int)$match[2];
        $year = (int)$match[3];
        if ($year < 100) {
            $year += 2000;
        }
        if (checkdate($month, $day, $year)) {
            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }
    }

    if (preg_match('/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/', $value, $match)) {
        $year = (int)$match[1];
        $month = (int)$match[2];
        $day = (int)$match[3];
        if (checkdate($month, $day, $year)) {
            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }
    }

    $timestamp = @strtotime($value);
    return $timestamp ? date('Y-m-d', $timestamp) : null;
}

function normalize_origin(?string $value, array $aliases): string
{
    $value = trim((string)$value);
    if ($value === '') {
        return '-';
    }

    $normalizedKey = mb_strtoupper(remove_accents(str_replace(['  ', ' - '], [' ', '-'], $value)), 'UTF-8');
    foreach ($aliases as $alias => $target) {
        $aliasKey = mb_strtoupper(remove_accents($alias), 'UTF-8');
        if ($normalizedKey === $aliasKey) {
            return $target;
        }
    }

    return $normalizedKey;
}

function dmy(?string $iso): string
{
    if (!$iso) {
        return '--';
    }
    $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $iso);
    return $dt ? $dt->format('d/m/Y') : '--';
}

function brl(float $value): string
{
    return 'R$ ' . number_format($value, 2, ',', '.');
}

function add_months_ym(string $ym, int $offset): string
{
    [$year, $month] = array_map('intval', explode('-', $ym));
    $dt = DateTimeImmutable::createFromFormat('!Y-m-d', sprintf('%04d-%02d-01', $year, $month));
    $dt = $dt ? $dt->modify(($offset >= 0 ? '+' : '') . $offset . ' months') : new DateTimeImmutable('first day of this month');
    return $dt->format('Y-m');
}

function diff_months(string $startYm, string $endYm): int
{
    [$y1, $m1] = array_map('intval', explode('-', $startYm));
    [$y2, $m2] = array_map('intval', explode('-', $endYm));
    return ($y2 - $y1) * 12 + ($m2 - $m1);
}

function current_reference_ym(int $day): array
{
    $today = new DateTimeImmutable('today');
    $cut = $today->setDate((int)$today->format('Y'), (int)$today->format('m'), $day);
    $reference = $today;
    if ($today < $cut) {
        $reference = $reference->modify('first day of last month');
    } else {
        $reference = $reference->modify('first day of this month');
    }
    return [$reference->format('Y-m'), $cut->getTimestamp()];
}

function normalize_anchor(string $value): string
{
    $value = trim(_u($value));
    if (preg_match('/^\d{4}[-\/]\d{2}$/', $value)) {
        return str_replace('/', '-', $value);
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return substr($value, 0, 7);
    }
    $timestamp = @strtotime('01 ' . $value);
    return $timestamp ? date('Y-m', $timestamp) : (cfg('ANCHOR_MONTH') ?? '2025-01');
}

/* =========================
   PIPELINE JULIANO (CSV)
========================= */
function read_rows_csv(): array
{
    $src = cfg('CSV_JULIANO');
    if (!$src) {
        return [];
    }
    return csv_get_assoc($src);
}

function explode_transactions_from_row(array $row, array $cfg): array
{
    $aliases = $cfg['ORIGIN_ALIASES'] ?? [];
    $proKey = normalize_origin('PRÓ-LABORE', $aliases);
    $origin = normalize_origin($row['origem'] ?? '', $aliases);
    $isProLabore = ($origin === $proKey);

    $out = [];
    for ($i = 1; $i <= 5; $i++) {
        $amount = parse_money($row["pagamento_{$i}"] ?? 0);
        $date   = parse_date_any($row["data_{$i}"] ?? null);
        if ($amount <= 0 || !$date) {
            continue;
        }
        $out[] = [
            'origin' => $origin,
            'amount' => round($amount, 2),
            'date'   => $date,
            'ym'     => substr($date, 0, 7),
            'is_pl'  => $isProLabore,
        ];
    }

    return $out;
}

function build_dataset_from_csv(array $rows, array $cfg): array
{
    $transactions = [];
    foreach ($rows as $row) {
        if (trim((string)($row['origem'] ?? '')) === '') {
            continue;
        }
        $transactions = array_merge($transactions, explode_transactions_from_row($row, $cfg));
    }

    usort($transactions, static fn(array $a, array $b): int => strcmp($a['date'], $b['date']));

    $receivedTotal = 0.0;
    $byMonth = [];
    $byOrigin = [];
    $plCredit = 0.0;

    foreach ($transactions as $tx) {
        $receivedTotal += $tx['amount'];
        $byMonth[$tx['ym']] = ($byMonth[$tx['ym']] ?? 0.0) + $tx['amount'];
        $byOrigin[$tx['origin']] = ($byOrigin[$tx['origin']] ?? 0.0) + $tx['amount'];
        if (!empty($tx['is_pl'])) {
            $plCredit += $tx['amount'];
        }
    }

    $target   = (float)($cfg['PRO_LABORE_TARGET'] ?? 24000);
    $payday   = (int)($cfg['PRO_LABORE_DAY'] ?? 20);
    $anchorYM = normalize_anchor((string)($cfg['ANCHOR_MONTH'] ?? '2025-01'));

    $coveredMonths = $target > 0 ? (int)floor($plCredit / $target) : 0;
    $residual      = $target > 0 ? max(0.0, $plCredit - $coveredMonths * $target) : 0.0;

    $coversUntil = add_months_ym($anchorYM, max(0, $coveredMonths - 1));
    $nextMonth   = add_months_ym($anchorYM, $coveredMonths);
    [$referenceYm, $referenceCutTs] = current_reference_ym($payday);
    $delta       = diff_months($coversUntil, $referenceYm);
    $missingForNext   = max(0.0, $target - $residual);
    $advancedForNext  = ($residual >= $target && $target > 0) ? fmod($residual, $target) : 0.0;

    $normalizedTransactions = array_map(static function (array $tx): array {
        return [
            'origin' => $tx['origin'],
            'amount' => (float)$tx['amount'],
            'date'   => $tx['date'],
            'ym'     => $tx['ym'],
            'is_pl'  => !empty($tx['is_pl']),
        ];
    }, $transactions);

    return [
        'created_at' => time(),
        'kpis' => [
            'received_total' => round($receivedTotal, 2),
            'by_month'       => array_map(static fn($v) => round($v, 2), $byMonth),
            'by_origin'      => array_map(static fn($v) => round($v, 2), $byOrigin),
        ],
        'transactions' => $normalizedTransactions,
        'pro_labore' => [
            'monthly_target'    => $target,
            'payday_day'        => $payday,
            'anchor_month'      => $anchorYM,
            'credit_total'      => round($plCredit, 2),
            'covered_months'    => $coveredMonths,
            'residual'          => round($residual, 2),
            'covers_until'      => $coversUntil,
            'next_month_label'  => $nextMonth,
            'delta_vs_today'    => $delta,
            'missing_for_next'  => round($missingForNext, 2),
            'advanced_for_next' => round($advancedForNext, 2),
            'reference_ym'      => $referenceYm,
            'reference_cut_ts'  => $referenceCutTs,
        ],
    ];
}

/* =========================
   CACHE
========================= */
function get_data(bool $force = false): array
{
    $cache = cfg('CACHE_FILE');

    if (!$force && is_file($cache)) {
        $json = json_decode(@file_get_contents($cache), true);
        if (is_array($json)) {
            return $json;
        }
    }

    $rows = read_rows_csv();
    $cfg = require __DIR__ . '/config.php';
    $data = build_dataset_from_csv($rows, $cfg);

    if (!is_dir(dirname($cache))) {
        @mkdir(dirname($cache), 0777, true);
    }

    @file_put_contents($cache, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    return $data;
}
