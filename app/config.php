<?php
// app/config.php
return [
  'APP_NAME'        => 'RECEBIMENTOS JULIANO',
  'CSV_JULIANO'     => 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTUd_2Ytco1v6SbiUy8X4qcVKKqomoIZQprtTYpqWd_oWA7BI851CLOpGnmtHwXSufF0u_38t2mz5hZ/pub?gid=0&single=true&output=csv',
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
