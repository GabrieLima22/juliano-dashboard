
(function(){
  "use strict";

  var root = document.documentElement;
  var body = document.body;

var MONTHS = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var POLL_INTERVAL = 5 * 60 * 1000;  // auto-sync a cada 5min
  var storageThemeKey = 'juliano:theme';
  var storageHueKey = 'juliano:hue';
  var isSyncing = false;
  var pollTimer = null;
  var lastKpiView = null; // 'month' | 'prolabore' | 'others'

  // modal e container do "Mapa do Pró-labore"
  var plModal = document.querySelector('.modal[data-modal="pl-tracker"]');
  var plContainer = document.getElementById('plTracker');

  function safeJSON(){
    var el = document.getElementById('dataset');
    if(!el || !el.textContent){ return {}; }
    try{ return JSON.parse(el.textContent); }catch(error){ return {}; }
  }

  function toNumber(value){
    var n = Number(value);
    return isNaN(n) ? 0 : n;
  }

  function esc(value){
    value = value == null ? '' : String(value);
    return value.replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]);
    });
  }

  function escAttr(value){
    return esc(value).replace(/\n/g, '&#10;');
  }

  function formatBRL(value){
    return 'R$ ' + Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseLocalISO(iso){
    if(!iso) return null;
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if(!match) return null;
    var dt = new Date(+match[1], +match[2] - 1, +match[3]);
    if(isNaN(dt.getTime())) return null;
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  function dmyLocal(iso){
    var dt = parseLocalISO(iso);
    return dt ? dt.toLocaleDateString('pt-BR') : '--';
  }

  function timeLocal(iso){
    var dt = parseLocalISO(iso);
    return dt ? dt.getTime() : 0;
  }

  function monthLabel(ym){
    if(!ym || !/^(\d{4})-(\d{2})$/.test(ym)) return ym || '--';
    var parts = ym.split('-');
    return (MONTHS[parseInt(parts[1], 10)] || parts[1]) + '-' + parts[0];
  }

  function formatTimestamp(seconds){
    if(!seconds) return '-';
    var dt = new Date(seconds * 1000);
    if(isNaN(dt.getTime())) return '-';
    return dt.toLocaleString('pt-BR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  function debounce(fn, delay){
    var timer;
    return function(){
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function(){ fn.apply(ctx, args); }, delay || 150);
    };
  }

  function showToast(message, kind){
    if(!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.classList.toggle('toast--error', kind === 'error');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.hidden = true; }, 5000);
  }

  function normalizeTransactions(raw){
    if(!Array.isArray(raw)) return [];
    return raw.map(function(item){
      return {
        origin: String(item && item.origin ? item.origin : '-'),
        amount: toNumber(item && item.amount),
        date: item && item.date ? item.date : null,
        ym: item && item.ym ? item.ym : (item && item.date ? String(item.date).slice(0,7) : ''),
        is_pl: Boolean(item && item.is_pl)
      };
    });
  }

  function getInitialReference(){
    if(proLabore.reference_ym){
      return proLabore.reference_ym;
    }
    var attr = body.getAttribute('data-reference-month');
    return attr || computeReferenceMonth(proLabore.payday_day || 20);
  }

  function computeReferenceMonth(day){
    var cutoff = Number(day) || 20;
    var now = new Date();
    var base = new Date(now.getFullYear(), now.getMonth(), 1);
    var cut = new Date(now.getFullYear(), now.getMonth(), cutoff);
    if(now < cut){
      base.setMonth(base.getMonth() - 1);
    }
    return base.getFullYear() + '-' + String(base.getMonth() + 1).padStart(2, '0');
  }

  function setActiveChip(container, value, attr){
  if(!container) return;
  container.querySelectorAll('.chip').forEach(function(chip){
    var isActive = chip.getAttribute(attr) === value;
    chip.classList.toggle('chip--active', isActive);
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}
  function rebuildYearChips(){
    var yearFilterEl = document.getElementById('yearFilter');
    if(!yearFilterEl) return;

    // Extrair anos únicos dos meses disponíveis
    var years = {};
    Object.keys(totalsByMonth || {}).forEach(function(ym){
      var match = /^(\d{4})-\d{2}$/.exec(ym);
      if(match) years[match[1]] = true;
    });

    var yearList = Object.keys(years).sort().reverse();

    var html = yearList.map(function(year){
      return '<button type="button" class="chip" data-year="' + escAttr(year) + '" aria-pressed="false">' + esc(year) + '</button>';
    }).join('');

    yearFilterEl.innerHTML = html;
  }

  function rebuildMonthChips(){
    if(!monthFilterEl) return;

    // Filtrar meses baseado no ano selecionado
    var months = Object.keys(totalsByMonth || {}).filter(function(ym){
      if(!state.year) return true;
      return ym.startsWith(state.year + '-');
    });
    months.sort().reverse();

    var html = '<button type="button" class="chip" data-month="all" aria-pressed="false">Todos</button>';
    html += months.map(function(ym){
      return '<button type="button" class="chip" data-month="' + escAttr(ym) + '" aria-pressed="false">' + esc(monthLabel(ym)) + '</button>';
    }).join('');

    monthFilterEl.innerHTML = html;

    // Se o mês selecionado não existe mais no ano filtrado, resetar para "all"
    if(state.month !== 'all' && !months.includes(state.month)){
      state.month = 'all';
    }
  }

  function rebuildOriginChips(){
    if(!originFilterEl) return;

    // Filtrar origens baseado no mês selecionado
    var filteredOrigins = {};
    if(state.month !== 'all'){
      transactions.forEach(function(item){
        if(item.ym === state.month){
          filteredOrigins[item.origin] = true;
        }
      });
    } else {
      // Se "Todos", mostrar todas as origens
      Object.keys(totalsByOrigin || {}).forEach(function(origin){
        filteredOrigins[origin] = true;
      });
    }

    var origins = Object.keys(filteredOrigins);
    origins.sort(function(a,b){ return a.localeCompare(b, 'pt-BR'); });

    var html = '<button type="button" class="chip" data-origin="all" aria-pressed="false"><span class="dot"></span>Todas</button>';
    html += origins.map(function(origin){
      return '<button type="button" class="chip" data-origin="' + escAttr(origin) + '" aria-pressed="false"><span class="dot"></span>' + esc(origin) + '</button>';
    }).join('');

    originFilterEl.innerHTML = html;

    // Se a origem selecionada não existe mais, resetar para "all"
    if(state.origin !== 'all' && !filteredOrigins[state.origin]){
      state.origin = 'all';
    }
  }

  // Segmented months (V4) – inclui mês corrente e referência
  function buildSegMonths(){
    if(!segMonthsEl) return;
    var set = Object.create(null);
    Object.keys(totalsByMonth || {}).forEach(function(k){ set[k]=1; });
    if(referenceMonth) set[referenceMonth]=1;
    (function(){ var d=new Date(); var nowYm=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); set[nowYm]=1; })();
    var list = Object.keys(set).filter(function(k){ return /^(\d{4})-(\d{2})$/.test(k); }).sort().reverse().slice(0,6);

    var inner = '<div class="thumb"></div>' + ['all'].concat(list).map(function(v){
      return '<button type="button" data-val="'+escAttr(v)+'">'+ (v==='all' ? 'Todos' : esc(monthLabel(v))) +'</button>';
    }).join('');
    segMonthsEl.innerHTML = inner;

    if(segMonthsEl.__inited) { segMonthsEl.__highlight && segMonthsEl.__highlight(state.month || 'all'); return; }
    segMonthsEl.__inited = true;
    var thumb = segMonthsEl.querySelector('.thumb');
    function moveThumb(target){
      if(!thumb || !target) return;
      var r = target.getBoundingClientRect();
      var pr = segMonthsEl.getBoundingClientRect();
      var x = r.left - pr.left + 2;
      thumb.style.transform = 'translateX('+x+'px)';
      thumb.style.width = r.width + 'px';
    }
    function highlight(val){
      segMonthsEl.querySelectorAll('button[data-val]').forEach(function(b){ b.classList.toggle('is-active', b.getAttribute('data-val')===val); });
      var active = segMonthsEl.querySelector('button[data-val="'+CSS.escape(val)+'"]') || segMonthsEl.querySelector('button[data-val]');
      moveThumb(active);
    }
    segMonthsEl.__highlight = highlight;
    segMonthsEl.addEventListener('click', function(e){
      var b = e.target.closest('button[data-val]'); if(!b) return;
      state.month = b.getAttribute('data-val');
      setActiveChip(monthFilterEl, state.month, 'data-month');
      rebuildOriginChips(); // Reconstruir filtros de origem baseado no mês
      setActiveChip(originFilterEl, state.origin, 'data-origin');
      calcKpis(); renderList();
      // Atualiza tags ativas da barra
      var activeFiltersEl = document.getElementById('activeFilters');
      if(activeFiltersEl){
        var tags=[];
        if(state.month !== 'all'){ tags.push('<span class="filter-tag" data-kind="month">Mês: '+esc(monthLabel(state.month))+' <button data-remove="month" aria-label="Remover mês">×</button></span>'); }
        if(state.origin !== 'all'){ tags.push('<span class="filter-tag" data-kind="origin">Origem: '+esc(state.origin)+' <button data-remove="origin" aria-label="Remover origem">×</button></span>'); }
        if(state.q){ tags.push('<span class="filter-tag" data-kind="q">Busca: '+esc(state.q)+' <button data-remove="q" aria-label="Limpar busca">×</button></span>'); }
        activeFiltersEl.innerHTML = tags.join('') || '<span>Nenhum filtro ativo</span>';
      }
      highlight(state.month);
      b.classList.add('pop'); setTimeout(function(){ b.classList.remove('pop'); }, 320);
    });
    window.addEventListener('resize', function(){ highlight(state.month || 'all'); });
    highlight(state.month || 'all');
  }

  function getTargetMonth(){
    if(state.month !== 'all'){
      return state.month;
    }
    if(proLabore.reference_ym){
      return proLabore.reference_ym;
    }
    return referenceMonth || '';
  }

  function filteredTransactions(){
    return transactions.filter(function(item){
      if(state.month !== 'all' && item.ym !== state.month) return false;
      if(state.origin !== 'all' && item.origin !== state.origin) return false;
      if(state.q && item.origin.toLowerCase().indexOf(state.q) === -1) return false;
      return true;
    });
  }

  function calcKpis(){
    var targetMonth = getTargetMonth();
    var relevant = transactions.filter(function(item){
      var monthOk = targetMonth ? (item.ym === targetMonth) : true;
      if(!monthOk) return false;
      if(state.origin !== 'all' && item.origin !== state.origin) return false;
      if(state.q && item.origin.toLowerCase().indexOf(state.q) === -1) return false;
      return true;
    });

    var monthTotal = relevant.reduce(function(sum, item){ return sum + item.amount; }, 0);
    var proTotal = relevant.reduce(function(sum, item){ return sum + (item.is_pl ? item.amount : 0); }, 0);
    var othersTotal = Math.max(0, monthTotal - proTotal);
    var label = targetMonth ? monthLabel(targetMonth) : 'Todos';

    if(kpiMonthEl){
      var head = kpiMonthEl.closest('.kpi');
      if(head){
        var micro = head.querySelector('header .micro');
        if(micro){ micro.textContent = 'Recebido em ' + label; }
      }
      kpiMonthEl.textContent = formatBRL(monthTotal);
    }

    if(kpiOthersEl){
      var head2 = kpiOthersEl.closest('.kpi');
      if(head2){
        var micro2 = head2.querySelector('header .micro');
        if(micro2){ micro2.textContent = 'Outras origens em ' + label; }
      }
      kpiOthersEl.textContent = formatBRL(othersTotal);
    }

    if(plCoversEl){
      plCoversEl.textContent = proLabore.covers_until ? monthLabel(proLabore.covers_until) : '--';
    }

    // total PL no recorte atual
    var plTotalFiltered = relevant.reduce(function(sum, it){ return sum + (it.is_pl ? it.amount : 0); }, 0);
    var kpiPlEl = document.querySelector('[data-bind="kpi-pl"]');
    if(kpiPlEl){ kpiPlEl.textContent = formatBRL(plTotalFiltered); }

    // status (classe + texto coerentes)
    if (plBadgeEl){
      var delta = toNumber(proLabore.delta_vs_today); // + = atrasado, - = adiantado
      plBadgeEl.className = 'badge';
      if (delta > 0){
        plBadgeEl.classList.add('badge--negative');
        plBadgeEl.textContent = 'Atrasado +' + delta + 'm';
      } else if (delta === 0){
        plBadgeEl.textContent = 'Em dia';
      } else {
        plBadgeEl.classList.add('badge--positive');
        plBadgeEl.textContent = 'Adiantado ' + Math.abs(delta) + 'm';
      }
    }

    // removemos o texto "extra" do cartÃ£o (vai pro detalhe)
    if(plExtraEl){ plExtraEl.textContent = ''; }
  }

  function renderList(){
    if(!originListEl) return;
    var filtered = filteredTransactions();
    if(!filtered.length){
      originListEl.innerHTML = '<div class="card empty">Nenhum lançamento encontrado para o filtro atual.</div>';
      return;
    }

    var groups = Object.create(null);
    filtered.forEach(function(item){
      var key = item.origin || '-';
      if(!groups[key]){
        groups[key] = { origin: key, total: 0, count: 0 };
      }
      groups[key].total += item.amount;
      groups[key].count += 1;
    });

    var items = Object.keys(groups).map(function(key){ return groups[key]; });
    items.sort(function(a, b){ return (b.total || 0) - (a.total || 0); });

    var monthChip = state.month !== 'all' ? '<span class="chip chip--ghost">' + esc(monthLabel(state.month)) + '</span>' : '';
    var html = items.map(function(group){
      return '<article class="card origin-card js-origin" role="listitem" tabindex="0" data-origin="' + escAttr(group.origin) + '">' +
               '<header class="origin-card__head"><h3>' + esc(group.origin) + '</h3>' + monthChip + '</header>' +
               '<div class="origin-card__value">' + formatBRL(group.total) + '</div>' +
               '<div class="origin-card__meta">' + group.count + ' lançamento' + (group.count === 1 ? '' : 's') + '</div>' +
             '</article>';
    }).join('');

    originListEl.innerHTML = '<div role="list" class="origin-list">' + html + '</div>';
  }

  function openDrawer(origin){
    if(!drawer) return;
    var filtered = filteredTransactions().filter(function(item){ return item.origin === origin; });
    var total = filtered.reduce(function(sum, item){ return sum + item.amount; }, 0);

    if(drawerTitle){ drawerTitle.textContent = origin; }
    if(drawerSubtitle){
      var tokens = [];
      if(state.month !== 'all'){ tokens.push(monthLabel(state.month)); }
      tokens.push(filtered.length + ' lançamento' + (filtered.length === 1 ? '' : 's'));
      drawerSubtitle.textContent = tokens.join(' - ');
    }

    if(drawerBody){
      var lines = filtered.slice().sort(function(a,b){ return timeLocal(b.date) - timeLocal(a.date); }).map(function(item){
        return '<div class="info-line">' +
                 '<div><strong>' + dmyLocal(item.date) + '</strong><span>' + esc(item.ym || '--') + '</span></div>' +
                 '<span class="tag">' + formatBRL(item.amount) + '</span>' +
               '</div>';
      }).join('');

      if(lines){
        lines = '<div class="drawer__list">' + lines + '</div>';
      }else{
        lines = '<div class="alert">Sem lançamentos neste filtro.</div>';
      }

      drawerBody.innerHTML = '<div class="drawer__section">' +
        '<header class="drawer__section-head"><h4>Extrato</h4></header>' +
        lines +
      '</div>' +
      '<div class="drawer__section">' +
        '<header class="drawer__section-head"><h4>Total</h4></header>' +
        '<div class="drawer__number">' + formatBRL(total) + '</div>' +
      '</div>';
    }

    drawer.setAttribute('aria-hidden', 'false');
    drawer.dataset.state = 'open';
    drawer.classList.add('drawer--open');
    body.classList.add('no-scroll');
  }

  function closeDrawer(){
    if(!drawer) return;
    drawer.setAttribute('aria-hidden', 'true');
    drawer.dataset.state = 'closed';
    drawer.classList.remove('drawer--open');
    // libera scroll se nÃ£o houver nenhum modal aberto
    if(!document.querySelector('.modal.modal--open')){
      body.classList.remove('no-scroll');
    }
  }

  function goToOriginDetail(origin){
    if (lastKpiView){
      drawer.dataset.prev = lastKpiView; // lembra de qual aba viemos
      var btn = drawer.querySelector('[data-drawer="close"]');
      if (btn){
        btn.textContent = 'Voltar';
        btn.setAttribute('data-drawer-role','back');
      }
    }
    openDrawer(origin);
  }

  function openKpiDrawer(which){
    if(!drawer || !drawerBody) return;
    var targetMonth = getTargetMonth();
    lastKpiView = which;

    // ao entrar na raiz do kpi, botÃ£o Ã© "Fechar" (sem back)
    var btnClose = drawer && drawer.querySelector('[data-drawer="close"]');
    if (btnClose){
      btnClose.textContent = 'Fechar';
      btnClose.removeAttribute('data-drawer-role');
    }
    drawer.removeAttribute('data-prev');

    // monta coleÃ§Ãµes
    var monthTx = transactions.filter(function(t){
      var ok = (state.month === 'all' ? (targetMonth ? t.ym === targetMonth : true) : t.ym === state.month);
      if(state.origin !== 'all') ok = ok && (t.origin === state.origin);
      if(state.q) ok = ok && t.origin.toLowerCase().includes(state.q);
      return ok;
    });

    var title = 'Detalhes';
    var bodyHTML = '';

    if(which === 'month'){
      title = 'Recebido em ' + (targetMonth ? monthLabel(targetMonth) : 'Todos');
      // agrupa por origem
      var map = {};
      monthTx.forEach(function(t){
        if(!map[t.origin]) map[t.origin] = { total:0, count:0 };
        map[t.origin].total += t.amount; map[t.origin].count++;
      });
      var rows = Object.keys(map).sort(function(a,b){ return map[b].total - map[a].total; }).map(function(o){
        return '<div class="info-line js-origin" data-origin="'+escAttr(o)+'" role="button" tabindex="0">' +
                 '<div><strong>'+esc(o)+'</strong><span>'+map[o].count+' lançamento(s)</span></div>' +
                 '<div class="info-line__totals"><span class="tag">'+formatBRL(map[o].total)+'</span></div>' +
               '</div>';
      }).join('');

      bodyHTML = rows || '<div class="alert">Sem lançamentos neste filtro.</div>';
    }

    if(which === 'prolabore'){
      title = 'Pró-labore';
      var delta = toNumber(proLabore.delta_vs_today);
      var cover = proLabore.covers_until ? monthLabel(proLabore.covers_until) : '--';
      var residual = toNumber(proLabore.residual);
      var missing = toNumber(proLabore.missing_for_next);
      var tx = monthTx.filter(function(t){return t.is_pl;}).sort(function(a,b){ return timeLocal(b.date) - timeLocal(a.date); });
      var list = tx.map(function(t){
        return '<div class="info-line"><div><strong>'+dmyLocal(t.date)+'</strong><span>Referência '+esc(t.ym)+'</span></div><span class="tag">'+formatBRL(t.amount)+'</span></div>';
      }).join('');
      bodyHTML =
        '<div class="info-line '+(delta<0?'is-danger':'')+' js-plmap" data-open="pl-tracker" role="button" tabindex="0" data-tip="Abrir mapa do Pró-labore">'+
          '<div><strong>Status</strong><span>'+ (delta>0?('Atrasado +'+delta+'m'):delta===0?'Em dia':'Adiantado '+Math.abs(delta)+'m') +'</span></div>'+
          '<div class="info-line__totals"><span class="tag">Cobre até '+cover+'</span></div>'+
        '</div>'+
        '<div class="info-line"><div><strong>Residual</strong><span>Valor acumulado não fechado</span></div><span class="tag">'+formatBRL(residual)+'</span></div>'+
        '<div class="info-line"><div><strong>Falta p/ próximo</strong><span>Até atingir a meta mensal</span></div><span class="tag '+(missing>0?'tag--danger':'tag--accent')+'">'+formatBRL(missing)+'</span></div>'+
        '<div class="drawer__section"><header class="drawer__section-head"><h4>Extrato</h4></header>' + (list || '<div class="alert">Sem lançamentos PL no período.</div>') + '</div>';
    }

    if(which === 'others'){
      title = 'Outras origens';
      var oth = monthTx.filter(function(t){return !t.is_pl;}).sort(function(a,b){ return timeLocal(b.date) - timeLocal(a.date); });
      var list2 = oth.map(function(t){
        return '<div class="info-line"><div><strong>'+dmyLocal(t.date)+'</strong><span>'+esc(t.origin)+'</span></div><span class="tag">'+formatBRL(t.amount)+'</span></div>';
      }).join('');
      bodyHTML = list2 || '<div class="alert">Sem lançamentos de outras origens neste filtro.</div>';
    }

    if(drawerTitle) drawerTitle.textContent = title;
    if(drawerSubtitle) drawerSubtitle.textContent = (state.month!=='all' ? monthLabel(state.month) : (targetMonth?monthLabel(targetMonth):'Todos'));
    drawerBody.innerHTML = '<div class="drawer__list">'+bodyHTML+'</div>';

    drawer.setAttribute('aria-hidden','false');
    drawer.dataset.state='open';
    drawer.classList.add('drawer--open');
    body.classList.add('no-scroll');
  }

  // ====== Helpers de ano-mÃªs (YYYY-MM) ======
  function ymAdd(ym, delta){
    var m = /^(\d{4})-(\d{2})$/.exec(String(ym||''));
    if(!m) return ym || '';
    var y = +m[1], mm = +m[2] - 1; // 0-11
    var d = new Date(y, mm + (delta||0), 1);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
  }
  function ymCmp(a,b){ return String(a).localeCompare(String(b)); } // YYYY-MM compara bem

  // ====== Render do "Mapa do Pró-labore" ======
  function renderPlTracker(){
    if(!plContainer) return;

    var covers = proLabore.covers_until || '';
    var next   = covers ? ymAdd(covers, 1) : '';
    var residual = toNumber(proLabore.residual);
    var missing  = Math.max(0, toNumber(proLabore.missing_for_next));
    var pctNext  = (residual + missing) > 0 ? Math.max(0, Math.min(1, residual / (residual + missing))) : 0;

    // Determinar mês inicial: próximo mês não coberto, ou mês de referência
    var start;
    if(next){
      // Se há um próximo mês em progresso, começar dele
      start = next;
    } else if(covers){
      // Se está totalmente coberto até um mês, mostrar a partir do próximo
      start = ymAdd(covers, 1);
    } else {
      // Se não há cobertura, começar do mês de referência
      start = getTargetMonth() || referenceMonth || computeReferenceMonth(proLabore.payday_day || 20);
    }

    // Gerar os próximos 6 meses a partir do início
    var months = [];
    for(var i=0;i<6;i++){ months.push(ymAdd(start, i)); }

    var html = months.map(function(ym){
      var pct = 0, note = '-';
      if(covers && ymCmp(ym, covers) <= 0){
        pct = 1; note = 'Coberto';
      }else if(next && ym === next){
        pct = pctNext; note = Math.round(pctNext*100) + '% do proximo';
      }
      // altura da barrinha (min 24px pra nao sumir)
      var h = Math.round(28 + pct*74);
      var ymParts = ym.split('-');
      var mName = MONTHS[parseInt(ymParts[1],10)] || ymParts[1];
      var yName = ymParts[0];

      return ''+
        '<div class="forecast__item" aria-label="'+esc(monthLabel(ym))+'">'+
          '<div class="forecast__bar" style="height:'+h+'px"></div>'+
          '<strong>'+esc(mName)+'</strong>'+
          '<em>'+esc(yName)+'</em>'+
          '<span class="micro">'+esc(note)+'</span>'+
        '</div>';
    }).join('');

    var statusDelta = toNumber(proLabore.delta_vs_today);
    var statusLabel = 'Em dia';
    var statusClass = '';
    if(statusDelta > 0){
      statusLabel = 'Atrasado +' + statusDelta + 'm';
      statusClass = 'is-delay';
    }else if(statusDelta < 0){
      statusLabel = 'Adiantado ' + Math.abs(statusDelta) + 'm';
      statusClass = 'is-advance';
    }

    var coverageLabel = covers ? monthLabel(covers) : '--';
    var nextLabel = next ? monthLabel(next) : '--';
    var statusDetail = covers ? 'Cobertura garantida ate ' + coverageLabel + '.' : 'Ainda sem meses totalmente cobertos.';
    if(missing > 0 && next){
      statusDetail += ' Faltam ' + formatBRL(missing) + ' para fechar ' + nextLabel + '.';
    }

    var metricsHtml = [
      { label: 'Residual acumulado', value: formatBRL(residual) },
      { label: 'Falta p/ proximo ciclo', value: formatBRL(missing), highlight: missing > 0 ? 'is-alert' : 'is-success' },
      { label: 'Cobertura atual', value: coverageLabel },
      { label: 'Progresso do proximo', value: next ? Math.round(pctNext * 100) + '% concluido' : '--' }
    ].map(function(metric){
      return '<div class="forecast__metric '+(metric.highlight || '')+'">'+
               '<span class="forecast__metric-label">'+esc(metric.label)+'</span>'+
               '<strong>'+metric.value+'</strong>'+
             '</div>';
    }).join('');

    plContainer.innerHTML =
      '<div class="forecast-layout">'+
        '<section class="forecast" role="img" aria-label="Projecao mensal do Pro-labore">'+ html +'</section>'+
        '<section class="forecast__details">'+
          '<div class="forecast__status '+statusClass+'">'+
            '<span class="forecast__status-label">Status atual</span>'+
            '<strong>'+statusLabel+'</strong>'+
            '<p>'+esc(statusDetail)+'</p>'+
          '</div>'+
          '<div class="forecast__metrics">'+ metricsHtml +'</div>'+
        '</section>'+
      '</div>';
  }
  function openPlTracker(){
    if(!plModal) return;
    renderPlTracker();

    // Se veio do drawer, renomeia "Fechar" -> "Voltar"
    var cameFromDrawer = drawer && drawer.dataset.state === 'open';
    var closeBtn = plModal.querySelector('[data-modal="close"]');
    if (closeBtn) {
      if (cameFromDrawer) {
        closeBtn.textContent = 'Voltar';
        closeBtn.setAttribute('data-pl-role', 'back');
      } else {
        closeBtn.textContent = 'Fechar';
        closeBtn.removeAttribute('data-pl-role');
      }
    }

    plModal.setAttribute('aria-hidden','false');
    plModal.classList.add('modal--open');
    body.classList.add('no-scroll');
  }

  function closePlTracker(){
    if(!plModal) return;
    plModal.setAttribute('aria-hidden','true');
    plModal.classList.remove('modal--open');
    if(!(drawer && drawer.dataset.state === 'open')){
      body.classList.remove('no-scroll');
    }
  }

  async function reloadData(force){
    if(isSyncing){
      return;
    }
    isSyncing = true;
    try{
      var url = 'api.php' + (force ? '?refresh=1' : '');
      var response = await fetch(url, { cache: 'no-store' });
      if(!response.ok){
        throw new Error('HTTP ' + response.status);
      }
      dataset = await response.json();
      transactions = normalizeTransactions(dataset.transactions);
      proLabore = dataset.pro_labore || {};
      totalsByMonth = dataset.kpis && dataset.kpis.by_month ? dataset.kpis.by_month : {};
      totalsByOrigin = dataset.kpis && dataset.kpis.by_origin ? dataset.kpis.by_origin : {};

      referenceMonth = proLabore.reference_ym || computeReferenceMonth(proLabore.payday_day || 20);
      body.setAttribute('data-reference-month', referenceMonth || '');

      rebuildYearChips();
      rebuildMonthChips();
      rebuildOriginChips();
      try{ if(typeof buildSegMonths==='function') buildSegMonths(); }catch(e){}

      if(state.month !== 'all' && monthFilterEl && !monthFilterEl.querySelector('[data-month="' + state.month + '"]')){
        state.month = 'all';
      }
      if(referenceMonth && state.month === 'all' && monthFilterEl && monthFilterEl.querySelector('[data-month="' + referenceMonth + '"]')){
        state.month = referenceMonth;
      }
      if(state.origin !== 'all' && originFilterEl && !originFilterEl.querySelector('[data-origin="' + state.origin + '"]')){
        state.origin = 'all';
      }

      setActiveChip(yearFilterEl, String(state.year), 'data-year');
      setActiveChip(monthFilterEl, state.month, 'data-month');
      setActiveChip(originFilterEl, state.origin, 'data-origin');

      calcKpis();
      renderList();

      // se o mapa estiver aberto, re-renderiza com os dados novos
      if (plModal && plModal.classList.contains('modal--open')) {
        renderPlTracker();
      }
    } catch(error){
      var isNetwork = error && error.name === 'TypeError';
      var message = isNetwork ? 'Falha de rede ao sincronizar. Verifique sua conexão.' : 'Falha ao sincronizar. ' + error.message;
      console.error(message, error);
      showToast(message, 'error');
    } finally {
      isSyncing = false;
    }
  }

  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  var kpiMonthEl = document.querySelector('[data-bind="kpi-month"]');
  var kpiOthersEl = document.querySelector('[data-bind="kpi-others"]');
  var plCoversEl = document.querySelector('[data-bind="pl-covers"]');
  var plBadgeEl = document.querySelector('[data-bind="pl-badge"]');
  var plExtraEl = document.querySelector('[data-bind="pl-extra"]');
  var lastSyncEl = document.querySelector('[data-bind="last-sync"]');
  var monthFilterEl = document.querySelector('[data-filter="month"]');
  var originFilterEl = document.querySelector('[data-filter="origin"]');
  var searchInput = document.getElementById('filterSearchV4') || document.getElementById('filterSearch');
  var segMonthsEl = document.getElementById('segMonths');
  var originListEl = document.getElementById('originList');
  var drawer = document.querySelector('.drawer');
  var drawerTitle = drawer ? drawer.querySelector('[data-bind="drawer-title"]') : null;
  var drawerSubtitle = drawer ? drawer.querySelector('[data-bind="drawer-subtitle"]') : null;
  var drawerBody = drawer ? drawer.querySelector('[data-bind="drawer-body"]') : null;

  var dataset = safeJSON();
  var transactions = normalizeTransactions(dataset.transactions);
  var proLabore = dataset.pro_labore || {};
  var totalsByMonth = dataset.kpis && dataset.kpis.by_month ? dataset.kpis.by_month : {};
  var totalsByOrigin = dataset.kpis && dataset.kpis.by_origin ? dataset.kpis.by_origin : {};
  var referenceMonth = getInitialReference();
  body.setAttribute('data-reference-month', referenceMonth || '');

  // Obter ano atual
  var currentYear = new Date().getFullYear();
  var state = { year: currentYear, month: 'all', origin: 'all', q: '' };

  rebuildYearChips();
  rebuildMonthChips();
  rebuildOriginChips();
  try{ if(typeof buildSegMonths==='function') buildSegMonths(); }catch(e){}

  if(referenceMonth && monthFilterEl && monthFilterEl.querySelector('[data-month="' + referenceMonth + '"]')){
    state.month = referenceMonth;
  }

  var yearFilterEl = document.getElementById('yearFilter');
  setActiveChip(yearFilterEl, String(state.year), 'data-year');
  setActiveChip(monthFilterEl, state.month, 'data-month');
  setActiveChip(originFilterEl, state.origin, 'data-origin');

  calcKpis();
  renderList();

  // (Ãºnico) handler do drawer: overlay/fechar/voltar
  if (drawer) {
    drawer.addEventListener('click', function(event){
      if (event.target.matches('.drawer__overlay')){ closeDrawer(); return; }
      var btn = event.target.closest('[data-drawer="close"]');
      if (!btn) return;

      if (btn.getAttribute('data-drawer-role') === 'back' && drawer.dataset.prev){
        event.preventDefault();
        var prev = drawer.dataset.prev;
        drawer.removeAttribute('data-prev');
        btn.textContent = 'Fechar';
        btn.removeAttribute('data-drawer-role');
        openKpiDrawer(prev);
        return;
      }
      closeDrawer();
    });
  }

  // clique em cards de origem abre detalhe
  if(originListEl){
    originListEl.addEventListener('click', function(event){
      var card = event.target.closest('.js-origin');
      if(!card) return;
      openDrawer(card.getAttribute('data-origin') || '');
    });
    originListEl.addEventListener('keydown', function(event){
      if(event.key === 'Enter' || event.key === ' '){
        var card = event.target.closest('.js-origin');
        if(card){
          event.preventDefault();
          openDrawer(card.getAttribute('data-origin') || '');
        }
      }
    });
  }

  if(monthFilterEl){
    monthFilterEl.addEventListener('click', function(event){
      var chip = event.target.closest('.chip');
      if(!chip) return;
      var value = chip.getAttribute('data-month') || 'all';
      state.month = value;
      setActiveChip(monthFilterEl, value, 'data-month');
      rebuildOriginChips(); // Reconstruir filtros de origem baseado no mês
      setActiveChip(originFilterEl, state.origin, 'data-origin');
      renderList();
      calcKpis();
    });
  }

  // Event listener para filtro de ano
  if(yearFilterEl){
    yearFilterEl.addEventListener('click', function(event){
      var chip = event.target.closest('.chip');
      if(!chip) return;
      var value = chip.getAttribute('data-year');
      if(!value) return;
      state.year = value;
      state.month = 'all'; // Resetar mês ao trocar ano
      setActiveChip(yearFilterEl, value, 'data-year');
      rebuildMonthChips(); // Reconstruir meses do ano selecionado
      setActiveChip(monthFilterEl, state.month, 'data-month');
      rebuildOriginChips(); // Reconstruir origens baseado no novo filtro
      setActiveChip(originFilterEl, state.origin, 'data-origin');
      renderList();
      calcKpis();
    });
  }

  if(originFilterEl){
    originFilterEl.addEventListener('click', function(event){
      var chip = event.target.closest('.chip');
      if(!chip) return;
      var value = chip.getAttribute('data-origin') || 'all';
      state.origin = value;
      setActiveChip(originFilterEl, value, 'data-origin');
      renderList();
      calcKpis();
    });
  }

  if(searchInput){
    var handleSearch = debounce(function(){
      state.q = (searchInput.value || '').trim().toLowerCase();
      renderList();
      calcKpis();
    }, 150);
    searchInput.addEventListener('input', handleSearch);
  }

  // dentro do drawer, se clicar numa origem listada, abre o detalhe + ativa â€œVoltarâ€
  if (drawer && drawerBody){
    drawerBody.addEventListener('click', function(ev){
      var el = ev.target.closest('.js-origin');
      if (el) goToOriginDetail(el.getAttribute('data-origin')||'');
    });
  }

  // --- Mapa do Pró-labore: abrir por clique (botÃ£o ou bloco .js-plmap)
  document.addEventListener('click', function (event) {
    var openBtn = event.target.closest('[data-open="pl-tracker"], .js-plmap');
    if (openBtn) {
      event.preventDefault();
      openPlTracker();
      return;
    }
  });

  // abrir pl-tracker com teclado (Enter/EspaÃ§o)
  document.addEventListener('keydown', function (ev) {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest('[data-open="pl-tracker"], .js-plmap')) {
      ev.preventDefault();
      openPlTracker();
    }
  });

  // fechar o mapa do Pró-labore (X/overlay/back) â€” handler prÃ³prio do modal
  if (plModal) {
    plModal.addEventListener('click', function (event) {
      if (
        event.target.matches('[data-pl-role="back"]') ||
        event.target.matches('[data-modal="close"]') ||
        event.target.matches('.modal__overlay')
      ) {
        event.preventDefault();
        event.stopPropagation();
        closePlTracker();
      }
    });
  }

  // KPIs: abrir detalhe no drawer
  document.addEventListener('click', function(ev){
    var k = ev.target.closest('.kpi--click');
    if(!k) return;
    var which = k.getAttribute('data-kpi');
    if(which) openKpiDrawer(which);
  });
  document.addEventListener('keydown', function(ev){
    if((ev.key==='Enter' || ev.key===' ') && ev.target.closest('.kpi--click')){
      ev.preventDefault();
      var k = ev.target.closest('.kpi--click');
      var which = k.getAttribute('data-kpi');
      if(which) openKpiDrawer(which);
    }
  });

  if(drawer){
    drawer.addEventListener('keydown', function(event){
      if(event.key === 'Escape'){
        closeDrawer();
      }
    });
  }

  // ESC global: fecha pl-tracker > drawer
  window.addEventListener('keydown', function(event){
    if(event.key !== 'Escape') return;
    if (plModal && plModal.classList.contains('modal--open')) {
      closePlTracker();
      return;
    }
    if (drawer && drawer.dataset.state === 'open') {
      closeDrawer();
      return;
    }
  });

  // kick inicial pra jÃ¡ pegar dados atualizados apÃ³s carregar
  setTimeout(function(){ if(!isSyncing){ reloadData(false); } }, 1200);

  var themeRadios = document.querySelectorAll('input[name="theme"]');
  var hueRange = document.getElementById('hue');
  var huePicker = document.getElementById('huePicker');
  var hueThumb = document.getElementById('hueThumb');
  var hueValueEl = document.getElementById('hueValue');
  var hueNowEl = document.getElementById('hueNow');

  function updateHueUI(hue){
    if(!huePicker) return;
    var val = Math.max(0, Math.min(360, Number(hue) || 0));
    var pct = val / 360 * 100;
    huePicker.style.setProperty('--pos', pct + '%');
    huePicker.style.setProperty('--hue', val);
    if(hueValueEl) hueValueEl.textContent = Math.round(val) + 'Â°';
    if(hueThumb) hueThumb.setAttribute('aria-valuenow', String(Math.round(val)));
    if(hueNowEl) hueNowEl.style.background = 'hsl(' + val + ' 85% 55%)';
  }

  function setTheme(theme){
    if(theme !== 'light' && theme !== 'dark'){ theme = 'dark'; }
    root.classList.remove('theme-dark', 'theme-light');
    body.classList.remove('theme-dark', 'theme-light');
    root.classList.add('theme-' + theme);
    body.classList.add('theme-' + theme);
    try{ localStorage.setItem(storageThemeKey, theme); }catch(error){}
    themeRadios.forEach(function(radio){ radio.checked = (radio.value === theme); });
    var tgl = document.getElementById('themeToggle');
    if(tgl){ tgl.dataset.active = theme; }
  }

  function setHue(hue){
    var val = Math.max(0, Math.min(360, Number(hue)));
    if(isNaN(val)) val = 145;
    root.style.setProperty('--accent-h', String(val));
    try{ localStorage.setItem(storageHueKey, String(val)); }catch(error){}
    if(hueRange) hueRange.value = String(val);
    updateHueUI(val);
  }

  try {
    setTheme(localStorage.getItem(storageThemeKey) || 'dark');
    setHue(localStorage.getItem(storageHueKey) || 145);
  } catch(error) {
    setTheme('dark');
    setHue(145);
  }

  // Ripple visual no campo de busca da barra V4
  (function(){
    var searchBox = document.getElementById('searchBox');
    if(!searchBox) return;
    searchBox.addEventListener('pointerdown', function(e){
      var ink = searchBox.querySelector('.ink');
      if(!ink) return;
      var r = searchBox.getBoundingClientRect();
      var dx = e.clientX - r.left; var dy = e.clientY - r.top;
      ink.classList.remove('play');
      ink.style.setProperty('--x', dx + 'px');
      ink.style.setProperty('--y', dy + 'px');
      void ink.offsetWidth; // reflow
      ink.classList.add('play');
    });
  })();

  document.addEventListener('change', function(event){
    var target = event.target;
    if(target && target.name === 'theme'){
      setTheme(target.value);
    }
  });

  if(hueRange){
    hueRange.addEventListener('input', function(){ setHue(hueRange.value); });
  }

  if(huePicker){
    var dragging = false;

    function posToHue(clientX){
      var rect = huePicker.getBoundingClientRect();
      var pct = (clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));
      return Math.round(pct * 360);
    }

    function startDrag(e){
      dragging = true;
      var p = e.touches ? e.touches[0] : e;
      setHue(posToHue(p.clientX));
      window.addEventListener('pointermove', moveDrag);
      window.addEventListener('pointerup', endDrag, { once:true });
    }
    function moveDrag(e){
      if(!dragging) return;
      setHue(posToHue(e.clientX));
    }
    function endDrag(){ dragging = false; window.removeEventListener('pointermove', moveDrag); }

    huePicker.addEventListener('pointerdown', startDrag);
    huePicker.addEventListener('click', function(e){ setHue(posToHue(e.clientX)); });
  }

  // expÃµe helpers usados no patch do boot()
  window.calcKpis = calcKpis;
  window.renderList = renderList;
  window.setActiveChip = setActiveChip;
  window.monthLabel = monthLabel;
  window.esc = esc;
  window.state = state;

  // polling de atualizaÃ§Ã£o
  pollTimer = setInterval(function(){
    if(document.visibilityState === 'visible' && !isSyncing){
      reloadData(false);
    }
  }, POLL_INTERVAL);

  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible' && !isSyncing){
      reloadData(false);
    }
  });

})();

