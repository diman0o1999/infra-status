/* ============================================
   core-stack.art — Infrastructure Dashboard
   ============================================ */

// --- i18n ---
const I18N = {
    ru: {
        connecting: 'Подключение...',
        connected: 'Подключено',
        reconnecting: 'Переподключение...',
        status_ok: 'Все системы работают',
        status_warn: 'Часть систем с предупреждениями',
        status_crit: 'Обнаружены проблемы',
        status_connecting: 'Подключение...',
        tab_overview: 'Обзор',
        tab_hosts: 'Серверы',
        tab_projects: 'Проекты',
        tab_services: 'Сервисы',
        tab_domains: 'Домены',
        stat_hosts: 'Серверы',
        stat_projects: 'Проекты',
        stat_services: 'Сервисы',
        stat_domains: 'Домены',
        section_hosts: 'Серверы',
        section_projects: 'Проекты',
        section_infra: 'Инфраструктура',
        section_domains: 'Домены',
        error_title: 'Соединение потеряно',
        error_desc: 'Пытаемся переподключиться...',
        pause_title: 'Обновления приостановлены',
        pause_desc: 'Вкладка в фоне. Обновления продолжатся при возврате.',
        edit_layout: 'Редактировать',
        loading_title: 'Загрузка инфраструктуры',
        loading_desc: 'Сбор данных с серверов...',
        ok: 'Работает',
        warn: 'Внимание',
        crit: 'Критично',
        offline: 'Недоступен',
        degraded: 'Деградация',
        down: 'Не работает',
        active: 'Активен',
        inactive: 'Неактивен',
        unreachable: 'Недоступен',
        section_kuma: 'Мониторы Uptime',
        stat_ram: 'Общий RAM',
        col_service: 'Сервис',
        col_host: 'Хост',
        col_state: 'Статус',
        col_level: 'Уровень',
        col_port: 'Порт',
        host_unreachable: 'Хост недоступен',
        uptime_prefix: 'аптайм',
        load_prefix: 'нагрузка',
    },
    en: {
        connecting: 'Connecting...',
        connected: 'Connected',
        reconnecting: 'Reconnecting...',
        status_ok: 'All Systems Operational',
        status_warn: 'Some Systems Degraded',
        status_crit: 'System Issues Detected',
        status_connecting: 'Connecting...',
        tab_overview: 'Overview',
        tab_hosts: 'Hosts',
        tab_projects: 'Projects',
        tab_services: 'Services',
        tab_domains: 'Domains',
        stat_hosts: 'Hosts',
        stat_projects: 'Projects',
        stat_services: 'Services',
        stat_domains: 'Domains',
        section_hosts: 'Hosts',
        section_projects: 'Projects',
        section_infra: 'Infrastructure',
        section_domains: 'Domains',
        error_title: 'Connection Lost',
        error_desc: 'Attempting to reconnect...',
        pause_title: 'Updates Paused',
        pause_desc: 'Tab is in background. Updates will resume when you return.',
        edit_layout: 'Edit Layout',
        loading_title: 'Loading Infrastructure',
        loading_desc: 'Collecting data from servers...',
        ok: 'Operational',
        warn: 'Warning',
        crit: 'Critical',
        offline: 'Offline',
        degraded: 'Degraded',
        down: 'Down',
        active: 'Active',
        inactive: 'Inactive',
        unreachable: 'Unreachable',
        section_kuma: 'Uptime Monitors',
        stat_ram: 'Total RAM',
        col_service: 'Service',
        col_host: 'Host',
        col_state: 'Status',
        col_level: 'Level',
        col_port: 'Port',
        host_unreachable: 'Host unreachable',
        uptime_prefix: 'uptime',
        load_prefix: 'load',
    }
};

let currentLang = localStorage.getItem('lang') || 'ru';

function t(key) { return I18N[currentLang][key] || I18N['en'][key] || key; }

function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
}

