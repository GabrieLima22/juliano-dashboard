<?php
// app/config.php
return [
  'APP_NAME'        => 'RECEBIMENTOS JULIANO',
  'CSV_JULIANO'     => 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSESqMGBflGDma7L2YWefu820XuG8x3LvPv6kXno7eD9Ox7JhTZ0SAQceupm1z1itQBNSjwqvF1ZmHF/pub?gid=0&single=true&output=csv',
  'CACHE_FILE'      => __DIR__ . '/../cache/data.json',

  'PRO_LABORE_TARGET' => 24000,
  'PRO_LABORE_DAY'    => 20,
  'ANCHOR_MONTH'      => '2025-01',

  'ORIGIN_ALIASES' => [
    'PRÓ-LABORE'       => 'PRÓ-LABORE',
    'PRO-LABORE'       => 'PRÓ-LABORE',
    'PRÓ LABORE'       => 'PRÓ-LABORE',
    'PRO LABORE'       => 'PRÓ-LABORE',
    'PROLABORE'        => 'PRÓ-LABORE',

    'AJUDA DE CUSTO'          => 'AJUDA DE CUSTO',
    'AJUDA DE CUSTO - BRASIL' => 'AJUDA DE CUSTO - BRASIL',
    'PREMIAÇÃO'               => 'PREMIAÇÃO',
    'PREMIAÇÃO SESCOOP'       => 'PREMIAÇÃO SESCOOP',
    'PASSAGEM AÉREA'          => 'PASSAGEM AÉREA',
    'PASSAGEM AEREA'          => 'PASSAGEM AÉREA',
  ],
];