<?php
declare(strict_types=1);

header('Content-Type: text/html; charset=UTF-8');
ini_set('default_charset', 'UTF-8');
mb_internal_encoding('UTF-8');

require __DIR__ . '/../app/helpers.php';
require __DIR__ . '/../app/logic.php';
$cfg = require __DIR__ . '/../app/config.php';

$data = get_data(false);
[$referenceYm] = current_reference_ym((int)($cfg['PRO_LABORE_DAY'] ?? 20));

$monthNames = [
    1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril', 5 => 'Maio', 6 => 'Junho',
    7 => 'Julho', 8 => 'Agosto', 9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro',
];

$monthTotals = $data['kpis']['by_month'] ?? [];
$months = array_keys($monthTotals);
rsort($months);
$months = array_slice($months, 0, 12);

$originTotals = $data['kpis']['by_origin'] ?? [];
$originKeys = array_keys($originTotals);
sort($originKeys, SORT_NATURAL | SORT_FLAG_CASE);

function month_label(string $ym, array $names): string
{
    if (!preg_match('/^(\d{4})-(\d{2})$/', $ym, $match)) {
        return $ym;
    }
    $year = (int)$match[1];
    $month = (int)$match[2];
    $label = $names[$month] ?? $ym;
    return sprintf('%s-%d', $label, $year);
}

$referenceLabel = month_label($referenceYm, $monthNames);
$lastSync = isset($data['created_at']) ? date('d/m/Y H:i', (int)$data['created_at']) : '-';
?>
<!DOCTYPE html>
<html lang="pt-BR" class="theme-dark">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Recebimentos Juliano</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="./assets/style.css?v=<?php echo urlencode((string)($data['created_at'] ?? time())); ?>">
  <link rel="preload" as="image" href="./assets/CEOjml.jpg" imagesrcset="./assets/CEOjml.jpg">
<link rel="preload" as="image" href="./assets/CEOjml2.jpg" imagesrcset="./assets/CEOjml2.jpg">
</head>
<body class="theme-dark bgfx" data-reference-month="<?php echo htmlspecialchars($referenceYm, ENT_QUOTES, 'UTF-8'); ?>">
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
  <div class="page">
        <!-- Banner topo (troca automÃ¡tico pelo tema) -->
   <figure class="banner" role="img"
        aria-label="Banner CEO JML: Juliano — Pessoas, Serviços, Tecnologias">
      <div class="banner__tools">
        <button class="chip banner__config" type="button" data-open="config" aria-label="Abrir configurações">
          Configurações
        </button>
      </div>
    </figure>

    <section class="kpis">
      <article class="card kpi" data-kpi="month" role="button" tabindex="0" aria-label="Abrir detalhes do mês">
        <header>
          <span class="micro">Recebido em <?php echo htmlspecialchars($referenceLabel, ENT_QUOTES, 'UTF-8'); ?></span>
        </header>
        <div class="kpi__value" data-bind="kpi-month">R$ 0,00</div>
      </article>
      <article class="card kpi" data-kpi="prolabore" role="button" tabindex="0" aria-label="Abrir detalhes do pró-labore">
        <header>
          <span class="micro">Pró-labore</span>
        </header>
        <div class="kpi__stack">
          <div class="kpi__line"><span class="muted">Cobre até</span><strong data-bind="pl-covers"></strong></div>
          <div class="kpi__line"><span class="badge" data-bind="pl-badge">Em dia</span></div>
          <div class="kpi__line" data-bind="pl-extra">—</div>
        </div>
      </article>
      <article class="card kpi" data-kpi="others" role="button" tabindex="0" aria-label="Abrir detalhes de outras origens">
        <header>
          <span class="micro">Outras origens em <?php echo htmlspecialchars($referenceLabel, ENT_QUOTES, 'UTF-8'); ?></span>
        </header>
        <div class="kpi__value" data-bind="kpi-others">R$ 0,00</div>
      </article>
    </section>

    <section class="filters card filters--list" aria-label="Filtros de dados">
      <div class="filters__group">
        <span class="micro">Mês</span>
        <div class="chips" data-filter="month">
          <button type="button" class="chip chip--active" data-month="all" aria-pressed="false">Todos</button>
<?php foreach ($months as $ym): ?>
          <button type="button" class="chip" data-month="<?php echo htmlspecialchars($ym, ENT_QUOTES, 'UTF-8'); ?>" aria-pressed="false"><?php echo htmlspecialchars(month_label($ym, $monthNames), ENT_QUOTES, 'UTF-8'); ?></button>
<?php endforeach; ?>
        </div>
      </div>
      <div class="filters__group">
        <span class="micro">Origem</span>
        <div class="chips" data-filter="origin">
          <button type="button" class="chip chip--active" data-origin="all" aria-pressed="false">Todas</button>
<?php foreach ($originKeys as $origin): ?>
          <button type="button" class="chip" data-origin="<?php echo htmlspecialchars($origin, ENT_QUOTES, 'UTF-8'); ?>" aria-pressed="false"><?php echo htmlspecialchars($origin, ENT_QUOTES, 'UTF-8'); ?></button>
<?php endforeach; ?>
        </div>
      </div>
      <div class="filters__group filters__search">
        <label class="micro" for="filterSearch">Busca por origem</label>
        <input id="filterSearch" type="search" placeholder="Filtrar por origem" aria-label="Filtrar por origem">
      </div>
    </section>

    <section class="list" id="originList" role="region" aria-label="Lista de origens" aria-live="polite"></section>
  </div>

  <aside class="drawer" data-state="closed" aria-hidden="true">
    <div class="drawer__overlay"></div>
    <div class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
      <header class="drawer__head">
        <button class="btn btn--ghost drawer__close" type="button" data-drawer="close" aria-label="Fechar detalhes">Fechar</button>
        <div>
          <h3 class="drawer__title" id="drawerTitle" data-bind="drawer-title">Detalhes</h3>
          <p class="drawer__subtitle" data-bind="drawer-subtitle"></p>
        </div>
      </header>
      <div class="drawer__body" data-bind="drawer-body"></div>
    </div>
  </aside>

  <section class="modal" data-modal="config" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="configTitle">
    <div class="modal__overlay"></div>
    <div class="modal__panel">
      <header class="modal__head">
        <h2 id="configTitle">ConfiguraÃ§Ãµes</h2>
        <button type="button" class="btn btn--ghost" data-modal="close" aria-label="Fechar configuraÃ§Ãµes">Fechar</button>
      </header>
      <div class="modal__body">
        <div class="config-card">
          <h3>Tema</h3>
          <label><input type="radio" name="theme" value="dark" checked> Escuro</label>
          <label><input type="radio" name="theme" value="light"> Claro</label>
        </div>
        <div class="config-card">
          <h3>Cor de destaque</h3>
          <div class="hue-picker" id="huePicker">
            <div class="hue-picker__track">
              <div class="hue-picker__thumb" id="hueThumb" tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="360" aria-valuenow="145"></div>
            </div>
            <div class="hue-picker__info">
              <span class="micro">Matiz atual: <strong id="hueValue">145Â°</strong></span>
              <span class="hue-picker__preview" id="hueNow"></span>
            </div>
          </div>
          <input type="range" id="hue" min="0" max="360" value="145" aria-label="Selecionar matiz">
        </div>
      </div>
    </div>
  </section>

  <script id="dataset" type="application/json"><?php echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?></script>
 <script src="./script.js?v=<?php echo urlencode((string)($data['created_at'] ?? time())); ?>" defer></script>

</body>
</html>