// --- Theme ---
function getTheme() {
    return localStorage.getItem('theme') || 'light';
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// --- Icons ---
const ICONS = {
    'truck': '🚛', 'factory': '🏭', 'heart-pulse': '💫',
    'stethoscope': '🩺', 'book-open': '📖', 'map-pin': '📍',
    'clipboard-list': '📋',
};

function getIcon(name) { return ICONS[name] || '📦'; }

const DOMAIN_EMOJI = {
    'cargo': '🚛', 'cargo-api': '🚛',
    'fabro': '🏭', 'fabro-api': '🏭',
    'puls': '💫', 'puls-api': '💫',
    'emedic': '🩺', 'emedic-api': '🩺',
    'skazki': '📖', 'skazki-api': '📖',
    'kraeved': '📍', 'kraeved-api': '📍',
    'logist23': '📋', 'logist23-api': '📋',
    'racia': '📻', 'racia-api': '📻',
    'info': '📊', 'status': '💚', 'grafana': '📈',
    'errors': '🐛', 'logs': '📝', 's3': '🗄️', 'ai': '🤖',
    'search': '🔍', 'admin': '⚙️', 'cdn': '⚡',
};

function getDomainIcon(name) { return DOMAIN_EMOJI[name] || '🌐'; }

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function barClass(pct, w = 70, c = 90) {
    if (pct >= c) return 'crit';
    if (pct >= w) return 'warn';
    return 'ok';
}

// --- Stable Rendering (no layout shift) ---
// Strategy: create DOM once, then update only values via data-key selectors

let isFirstRender = true;

function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
}

function setClass(el, cls) {
    if (el && el.className !== cls) el.className = cls;
}

function setStyle(el, prop, val) {
    if (el && el.style[prop] !== val) el.style[prop] = val;
}

function renderQuickStats(data) {
    const hosts = data.hosts ? data.hosts.length : 0;
    const onlineHosts = data.hosts ? data.hosts.filter(h => h.online).length : 0;
    const projects = data.projects ? data.projects.length : 0;
    const okProjects = data.projects ? data.projects.filter(p => p.status === 'ok').length : 0;
    const services = data.infrastructure ? data.infrastructure.length : 0;
    const activeServices = data.infrastructure ? data.infrastructure.filter(i => i.active).length : 0;
    const domains = data.domains ? data.domains.length : 0;

    let totalProjectRAM = 0;
    if (data.projects) data.projects.forEach(p => totalProjectRAM += (p.memory_total || 0));
    if (data.infrastructure) data.infrastructure.forEach(i => totalProjectRAM += (i.memory || 0));

    setText(document.getElementById('statHosts'), `${onlineHosts}/${hosts}`);
    setText(document.getElementById('statProjects'), `${okProjects}/${projects}`);
    setText(document.getElementById('statServices'), `${activeServices}/${services}`);
    setText(document.getElementById('statDomains'), `${domains}`);
    setText(document.getElementById('statRAM'), formatBytes(totalProjectRAM));
}

