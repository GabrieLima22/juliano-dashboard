<?php


header('Content-Type: text/html; charset=UTF-8');
ini_set('default_charset', 'UTF-8');
mb_internal_encoding('UTF-8');

require __DIR__ . '/../app/helpers.php';
require __DIR__ . '/../app/logic.php';
$cfg = require __DIR__ . '/../app/config.php';

$data = get_data(false);
[$referenceYm] = current_reference_ym((int)($cfg['PRO_LABORE_DAY'] ?? 20));

$monthNames = [
    1=>'Janeiro',2=>'Fevereiro',3=>'Março',4=>'Abril',5=>'Maio',6=>'Junho',
    7=>'Julho',8=>'Agosto',9=>'Setembro',10=>'Outubro',11=>'Novembro',12=>'Dezembro',
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
  <link rel="preload" as="image" href="./assets/CEOjml.jpg" imagesrcset="./CEOjml.jpg">
  <link rel="preload" as="image" href="./assets/CEOjml2.jpg" imagesrcset="./CEOjml2.jpg">
</head>
<body class="theme-dark bgfx" data-reference-month="<?php echo htmlspecialchars($referenceYm, ENT_QUOTES, 'UTF-8'); ?>">
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
  <div class="page">

    <!-- Banner topo (troca automÃ¡tico pelo tema) -->
    <figure class="banner banner--short" role="img"
            aria-label="Banner CEO JML: Juliano â€” Pessoas, ServiÃ§os, Tecnologias">
      <div class="banner__tools">
        <button class="chip chip--glass banner__config" type="button" data-open="config" aria-label="Abrir configuraÃ§Ãµes">
          <span>Configurações</span>
        </button>
      </div>
    </figure>

    <!-- KPIs principais -->
    <section class="kpis">
      <article class="card kpi kpi--click" role="button" tabindex="0" data-kpi="month" aria-label="Abrir detalhes do recebido no mÃªs">
        <header><span class="micro">Recebido em <?php echo htmlspecialchars($referenceLabel, ENT_QUOTES, 'UTF-8'); ?></span></header>
        <div class="kpi__value" data-bind="kpi-month">R$ 0,00</div>
      </article>

      <article class="card kpi kpi--click" role="button" tabindex="0" data-kpi="prolabore" aria-label="Abrir detalhes do prÃ³-labore">
        <header><span class="micro">Pró-labore</span></header>
        <div class="kpi__value" data-bind="kpi-pl">R$ 0,00</div>
        <div class="kpi__status"><span class="badge" data-bind="pl-badge">Em dia</span></div>
      </article>

      <article class="card kpi kpi--click" role="button" tabindex="0" data-kpi="others" aria-label="Abrir detalhes de outras origens">
        <header><span class="micro">Outras origens em <?php echo htmlspecialchars($referenceLabel, ENT_QUOTES, 'UTF-8'); ?></span></header>
        <div class="kpi__value" data-bind="kpi-others">R$ 0,00</div>
      </article>
    </section>
<section class="filters" aria-label="Filtros de dados">
  <div class="filters__header">
    <button class="filters__config-btn" type="button" data-open="config" aria-label="Abrir configurações">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6m5.2-13.2 1.4 1.4M5.4 18.4l1.4 1.4m12.8 0-1.4-1.4M5.4 5.6l1.4 1.4M19 12h6m-6 0h-6M1 12h6"/>
      </svg>
      <span>Configurações</span>
    </button>
  </div>

  <div class="filters__group">
    <span class="filters__label">Ano</span>
    <div class="filters__chips" data-filter="year" id="yearFilter">
      <!-- Gerado dinamicamente pelo JavaScript -->
    </div>
  </div>

  <div class="filters__group">
    <span class="filters__label">Mês</span>
    <div class="filters__chips" data-filter="month">
      <button type="button" class="chip chip--active" data-month="all" aria-pressed="true">Todos</button>
<?php foreach ($months as $ym): ?>
      <button type="button" class="chip" data-month="<?php echo htmlspecialchars($ym, ENT_QUOTES, 'UTF-8'); ?>" aria-pressed="false"><?php echo htmlspecialchars(month_label($ym, $monthNames), ENT_QUOTES, 'UTF-8'); ?></button>
<?php endforeach; ?>
    </div>
  </div>
  
  <div class="filters__group">
    <span class="filters__label">Origem</span>
    <div class="filters__chips" data-filter="origin">
      <button type="button" class="chip chip--active" data-origin="all" aria-pressed="true">Todas</button>
<?php foreach ($originKeys as $origin): ?>
      <button type="button" class="chip" data-origin="<?php echo htmlspecialchars($origin, ENT_QUOTES, 'UTF-8'); ?>" aria-pressed="false"><?php echo htmlspecialchars($origin, ENT_QUOTES, 'UTF-8'); ?></button>
<?php endforeach; ?>
    </div>
  </div>
  
  <div class="filters__group filters__search">
    <label class="filters__label" for="filterSearch">Buscar</label>
    <input id="filterSearch" type="search" placeholder="Filtrar por origem..." aria-label="Filtrar por origem">
  </div>
</section>


    <!-- Lista de origens -->
    <section class="list" id="originList" role="region" aria-label="Lista de origens" aria-live="polite"></section>
  </div>

  <!-- Drawer de detalhes -->
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

  <!-- Modal: Filtro Avancado (Command Palette) -->
  <section class="modal" data-modal="filter" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="filterTitle">
    <div class="modal__overlay"></div>
    <div class="modal__panel" style="max-width:880px">
      <header class="modal__head">
        <h2 id="filterTitle">Filtro Avançado</h2>
        <button type="button" class="btn btn--ghost" data-modal="close" aria-label="Fechar">Fechar</button>
      </header>
      <div class="modal__body">
        <div class="input-glass" style="margin-bottom:14px;">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 5L20.5 19l-5-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input id="paletteSearch" type="search" placeholder="Buscar origem... (Ctrl+K)" />
        </div>
        <div style="display:grid; gap:14px;">
          <div>
            <div style="font-size:11px; letter-spacing:.08em; text-transform:uppercase; opacity:.7; margin:0 0 6px;">Mes</div>
            <div id="paletteMonth" class="chips chips--scroll no-scrollbar" data-filter="month"></div>
          </div>
          <div>
            <div style="font-size:11px; letter-spacing:.08em; text-transform:uppercase; opacity:.7; margin:6px 0;">Origem</div>
            <div id="paletteOrigin" class="chips" data-filter="origin"></div>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:18px;">
          <button id="paletteClear" class="chip" type="button">Limpar</button>
          <button class="chip" type="button" data-modal="close">Aplicar</button>
        </div>
      </div>
    </div>
  </section>

  <!-- Modal de Config -->
  <section class="modal" data-modal="config" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="configTitle">
    <div class="modal__overlay"></div>
    <div class="modal__panel">
      <header class="modal__head">
        <h2 id="configTitle">Configurações</h2>
        <button type="button" class="btn btn--ghost" data-modal="close" aria-label="Fechar configurações">Fechar</button>
      </header>
      <div class="modal__body">
        <div class="config-card">
          <h3>Tema</h3>
          <div class="theme-toggle" id="themeToggle" data-active="dark">
            <label class="theme-toggle__option">
              <input type="radio" name="theme" value="dark" checked>
              <span class="theme-toggle__label"><span class="theme-toggle__icon"></span> Dark</span>
            </label>
            <label class="theme-toggle__option">
              <input type="radio" name="theme" value="light">
              <span class="theme-toggle__label"><span class="theme-toggle__icon"></span> Light</span>
            </label>
            <span class="theme-toggle__indicator" aria-hidden="true"></span>
          </div>
        </div>

        <div class="config-card">
          <h3>Cor de destaque</h3>
          <div class="hue-picker" id="huePicker">
            <div class="hue-picker__track">
              <div class="hue-picker__thumb" id="hueThumb" tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="360" aria-valuenow="145"></div>
            </div>
            <input type="range" id="hue" min="0" max="360" value="145" aria-label="Selecionar matiz">
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Modal: Mapa do PrÃ³-labore -->
  <section class="modal" data-modal="pl-tracker" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="plTrackerTitle">
    <div class="modal__overlay"></div>
    <div class="modal__panel">
      <header class="modal__head">
        <h2 id="plTrackerTitle">Mapa do Pró-labore</h2>
        <button type="button" class="btn btn--ghost" data-modal="close" aria-label="Fechar">Fechar</button>
      </header>
      <div class="modal__body">
        <div id="plTracker" class="pltrack"></div>
      </div>
    </div>
  </section>


  <script id="dataset" type="application/json"><?php echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?></script>
  <script src="./script.js?v=<?php echo urlencode((string)($data['created_at'] ?? time())); ?>" defer></script>

  <script>
(function(){
  const POLL_MS = 5 * 60 * 1000; // 5 min
  async function refreshData() {
    try {
      const res = await fetch('./api.php?refresh=1', { cache: 'no-store' });
      if(!res.ok) return;
      const json = await res.json();
      // Atualiza o <script id="dataset">, para teu script.js reaproveitar
      const ds = document.getElementById('dataset');
      if (ds) ds.textContent = JSON.stringify(json);
      // Dispara um evento para teu script.js re-renderizar a UI
      window.dispatchEvent(new CustomEvent('data:updated', { detail: json }));
    } catch(e){}
  }
  // 1) atualiza uma vez ao abrir
  refreshData();
  // 2) segue atualizando em intervalo
  setInterval(refreshData, POLL_MS);
})();
</script>

</body>
</html>