/* ===========================
   Boot: modais genÃ©ricos + patch de filtros
   =========================== */
(function(){
  "use strict";

  // --- inicializa sÃ³ depois do DOM pronto ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot(){
    var body = document.body;

    function getModal(name){ return document.querySelector('.modal[data-modal="'+ name +'"]'); }

    function openModal(name='config'){
      var m = getModal(name);
      if(!m) return;
      m.setAttribute('aria-hidden','false');
      m.classList.add('modal--open');
      body.classList.add('no-scroll');
    }

    function closeModal(name='config'){
      var m = getModal(name);
      if(!m) return;
      m.setAttribute('aria-hidden','true');
      m.classList.remove('modal--open');
      // sÃ³ libera o scroll se nenhum outro modal/drawer estiver aberto
      var anyOpen = document.querySelector('.modal.modal--open') || (document.querySelector('.drawer')?.dataset.state === 'open');
      if(!anyOpen){ body.classList.remove('no-scroll'); }
    }

    // ==== Patch: filtro compacto (rail + busca + tags) ====
    (function(){
      var monthChipsEl   = document.querySelector('.chips[data-filter="month"]');
      var originChipsEl  = document.querySelector('.chips[data-filter="origin"]');
      var searchInput    = document.getElementById('filterSearchV4') || document.getElementById('filterSearch');
      var clearBtn       = document.getElementById('clearFilters');
      var activeFiltersEl= document.getElementById('activeFilters');
      // elementos do palette (modal de filtro avancado)
      var paletteMonthEl  = document.getElementById('paletteMonth');
      var paletteOriginEl = document.getElementById('paletteOrigin');
      var paletteSearch   = document.getElementById('paletteSearch');
      var paletteClear    = document.getElementById('paletteClear');

      window.state = window.state || { month:'all', origin:'all', q:'' };

      function renderActiveFilters(){
        if(!activeFiltersEl) return;
        var tags = [];
        if(state.month !== 'all'){
          tags.push('<span class="filter-tag">MÃªs: '+esc(monthLabel(state.month))+' <button data-remove="month" aria-label="Remover mÃªs">Ã—</button></span>');
        }
        if(state.origin !== 'all'){
          tags.push('<span class="filter-tag">Origem: '+esc(state.origin)+' <button data-remove="origin" aria-label="Remover origem">Ã—</button></span>');
        }
        if(state.q){
          tags.push('<span class="filter-tag">Busca: '+esc(state.q)+' <button data-remove="q" aria-label="Limpar busca">Ã—</button></span>');
        }
        activeFiltersEl.innerHTML = tags.join('') || '<span>Nenhum filtro ativo</span>';
      }

      function applyFilters(){
        if (typeof calcKpis === 'function') calcKpis();
        if (typeof renderList === 'function') renderList();
        renderActiveFilters();
      }

      if(monthChipsEl){
        monthChipsEl.addEventListener('click', function(e){
          var btn = e.target.closest('[data-month]');
          if(!btn) return;
          state.month = btn.getAttribute('data-month');
          setActiveChip(monthChipsEl, state.month, 'data-month');
          if(paletteMonthEl) setActiveChip(paletteMonthEl, state.month, 'data-month');
          applyFilters();
        });
      }

      if(originChipsEl){
        originChipsEl.addEventListener('click', function(e){
          var btn = e.target.closest('[data-origin]');
          if(!btn) return;
          state.origin = btn.getAttribute('data-origin');
          setActiveChip(originChipsEl, state.origin, 'data-origin');
          if(paletteOriginEl) setActiveChip(paletteOriginEl, state.origin, 'data-origin');
          applyFilters();
        });
      }

      if(searchInput){
        var t;
        function onSearch(){
          clearTimeout(t);
          t = setTimeout(function(){
            state.q = (searchInput.value||'').trim().toLowerCase();
            if(paletteSearch && paletteSearch !== document.activeElement){ paletteSearch.value = searchInput.value; }
            applyFilters();
          }, 120);
        }
        searchInput.addEventListener('input', onSearch);
      }

      if(clearBtn){
        clearBtn.addEventListener('click', function(){
          state.month = 'all';
          state.origin = 'all';
          state.q = '';
          if(searchInput) searchInput.value = '';
          if(paletteSearch) paletteSearch.value = '';
          if(monthChipsEl)  setActiveChip(monthChipsEl,  'all', 'data-month');
          if(originChipsEl) setActiveChip(originChipsEl, 'all', 'data-origin');
          if(paletteMonthEl)  setActiveChip(paletteMonthEl,  'all', 'data-month');
          if(paletteOriginEl) setActiveChip(paletteOriginEl, 'all', 'data-origin');
          applyFilters();
        });
      }

      var ref = document.body.getAttribute('data-reference-month');
      if(monthChipsEl && ref && monthChipsEl.querySelector('[data-month="'+ref+'"]')){
        state.month = ref;
        setActiveChip(monthChipsEl, state.month, 'data-month');
      }else if(monthChipsEl){
        setActiveChip(monthChipsEl, 'all', 'data-month');
      }
      if(originChipsEl) setActiveChip(originChipsEl, 'all', 'data-origin');

      renderActiveFilters();

      // remover tags ativas (month/origin/q)
      if(activeFiltersEl){
        activeFiltersEl.addEventListener('click', function(e){
          var rm = e.target.closest('[data-remove]');
          if(!rm) return;
          var k = rm.getAttribute('data-remove');
          if(k === 'q'){
            state.q = '';
            if(searchInput) searchInput.value='';
          } else if(k === 'month'){
            state.month = 'all';
            if(monthChipsEl) setActiveChip(monthChipsEl, 'all', 'data-month');
            var seg = document.getElementById('segMonths');
            if(seg && seg.__highlight) seg.__highlight('all');
          } else if(k === 'origin'){
            state.origin = 'all';
            if(originChipsEl) setActiveChip(originChipsEl, 'all', 'data-origin');
          }
          applyFilters();
        });
      }

      // ===== Palette (modal) bindings =====
      function syncPaletteFromMain(){
        if(paletteMonthEl && monthChipsEl){ paletteMonthEl.innerHTML = monthChipsEl.innerHTML; }
        if(paletteOriginEl && originChipsEl){ paletteOriginEl.innerHTML = originChipsEl.innerHTML; }
        if(paletteMonthEl)  setActiveChip(paletteMonthEl,  state.month,  'data-month');
        if(paletteOriginEl) setActiveChip(paletteOriginEl, state.origin, 'data-origin');
        if(paletteSearch)   paletteSearch.value = state.q || '';
      }

      if(paletteMonthEl){
        paletteMonthEl.addEventListener('click', function(e){
          var btn = e.target.closest('[data-month]');
          if(!btn) return;
          state.month = btn.getAttribute('data-month');
          setActiveChip(paletteMonthEl, state.month, 'data-month');
          if(monthChipsEl) setActiveChip(monthChipsEl, state.month, 'data-month');
          applyFilters();
        });
      }
      if(paletteOriginEl){
        paletteOriginEl.addEventListener('click', function(e){
          var btn = e.target.closest('[data-origin]');
          if(!btn) return;
          state.origin = btn.getAttribute('data-origin');
          setActiveChip(paletteOriginEl, state.origin, 'data-origin');
          if(originChipsEl) setActiveChip(originChipsEl, state.origin, 'data-origin');
          applyFilters();
        });
      }
      if(paletteSearch){
        var tt;
        paletteSearch.addEventListener('input', function(){
          clearTimeout(tt);
          tt = setTimeout(function(){
            state.q = (paletteSearch.value||'').trim().toLowerCase();
            if(searchInput && searchInput !== document.activeElement){ searchInput.value = paletteSearch.value; }
            applyFilters();
          }, 120);
        });
      }
      if(paletteClear){
        paletteClear.addEventListener('click', function(){
          state.month = 'all'; state.origin = 'all'; state.q = '';
          if(paletteSearch) paletteSearch.value = '';
          if(searchInput) searchInput.value = '';
          if(monthChipsEl) setActiveChip(monthChipsEl, 'all', 'data-month');
          if(originChipsEl) setActiveChip(originChipsEl, 'all', 'data-origin');
          if(paletteMonthEl) setActiveChip(paletteMonthEl, 'all', 'data-month');
          if(paletteOriginEl) setActiveChip(paletteOriginEl, 'all', 'data-origin');
          applyFilters();
        });
      }
    })();

    // --- handlers globais de modal (config + outros que usem data-modal) ---
    document.addEventListener('click', function(event){
      var openCfg = event.target.closest('[data-open="config"]');
      if(openCfg){
        event.preventDefault();
        openModal('config');
        return;
      }
      var openFilter = event.target.closest('[data-open="filter"]');
      if(openFilter){
        event.preventDefault();
        if(typeof syncPaletteFromMain === 'function'){ syncPaletteFromMain(); }
        else {
          // tenta montar via elementos existentes
          var pm = document.getElementById('paletteMonth');
          var po = document.getElementById('paletteOrigin');
          var mm = document.querySelector('.chips[data-filter="month"]');
          var mo = document.querySelector('.chips[data-filter="origin"]');
          if(pm && mm) pm.innerHTML = mm.innerHTML;
          if(po && mo) po.innerHTML = mo.innerHTML;
        }
        openModal('filter');
        return;
      }

      if (event.target.matches('[data-modal="close"]') || event.target.matches('.modal__overlay')){
        var host = event.target.closest('.modal');
        if(host){
          event.preventDefault();
          closeModal(host.dataset.modal || 'config');
        }
      }
    });

    // ESC fecha o modal focado
    window.addEventListener('keydown', function(event){
      if(event.key !== 'Escape') return;
      var topOpen = document.querySelector('.modal.modal--open:last-of-type');
      if(topOpen){ closeModal(topOpen.dataset.modal || 'config'); }
    });

    // Atalho Ctrl/Cmd + K abre o filtro avancado
    window.addEventListener('keydown', function(event){
      var key = String(event.key || '').toLowerCase();
      if((event.ctrlKey || event.metaKey) && key === 'k'){
        event.preventDefault();
        var host = document.querySelector('.modal[data-modal="filter"]');
        if(host){
          var build = (typeof syncPaletteFromMain === 'function') ? syncPaletteFromMain : null;
          if(build) build();
          openModal('filter');
        }
      }
    });
  }

})();