// Build stable host card HTML with data-host attributes for targeted updates
function buildHostCard(h) {
    return `
        <div class="host-card ${h.status}" data-host="${h.name}">
            <div class="host-header">
                <span class="host-name">${h.name}</span>
                <span class="badge ${h.status}" data-host-badge>${t(h.status)}</span>
            </div>
            <div class="host-meta">
                <span>${h.type}</span>
                <span>${h.host}</span>
                <span data-host-uptime>${h.uptime ? t('uptime_prefix') + ' ' + h.uptime : ''}</span>
                <span data-host-load>${h.load ? t('load_prefix') + ' ' + h.load : ''}</span>
            </div>
            <div class="metric">
                <div class="metric-header">
                    <span class="metric-label">CPU</span>
                    <span class="metric-value" data-host-cpu>${h.online ? h.cpu.toFixed(1) + '%' : '-'}</span>
                </div>
                <div class="bar"><div class="bar-fill ${h.online ? barClass(h.cpu) : ''}" data-host-cpu-bar style="width:${h.online ? Math.min(h.cpu, 100) : 0}%"></div></div>
            </div>
            <div class="metric">
                <div class="metric-header">
                    <span class="metric-label">RAM</span>
                    <span class="metric-value" data-host-ram>${h.online ? h.ram.percent.toFixed(1) + '% \u2014 ' + formatBytes(h.ram.used) + ' / ' + formatBytes(h.ram.total) : '-'}</span>
                </div>
                <div class="bar"><div class="bar-fill ${h.online ? barClass(h.ram.percent, 80, 95) : ''}" data-host-ram-bar style="width:${h.online ? Math.min(h.ram.percent, 100) : 0}%"></div></div>
            </div>
            <div class="metric">
                <div class="metric-header">
                    <span class="metric-label">DISK</span>
                    <span class="metric-value" data-host-disk>${h.online ? h.disk.percent.toFixed(1) + '% \u2014 ' + formatBytes(h.disk.used) + ' / ' + formatBytes(h.disk.total) : '-'}</span>
                </div>
                <div class="bar"><div class="bar-fill ${h.online ? barClass(h.disk.percent, 80, 95) : ''}" data-host-disk-bar style="width:${h.online ? Math.min(h.disk.percent, 100) : 0}%"></div></div>
            </div>
        </div>`;
}

function updateHostCard(card, h) {
    // Update status class on card
    card.className = 'host-card ' + h.status;
    const badge = card.querySelector('[data-host-badge]');
    if (badge) { setClass(badge, 'badge ' + h.status); setText(badge, t(h.status)); }

    setText(card.querySelector('[data-host-uptime]'), h.uptime ? t('uptime_prefix') + ' ' + h.uptime : '');
    setText(card.querySelector('[data-host-load]'), h.load ? t('load_prefix') + ' ' + h.load : '');

    // CPU
    setText(card.querySelector('[data-host-cpu]'), h.online ? h.cpu.toFixed(1) + '%' : '-');
    const cpuBar = card.querySelector('[data-host-cpu-bar]');
    if (cpuBar) { setStyle(cpuBar, 'width', (h.online ? Math.min(h.cpu, 100) : 0) + '%'); setClass(cpuBar, 'bar-fill ' + (h.online ? barClass(h.cpu) : '')); }

    // RAM
    setText(card.querySelector('[data-host-ram]'), h.online ? h.ram.percent.toFixed(1) + '% \u2014 ' + formatBytes(h.ram.used) + ' / ' + formatBytes(h.ram.total) : '-');
    const ramBar = card.querySelector('[data-host-ram-bar]');
    if (ramBar) { setStyle(ramBar, 'width', (h.online ? Math.min(h.ram.percent, 100) : 0) + '%'); setClass(ramBar, 'bar-fill ' + (h.online ? barClass(h.ram.percent, 80, 95) : '')); }

    // Disk
    setText(card.querySelector('[data-host-disk]'), h.online ? h.disk.percent.toFixed(1) + '% \u2014 ' + formatBytes(h.disk.used) + ' / ' + formatBytes(h.disk.total) : '-');
    const diskBar = card.querySelector('[data-host-disk-bar]');
    if (diskBar) { setStyle(diskBar, 'width', (h.online ? Math.min(h.disk.percent, 100) : 0) + '%'); setClass(diskBar, 'bar-fill ' + (h.online ? barClass(h.disk.percent, 80, 95) : '')); }
}

function renderHosts(hosts, targetId) {
    const el = document.getElementById(targetId);
    if (!el || !hosts) return;

    if (!el.children.length || el.children.length !== hosts.length) {
        // First render or structure changed — build full DOM
        el.innerHTML = hosts.map(buildHostCard).join('');
    } else {
        // Update existing cards in-place
        hosts.forEach(h => {
            const card = el.querySelector(`[data-host="${h.name}"]`);
            if (card) updateHostCard(card, h);
        });
    }
}

function buildProjectCard(p, compact) {
    return `
        <div class="project-card ${p.status}" data-project="${p.name}">
            <div class="project-header">
                <span class="project-icon">${getIcon(p.icon)}</span>
                <span class="project-name">${p.name}</span>
                <span class="project-status-badge badge ${p.status}" data-proj-badge>${t(p.status)}</span>
            </div>
            ${!compact ? `<div class="project-desc">${p.description}</div>` : ''}
            <div class="project-ram" data-proj-ram style="${p.memory_total ? '' : 'display:none'}">
                <span class="ram-label">RAM</span>
                <span class="ram-value" data-proj-ram-val>${formatBytes(p.memory_total || 0)}</span>
            </div>
            <div class="project-endpoints">
                ${p.web_url ? `
                    <div class="endpoint">
                        <span class="endpoint-dot ${p.web_up ? 'up' : 'down'}" data-proj-web-dot></span>
                        <span class="endpoint-label">WEB</span>
                        <a href="${p.web_url}" target="_blank">${p.web_url.replace('https://','')}</a>
                        <span class="endpoint-status" data-proj-web-code>${p.web_status || ''}</span>
                    </div>` : ''}
                ${p.api_url ? `
                    <div class="endpoint">
                        <span class="endpoint-dot ${p.api_up ? 'up' : 'down'}" data-proj-api-dot></span>
                        <span class="endpoint-label">API</span>
                        <a href="${p.api_url}" target="_blank">${p.api_url.replace('https://','')}</a>
                        <span class="endpoint-status" data-proj-api-code>${p.api_status || ''}</span>
                    </div>` : ''}
            </div>
            ${!compact ? `<div class="project-services" data-proj-svcs>
                ${(p.services || []).map(s => `<span class="svc-tag ${s.active ? 'active' : 'inactive'}" data-svc="${s.name}">${s.name}${s.memory ? ' \u00b7 ' + formatBytes(s.memory) : ''}</span>`).join('')}
            </div>` : ''}
        </div>`;
}

function updateProjectCard(card, p) {
    card.className = 'project-card ' + p.status;
    const badge = card.querySelector('[data-proj-badge]');
    if (badge) { setClass(badge, 'project-status-badge badge ' + p.status); setText(badge, t(p.status)); }

    const ramEl = card.querySelector('[data-proj-ram]');
    if (ramEl) {
        ramEl.style.display = p.memory_total ? '' : 'none';
        const ramVal = card.querySelector('[data-proj-ram-val]');
        if (ramVal) setText(ramVal, formatBytes(p.memory_total || 0));
    }

    const webDot = card.querySelector('[data-proj-web-dot]');
    if (webDot) setClass(webDot, 'endpoint-dot ' + (p.web_up ? 'up' : 'down'));
    const webCode = card.querySelector('[data-proj-web-code]');
    if (webCode) setText(webCode, p.web_status ? String(p.web_status) : '');

    const apiDot = card.querySelector('[data-proj-api-dot]');
    if (apiDot) setClass(apiDot, 'endpoint-dot ' + (p.api_up ? 'up' : 'down'));
    const apiCode = card.querySelector('[data-proj-api-code]');
    if (apiCode) setText(apiCode, p.api_status ? String(p.api_status) : '');

    // Update service tags
    if (p.services) {
        p.services.forEach(s => {
            const tag = card.querySelector(`[data-svc="${s.name}"]`);
            if (tag) {
                setClass(tag, 'svc-tag ' + (s.active ? 'active' : 'inactive'));
                const text = s.name + (s.memory ? ' \u00b7 ' + formatBytes(s.memory) : '');
                setText(tag, text);
            }
        });
    }
}

function renderProjects(projects, targetId, compact) {
    const el = document.getElementById(targetId);
    if (!el || !projects) return;

    if (!el.children.length || el.children.length !== projects.length) {
        el.innerHTML = projects.map(p => buildProjectCard(p, compact)).join('');
    } else {
        projects.forEach(p => {
            const card = el.querySelector(`[data-project="${p.name}"]`);
            if (card) updateProjectCard(card, p);
        });
    }
}

function renderInfra(infra, targetId) {
    const el = document.getElementById(targetId);
    if (!el || !infra) return;

    if (!el.children.length || el.children.length !== infra.length) {
        el.innerHTML = infra.map(i => {
            let dot = i.active ? 'active' : 'inactive';
            if (i.optional && !i.active) dot = 'optional';
            return `
                <div class="infra-item" data-infra="${i.name}">
                    <span class="infra-dot ${dot}" data-infra-dot></span>
                    <span class="infra-name">${i.name}</span>
                    ${i.port ? `<span class="infra-port">:${i.port}</span>` : ''}
                    <span class="infra-mem" data-infra-mem>${i.memory ? formatBytes(i.memory) : ''}</span>
                    <span class="infra-state" data-infra-state>${i.state || ''}</span>
                </div>`;
        }).join('');
    } else {
        infra.forEach(i => {
            const item = el.querySelector(`[data-infra="${i.name}"]`);
            if (!item) return;
            let dot = i.active ? 'active' : 'inactive';
            if (i.optional && !i.active) dot = 'optional';
            setClass(item.querySelector('[data-infra-dot]'), 'infra-dot ' + dot);
            setText(item.querySelector('[data-infra-mem]'), i.memory ? formatBytes(i.memory) : '');
            setText(item.querySelector('[data-infra-state]'), i.state || '');
        });
    }
}

function renderKuma(monitors, targetId) {
    const el = document.getElementById(targetId);
    if (!el || !monitors) return;

    if (!el.children.length || el.children.length !== monitors.length) {
        el.innerHTML = monitors.map(m => {
            const statusCls = m.up ? 'up' : (m.status === 2 ? 'pending' : 'down');
            return `
                <div class="kuma-item" data-kuma="${m.id}">
                    <span class="kuma-dot ${statusCls}" data-kuma-dot></span>
                    <span class="kuma-name">${m.name}</span>
                    <span class="kuma-ping" data-kuma-ping>${m.ping ? m.ping + 'ms' : ''}</span>
                    <span class="kuma-uptime" data-kuma-uptime>${m.uptime > 0 ? m.uptime.toFixed(1) + '%' : ''}</span>
                </div>`;
        }).join('');
    } else {
        monitors.forEach(m => {
            const item = el.querySelector(`[data-kuma="${m.id}"]`);
            if (!item) return;
            const statusCls = m.up ? 'up' : (m.status === 2 ? 'pending' : 'down');
            setClass(item.querySelector('[data-kuma-dot]'), 'kuma-dot ' + statusCls);
            setText(item.querySelector('[data-kuma-ping]'), m.ping ? m.ping + 'ms' : '');
            setText(item.querySelector('[data-kuma-uptime]'), m.uptime > 0 ? m.uptime.toFixed(1) + '%' : '');
        });
    }
}

function renderDomains(domains, targetId, full) {
    const el = document.getElementById(targetId);
    if (!el || !domains) return;

    if (full) {
        el.innerHTML = domains.map(d => `
            <a class="domain-card ${d.reachable === false ? 'unreachable' : ''}" href="https://${d.fqdn}" target="_blank" rel="noopener">
                <div class="domain-card-top">
                    <span class="domain-card-icon">${getDomainIcon(d.name)}</span>
                    <div class="domain-card-info">
                        <div class="domain-card-name">${d.name}</div>
                        <div class="domain-card-fqdn">${d.fqdn}</div>
                    </div>
                    <span class="endpoint-dot ${d.reachable !== false ? 'up' : 'down'}"></span>
                </div>
                ${d.description ? `<div class="domain-card-desc">${d.description}</div>` : ''}
                ${d.host ? `<div class="domain-card-meta"><span class="domain-vm-badge">${d.host}</span></div>` : ''}
            </a>`).join('');
    } else {
        el.innerHTML = domains.map(d => `
            <a class="domain-tag ${d.reachable === false ? 'unreachable' : ''}" href="https://${d.fqdn}" target="_blank" title="${d.description || d.fqdn}">
                <span class="endpoint-dot ${d.reachable !== false ? 'up' : 'down'}" style="flex-shrink:0;margin-right:2px"></span>
                ${d.name}
            </a>`).join('');
    }
}

function renderServicesTable(data, targetId) {
    const el = document.getElementById(targetId || 'servicesTable');
    if (!el) return;

    const rows = [];

    if (data.infrastructure) {
        data.infrastructure.forEach(i => {
            rows.push({ name: i.name, service: i.service, host: '-', state: i.state || (i.active ? 'active' : 'inactive'), active: i.active, level: 'system', port: i.port, optional: i.optional, memory: i.memory || 0 });
        });
    }

    if (data.projects) {
        data.projects.forEach(p => {
            if (p.services) {
                p.services.forEach(s => {
                    rows.push({ name: s.name, service: s.name, host: s.host || p.name, state: s.state, active: s.active, level: s.level, port: '', memory: s.memory || 0 });
                });
            }
        });
    }

    rows.sort((a, b) => b.memory - a.memory);

    // Apply filter
    const q = (document.getElementById('servicesFilter')?.value || '').toLowerCase().trim();
    const stateF = document.getElementById('servicesStateFilter')?.value || 'all';
    const filtered = rows.filter(r => {
        if (q && !r.service.toLowerCase().includes(q) && !(r.host || '').toLowerCase().includes(q)) return false;
        if (stateF === 'active' && !r.active) return false;
        if (stateF === 'inactive' && r.active) return false;
        return true;
    });

    el.innerHTML = `
        <table class="services-table">
            <thead>
                <tr>
                    <th>${t('col_service')}</th>
                    <th>${t('col_host')}</th>
                    <th>${t('col_level')}</th>
                    <th>${t('col_port')}</th>
                    <th>RAM</th>
                    <th>${t('col_state')}</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.length ? filtered.map(r => `
                    <tr>
                        <td>${r.service}</td>
                        <td>${r.host}</td>
                        <td>${r.level || '-'}</td>
                        <td>${r.port || '-'}</td>
                        <td class="mono">${r.memory ? formatBytes(r.memory) : '-'}</td>
                        <td><span class="badge ${r.active ? 'ok' : 'crit'}">${r.active ? t('active') : t('inactive')}</span></td>
                    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">Нет сервисов</td></tr>`}
            </tbody>
        </table>`;
}

// --- Services Filter ---
function initServicesFilter() {
    const q = document.getElementById('servicesFilter');
    const s = document.getElementById('servicesStateFilter');
    if (q) q.addEventListener('input', () => { if (lastData) renderServicesTable(lastData, 'servicesTable'); });
    if (s) s.addEventListener('change', () => { if (lastData) renderServicesTable(lastData, 'servicesTable'); });
}

function updateBanner(data) {
    const banner = document.getElementById('statusBanner');
    let overall = 'ok';

    if (data.hosts) {
        for (const h of data.hosts) {
            if (h.status === 'crit' || h.status === 'offline') { overall = 'crit'; break; }
            if (h.status === 'warn' && overall !== 'crit') overall = 'warn';
        }
    }
    if (data.projects) {
        for (const p of data.projects) {
            if (p.status === 'down') { overall = 'crit'; break; }
            if (p.status === 'degraded' && overall !== 'crit') overall = 'warn';
        }
    }

    banner.className = 'status-banner ' + overall;
    banner.querySelector('.status-banner-text').textContent = t('status_' + overall);

    // Show max host uptime
    if (data.hosts) {
        const online = data.hosts.find(h => h.online && h.uptime);
        if (online) {
            document.getElementById('bannerUptime').textContent = `${t('uptime_prefix')}: ${online.uptime}`;
        }
    }
}

function render(data) {
    // Overview tab
    renderQuickStats(data);
    renderHosts(data.hosts, 'hostsGridOverview');
    renderProjects(data.projects, 'projectsCompact', true);
    renderInfra(data.infrastructure, 'infraGridOverview');
    renderDomains(data.domains, 'domainsGridOverview', false);
    renderKuma(data.kuma, 'kumaGridOverview');

    // Overview services widget
    renderServicesTable(data, 'servicesTableOverview');

    // Dedicated tabs
    renderHosts(data.hosts, 'hostsGridFull');
    renderProjects(data.projects, 'projectsGridFull', false);
    renderServicesTable(data, 'servicesTable');
    renderDomains(data.domains, 'domainsGridFull', true);

    updateBanner(data);

    // Update time
    const dt = new Date(data.updated_at);
    document.getElementById('updatedAt').textContent = dt.toLocaleTimeString(currentLang === 'ru' ? 'ru-RU' : 'en-US');

    // Connection status
    document.getElementById('pulse').className = 'pulse-dot live';
    document.getElementById('connectionText').textContent = t('connected');

    // Hide loading
    document.getElementById('loadingOverlay').classList.remove('visible');
    document.getElementById('errorOverlay').classList.remove('visible');
}

// --- Routing ---
const VALID_TABS = ['overview', 'hosts', 'projects', 'services', 'domains'];

function switchTab(tabId) {
    if (!VALID_TABS.includes(tabId)) tabId = 'overview';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const tab = document.querySelector(`.tab[data-tab="${tabId}"]`);
    const content = document.getElementById('tab-' + tabId);
    if (tab) tab.classList.add('active');
    if (content) content.classList.add('active');
    if (location.hash !== '#' + tabId) history.pushState(null, '', '#' + tabId);
}

// --- Tabs ---
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    const hash = location.hash.slice(1);
    if (hash && VALID_TABS.includes(hash)) switchTab(hash);
    window.addEventListener('popstate', () => {
        const h = location.hash.slice(1);
        switchTab(VALID_TABS.includes(h) ? h : 'overview');
    });
}

// --- Stat Cards Navigation ---
function initStatCards() {
    const map = { statHosts: 'hosts', statProjects: 'projects', statServices: 'services', statDomains: 'domains' };
    Object.entries(map).forEach(([id, tab]) => {
        const card = document.getElementById(id)?.closest('.stat-card');
        if (card) {
            card.classList.add('clickable');
            card.addEventListener('click', () => switchTab(tab));
        }
    });
}

// --- Theme Toggle ---
function initTheme() {
    setTheme(getTheme());
    document.getElementById('themeToggle').addEventListener('click', () => {
        const next = getTheme() === 'light' ? 'dark' : 'light';
        setTheme(next);
    });
}

// --- Language Toggle ---
function initLang() {
    document.querySelectorAll('#langToggle .toggle-btn').forEach(btn => {
        if (btn.dataset.lang === currentLang) btn.classList.add('active');
        else btn.classList.remove('active');

        btn.addEventListener('click', () => {
            currentLang = btn.dataset.lang;
            localStorage.setItem('lang', currentLang);
            document.querySelectorAll('#langToggle .toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyI18n();
            // Re-render with current data
            if (lastData) render(lastData);
        });
    });
}

// --- Visibility (pause when hidden) ---
let isPaused = false;

function initVisibility() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            isPaused = true;
            document.getElementById('pauseOverlay').classList.add('visible');
        } else {
            isPaused = false;
            document.getElementById('pauseOverlay').classList.remove('visible');
        }
    });
}

// --- SSE ---
let lastData = null;
let reconnectAttempts = 0;

function connect() {
    const evtSource = new EventSource('/sse');

    evtSource.onopen = () => {
        reconnectAttempts = 0;
        document.getElementById('errorOverlay').classList.remove('visible');
    };

    evtSource.onmessage = (event) => {
        if (isPaused) return;
        try {
            const data = JSON.parse(event.data);
            lastData = data;
            render(data);
        } catch (e) {
            console.error('Parse error:', e);
        }
    };

    evtSource.onerror = () => {
        evtSource.close();
        document.getElementById('pulse').className = 'pulse-dot error';
        document.getElementById('connectionText').textContent = t('reconnecting');
        document.getElementById('loadingOverlay').classList.remove('visible');

        reconnectAttempts++;
        const delay = Math.min(3000 * reconnectAttempts, 30000);

        if (reconnectAttempts > 2) {
            document.getElementById('errorOverlay').classList.add('visible');
        }

        setTimeout(connect, delay);
    };
}

// --- Widget Drag & Drop ---
let editMode = false;
let draggedWidget = null;

function initWidgets() {
    const grid = document.getElementById('widgetGrid');
    if (!grid) return;

    // Restore saved layout
    restoreLayout();

    // Edit mode toggle
    const editBtn = document.getElementById('editToggle');
    editBtn.addEventListener('click', () => {
        editMode = !editMode;
        document.body.classList.toggle('edit-mode', editMode);
        editBtn.classList.toggle('active', editMode);

        // Toggle draggable on widgets
        grid.querySelectorAll('.widget').forEach(w => {
            w.draggable = editMode;
        });
    });

    // Resize buttons
    grid.querySelectorAll('.widget-resize').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const widget = e.target.closest('.widget');
            const current = widget.dataset.size;
            widget.dataset.size = current === '1' ? '2' : '1';
            saveLayout();
        });
    });

    // Drag events
    grid.addEventListener('dragstart', (e) => {
        if (!editMode) return;
        draggedWidget = e.target.closest('.widget');
        if (!draggedWidget) return;
        draggedWidget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    grid.addEventListener('dragend', () => {
        if (draggedWidget) {
            draggedWidget.classList.remove('dragging');
            draggedWidget = null;
        }
        grid.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
    });

    grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!editMode || !draggedWidget) return;
        const target = e.target.closest('.widget');
        if (!target || target === draggedWidget) return;

        grid.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
        target.classList.add('drag-over');
    });

    grid.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!editMode || !draggedWidget) return;
        const target = e.target.closest('.widget');
        if (!target || target === draggedWidget) return;

        target.classList.remove('drag-over');

        // Swap positions
        const widgets = [...grid.querySelectorAll('.widget')];
        const fromIdx = widgets.indexOf(draggedWidget);
        const toIdx = widgets.indexOf(target);

        if (fromIdx < toIdx) {
            target.after(draggedWidget);
        } else {
            target.before(draggedWidget);
        }

        saveLayout();
    });
}

function saveLayout() {
    const grid = document.getElementById('widgetGrid');
    if (!grid) return;
    const layout = [...grid.querySelectorAll('.widget')].map(w => ({
        id: w.dataset.widget,
        size: w.dataset.size,
    }));
    localStorage.setItem('dashboard_layout', JSON.stringify(layout));
}

function restoreLayout() {
    const saved = localStorage.getItem('dashboard_layout');
    if (!saved) return;

    try {
        const layout = JSON.parse(saved);
        const grid = document.getElementById('widgetGrid');
        if (!grid) return;

        const widgetMap = {};
        grid.querySelectorAll('.widget').forEach(w => {
            widgetMap[w.dataset.widget] = w;
        });

        // Reorder and resize
        layout.forEach(item => {
            const widget = widgetMap[item.id];
            if (widget) {
                widget.dataset.size = item.size;
                grid.appendChild(widget); // moves to end = reorders
            }
        });
    } catch(e) {
        console.error('Layout restore error:', e);
    }
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTabs();
    initStatCards();
    initLang();
    initVisibility();
    initWidgets();
    initServicesFilter();
    applyI18n();
    connect();
});
