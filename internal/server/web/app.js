/* ============================================
   core-stack.art — Infrastructure Dashboard
   ============================================ */

// --- Constants ---
const ANIMATION_DURATION_MS = 300;
const SSE_RECONNECT_BASE_DELAY_MS = 3000;
const SSE_RECONNECT_MAX_DELAY_MS = 30000;
const SEARCH_DEBOUNCE_MS = 150;
const COPY_TOAST_DURATION_MS = 2500;
const SSE_ERROR_OVERLAY_THRESHOLD = 2;

// --- XSS helpers ---
/**
 * Escape a value for safe insertion inside an HTML template literal.
 * Use inside `${}` when building innerHTML strings.
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/**
 * Create element with attributes and children.
 * Text children are automatically escaped.
 */
function el(tag, attrs = {}, ...children) {
    const elem = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'className') elem.className = v;
        else if (k === 'dataset') Object.assign(elem.dataset, v);
        else if (k.startsWith('on')) elem.addEventListener(k.slice(2).toLowerCase(), v);
        else elem.setAttribute(k, v);
    }
    for (const child of children) {
        if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
        else if (child instanceof Node) elem.appendChild(child);
    }
    return elem;
}

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
        env_dev: 'DEV',
        env_prod: 'PROD',
        search_placeholder: 'Поиск проектов, доменов, сервисов...',
        search_hint: 'Начните вводить для поиска',
        search_empty: 'Ничего не найдено',
        avg_uptime: 'Ср. аптайм',
        avg_ping: 'Ср. пинг',
        monitors_up: 'Мониторы',
        projects_ok: 'Проектов ок',
        copied: 'Скопировано',
        ctrl_start: 'Старт',
        ctrl_stop: 'Стоп',
        ctrl_restart: 'Рестарт',
        ctrl_logs: 'Логи',
        ctrl_confirm_stop: 'Остановить',
        ctrl_confirm_restart: 'Перезапустить',
        logs_title: 'Логи',
        logs_refresh: 'Обновить',
        logs_close: 'Закрыть',
        logs_loading: 'Загрузка логов...',
        logs_empty: 'Нет данных',
        logs_service_label: 'Сервис',
        logs_lines: 'строк',
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
        env_dev: 'DEV',
        env_prod: 'PROD',
        search_placeholder: 'Search projects, domains, services...',
        search_hint: 'Start typing to search',
        search_empty: 'Nothing found',
        avg_uptime: 'Avg Uptime',
        avg_ping: 'Avg Ping',
        monitors_up: 'Monitors',
        projects_ok: 'Projects OK',
        copied: 'Copied',
        ctrl_start: 'Start',
        ctrl_stop: 'Stop',
        ctrl_restart: 'Restart',
        ctrl_logs: 'Logs',
        ctrl_confirm_stop: 'Stop',
        ctrl_confirm_restart: 'Restart',
        logs_title: 'Logs',
        logs_refresh: 'Refresh',
        logs_close: 'Close',
        logs_loading: 'Loading logs...',
        logs_empty: 'No data',
        logs_service_label: 'Service',
        logs_lines: 'lines',
    }
};

// --- Application State ---
const state = {
    lang: localStorage.getItem('lang') || 'ru',
    data: null,              // last received SSE payload (mirrors lastData)
    searchIndex: [],
    searchOpen: false,
    searchFocusIdx: 0,
    isPaused: false,
    reconnectAttempts: 0,
    editMode: false,
    draggedWidget: null,
    isFirstRender: true,
    currentEnvFilter: 'all',
    domainModalDomain: null,
    logsModal: { open: false, project: null, service: null },
};

function t(key) { return I18N[state.lang][key] || I18N['en'][key] || key; }

function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(node => {
        const key = node.getAttribute('data-i18n');
        node.textContent = t(key);
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

// --- Project Logos (inline SVG) ---
const PROJECT_LOGOS = {
    cargo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#1e3a5f"/><rect x="4" y="14" width="19" height="13" rx="2" fill="white" opacity="0.9"/><path d="M23 14h7l2 5v8h-9V14z" fill="white" opacity="0.7"/><path d="M23 14l5-3.5 3 3.5z" fill="white" opacity="0.45"/><circle cx="10" cy="28.5" r="3" fill="#1e3a5f" stroke="white" stroke-width="2"/><circle cx="21" cy="28.5" r="3" fill="#1e3a5f" stroke="white" stroke-width="2"/><circle cx="28.5" cy="28.5" r="2.5" fill="#1e3a5f" stroke="white" stroke-width="2"/><rect x="6" y="17" width="6" height="4" rx="1" fill="#1e3a5f" opacity="0.35"/></svg>`,

    fabro: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#f97316"/><path d="M18 3v5M18 28v5M3 18h5M28 18h5" stroke="white" stroke-width="3" stroke-linecap="round"/><path d="M7.4 7.4l3.5 3.5M25.1 25.1l3.5 3.5M7.4 28.6l3.5-3.5M25.1 10.9l3.5-3.5" stroke="white" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="18" r="7" fill="none" stroke="white" stroke-width="2.5"/><circle cx="18" cy="18" r="3" fill="white"/><circle cx="18" cy="18" r="1.2" fill="#f97316"/></svg>`,

    puls: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#3b82f6"/><path d="M3 18h7l3-8 5 16 4-10 3 6h8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,

    emedic: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#16a34a"/><rect x="14" y="7" width="8" height="22" rx="4" fill="white"/><rect x="7" y="14" width="22" height="8" rx="4" fill="white"/></svg>`,

    skazki: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#7c3aed"/><path d="M6 11a2 2 0 012-2h9v18H8a2 2 0 01-2-2V11z" fill="white" opacity="0.9"/><path d="M30 11a2 2 0 00-2-2h-9v18h9a2 2 0 002-2V11z" fill="white" opacity="0.6"/><line x1="18" y1="9" x2="18" y2="27" stroke="#7c3aed" stroke-width="1.5"/><path d="M25 6l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="white"/></svg>`,

    kraeved: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#0d9488"/><circle cx="18" cy="17" r="10" fill="none" stroke="white" stroke-width="2"/><path d="M18 7v4M18 27v4M8 17h4M26 17h4" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M18 17l-4-7 4 2.5 4-2.5z" fill="white"/><path d="M18 17l4 7-4-2.5-4 2.5z" fill="white" opacity="0.5"/><circle cx="18" cy="17" r="2" fill="white"/><path d="M18 27v5M15 32l3 2 3-2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,

    logist23: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#f59e0b"/><rect x="8" y="10" width="20" height="21" rx="2" fill="white" opacity="0.9"/><rect x="13" y="6" width="10" height="7" rx="2" fill="#f59e0b"/><rect x="13" y="6" width="10" height="6" rx="2" fill="white" opacity="0.7"/><rect x="12" y="19" width="12" height="2.5" rx="1.25" fill="#f59e0b"/><rect x="12" y="24" width="9" height="2.5" rx="1.25" fill="#f59e0b"/><rect x="12" y="29" width="6" height="2" rx="1" fill="#f59e0b" opacity="0.6"/></svg>`,

    racia: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#b91c1c"/><rect x="13" y="12" width="10" height="18" rx="3" fill="white" opacity="0.9"/><rect x="15" y="8" width="6" height="6" rx="2" fill="white" opacity="0.7"/><circle cx="18" cy="25" r="2.5" fill="#b91c1c"/><rect x="15" y="17" width="6" height="2" rx="1" fill="#b91c1c" opacity="0.5"/><path d="M8 11c2.5-4.5 5-7 10-7s7.5 2.5 10 7" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.7"/><path d="M11 15c1.5-2.5 3.5-4 7-4s5.5 1.5 7 4" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.5"/></svg>`,
};

function getProjectLogo(name) {
    if (!name) return null;
    const lc = name.toLowerCase();
    if (lc.includes('cargo')) return PROJECT_LOGOS.cargo;
    if (lc.includes('fabro')) return PROJECT_LOGOS.fabro;
    if (lc.includes('puls')) return PROJECT_LOGOS.puls;
    if (lc.includes('medic') || lc.includes('emedic')) return PROJECT_LOGOS.emedic;
    if (lc.includes('skazki')) return PROJECT_LOGOS.skazki;
    if (lc.includes('kraev') || lc.includes('kraeved')) return PROJECT_LOGOS.kraeved;
    if (lc.includes('logist')) return PROJECT_LOGOS.logist23;
    if (lc.includes('racia')) return PROJECT_LOGOS.racia;
    return null;
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

function getDomainIcon(name) {
    if (!name) return '🌐';
    const lc = name.toLowerCase();
    // Try project logo first
    const logo = getProjectLogo(lc);
    if (logo) return logo;
    return DOMAIN_EMOJI[lc] || '🌐';
}

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
function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
}

function setClass(el, cls) {
    if (el && el.className !== cls) el.className = cls;
}

function setStyle(el, prop, val) {
    if (el && el.style[prop] !== val) el.style[prop] = val;
}

// --- Quick Stats ---
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

// --- Uptime Hero (Kuma aggregate stats) ---
function renderUptimeHero(data) {
    const el = document.getElementById('uptimeHero');
    if (!el) return;
    const kuma = data.kuma || [];
    if (!kuma.length) { el.style.display = 'none'; return; }

    const upCount = kuma.filter(m => m.up).length;
    const pingMonitors = kuma.filter(m => m.ping > 0);
    const avgPing = pingMonitors.length > 0
        ? Math.round(pingMonitors.reduce((a, m) => a + m.ping, 0) / pingMonitors.length) : 0;
    const uptimeMonitors = kuma.filter(m => m.uptime > 0);
    const avgUptime = uptimeMonitors.length > 0
        ? (uptimeMonitors.reduce((a, m) => a + m.uptime, 0) / uptimeMonitors.length).toFixed(1) : '0.0';
    const allOk = upCount === kuma.length;
    const okProjects = (data.projects || []).filter(p => p.status === 'ok').length;
    const totalProjects = (data.projects || []).length;

    el.style.display = '';
    el.innerHTML = `
        <div class="hero-stat">
            <div class="hero-val ${allOk ? 'ok' : 'warn'}">${avgUptime}%</div>
            <div class="hero-lab">${t('avg_uptime')}</div>
        </div>
        <div class="hero-sep"></div>
        <div class="hero-stat">
            <div class="hero-val ${allOk ? 'ok' : 'warn'}">${upCount}/${kuma.length}</div>
            <div class="hero-lab">${t('monitors_up')}</div>
        </div>
        ${avgPing > 0 ? `<div class="hero-sep"></div>
        <div class="hero-stat">
            <div class="hero-val">${avgPing}ms</div>
            <div class="hero-lab">${t('avg_ping')}</div>
        </div>` : ''}
        <div class="hero-sep"></div>
        <div class="hero-stat">
            <div class="hero-val ${okProjects === totalProjects ? 'ok' : 'warn'}">${okProjects}/${totalProjects}</div>
            <div class="hero-lab">${t('projects_ok')}</div>
        </div>
    `;
}

// --- ENV badge ---
function renderEnvBadge(env) {
    const el = document.getElementById('envBadge');
    if (!el || !env) return;
    el.textContent = env.toUpperCase();
    el.className = 'env-badge env-' + env.toLowerCase();
    el.style.display = '';
}


function tempClass(t) { return t >= 80 ? "crit" : t >= 65 ? "warn" : "ok"; }

function buildHostExtras(h, gpu) {
    if (!h.online) return "";
    let html = "";
    const th = h.thermal || {};

    if (th.cpu_package > 0) {
        html += `<div class="metric host-hw"><div class="metric-header">
            <span class="metric-label">CPU Temp</span>
            <span class="metric-value badge ${tempClass(th.cpu_package)}" data-host-temp>${th.cpu_package.toFixed(0)}°C</span>
            </div></div>`;
    }

    if (gpu && gpu.online) {
        html += `<div class="metric host-hw"><div class="metric-header">
            <span class="metric-label">${gpu.name}</span>
            <span class="metric-value badge ${tempClass(gpu.temp_c)}" data-host-gpu-temp>${gpu.temp_c}°C / ${gpu.util_pct}% / VRAM ${gpu.vram_used_mb}/${gpu.vram_total_mb}MB</span>
            </div></div>`;
    }

    if (th.fans && th.fans.length > 0) {
        const fansStr = th.fans.map(f => f.name + " " + f.rpm + " RPM").join(" · ");
        html += `<div class="metric host-hw"><div class="metric-header">
            <span class="metric-label">Fans</span>
            <span class="metric-value" data-host-fans>${fansStr}</span>
            </div></div>`;
    }

    const sw = h.swap || {};
    if (sw.total > 0) {
        html += `<div class="metric host-hw"><div class="metric-header">
            <span class="metric-label">SWAP</span>
            <span class="metric-value" data-host-swap>${sw.percent.toFixed(1)}% — ${formatBytes(sw.used)} / ${formatBytes(sw.total)}</span>
            </div></div>`;
    }

    if (h.procs > 0) {
        html += `<div class="metric host-hw"><div class="metric-header">
            <span class="metric-label">Processes</span>
            <span class="metric-value" data-host-procs>${h.procs}</span>
            </div></div>`;
    }

    return html ? `<div class="host-hw-section" data-host-extras>${html}</div>` : "";
}


// --- Host Hero Card (physical server) ---
function buildHostHero(h, gpu) {
    if (!h || !h.online) return '';
    const th = h.thermal || {};
    const sw = h.swap || {};
    const cpuTemp = th.cpu_package || 0;
    const cores = th.cpu_cores || [];
    const fans = th.fans || [];
    const board = th.board || [];
    const nvme = th.nvme || [];
    const voltages = th.voltages || [];
    const network = th.network || [];
    const g = gpu && gpu.online ? gpu : null;
    const vramPct = g ? (g.vram_used_mb / g.vram_total_mb * 100).toFixed(0) : 0;

    // Core temps mini heatmap
    let coresHtml = '';
    if (cores.length > 0) {
        coresHtml = '<div class="hero-cores">' + cores.map((c, i) =>
            `<span class="hero-core-dot ${tempClass(c)}" title="Core ${i}: ${c}°C"></span>`
        ).join('') + '</div>';
    }

    // Board sensor rows
    let boardHtml = '';
    if (board.length > 0) {
        boardHtml = `<div class="hero-sensors-section">
            <div class="hero-sensors-title">Board Sensors</div>
            <div class="hero-sensors-grid">
                ${board.map(s => `<div class="hero-sensor-item">
                    <span class="hero-sensor-name">${s.name}</span>
                    <span class="badge ${tempClass(s.value)}">${s.value.toFixed(1)}°C</span>
                </div>`).join('')}
            </div>
        </div>`;
    }

    // NVMe section
    let nvmeHtml = '';
    if (nvme.length > 0) {
        nvmeHtml = `<div class="hero-sensors-section">
            <div class="hero-sensors-title">NVMe</div>
            <div class="hero-sensors-grid">
                ${nvme.map(s => `<div class="hero-sensor-item">
                    <span class="hero-sensor-name">${s.name}</span>
                    <span class="badge ${tempClass(s.value)}">${s.value.toFixed(1)}°C</span>
                </div>`).join('')}
            </div>
        </div>`;
    }

    // Voltages section
    let voltHtml = '';
    if (voltages.length > 0) {
        voltHtml = `<div class="hero-sensors-section">
            <div class="hero-sensors-title">Voltages</div>
            <div class="hero-volt-grid">
                ${voltages.map(v => `<div class="hero-volt-item">
                    <span class="hero-sensor-name">${v.name}</span>
                    <span class="hero-volt-value">${v.value.toFixed(3)}V</span>
                </div>`).join('')}
            </div>
        </div>`;
    }

    // Network / ACPI line
    let extraTempsHtml = '';
    const extraItems = [];
    if (th.acpi > 0) extraItems.push(`<span class="hero-sensor-item"><span class="hero-sensor-name">ACPI</span><span class="badge ${tempClass(th.acpi)}">${th.acpi.toFixed(1)}°C</span></span>`);
    network.forEach(s => extraItems.push(`<span class="hero-sensor-item"><span class="hero-sensor-name">NIC ${s.name}</span><span class="badge ${tempClass(s.value)}">${s.value.toFixed(1)}°C</span></span>`));
    if (extraItems.length > 0) {
        extraTempsHtml = `<div class="hero-sensors-section hero-sensors-inline">
            <div class="hero-sensors-title">Other</div>
            <div class="hero-sensors-row">${extraItems.join('')}</div>
        </div>`;
    }

    // Combine all sensor sections
    const sensorsBlock = (boardHtml || nvmeHtml || voltHtml || extraTempsHtml)
        ? `<div class="hero-sensors-block">${boardHtml}${nvmeHtml}${voltHtml}${extraTempsHtml}</div>`
        : '';

    return `
    <div class="host-hero" data-host="${escapeHtml(h.name)}">
        <div class="hero-header">
            <div class="hero-title-row">
                <svg class="hero-server-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="2" y="2" width="20" height="6" rx="2"/><rect x="2" y="10" width="20" height="6" rx="2"/>
                    <circle cx="6" cy="5" r="1" fill="currentColor"/><circle cx="6" cy="13" r="1" fill="currentColor"/>
                    <line x1="10" y1="5" x2="18" y2="5"/><line x1="10" y1="13" x2="18" y2="13"/>
                    <path d="M6 18v2M12 18v2M18 18v2"/>
                </svg>
                <div>
                    <h2 class="hero-name">${escapeHtml(h.name)}</h2>
                    <span class="hero-subtitle">Proxmox VE · ${escapeHtml(h.host)} · ${t('uptime_prefix')} ${escapeHtml(h.uptime)}</span>
                </div>
                <span class="badge ${h.status} hero-badge">${t(h.status)}</span>
            </div>
            <div class="hero-load">${t('load_prefix')} ${escapeHtml(h.load)}</div>
        </div>

        <div class="hero-grid">
            <div class="hero-section">
                <h3 class="hero-section-title">CPU</h3>
                <div class="hero-big-value">${h.cpu.toFixed(1)}<span class="hero-unit">%</span></div>
                <div class="bar hero-bar"><div class="bar-fill ${barClass(h.cpu)}" style="width:${Math.min(h.cpu,100)}%"></div></div>
                <div class="hero-temp-row">
                    <span class="hero-temp-label">Package</span>
                    <span class="hero-temp-value badge ${tempClass(cpuTemp)}" data-hero-cpu-temp>${cpuTemp}°C</span>
                </div>
                ${coresHtml}
            </div>

            <div class="hero-section">
                <h3 class="hero-section-title">RAM</h3>
                <div class="hero-big-value">${h.ram.percent.toFixed(1)}<span class="hero-unit">%</span></div>
                <div class="bar hero-bar"><div class="bar-fill ${barClass(h.ram.percent, 80, 95)}" style="width:${Math.min(h.ram.percent,100)}%"></div></div>
                <div class="hero-detail">${formatBytes(h.ram.used)} / ${formatBytes(h.ram.total)}</div>
                ${sw.total > 0 ? `<div class="hero-swap-row"><span class="hero-temp-label">Swap</span><span class="hero-detail">${sw.percent.toFixed(1)}% — ${formatBytes(sw.used)} / ${formatBytes(sw.total)}</span></div>` : ''}
            </div>

            <div class="hero-section">
                <h3 class="hero-section-title">Disk</h3>
                <div class="hero-big-value">${h.disk.percent.toFixed(1)}<span class="hero-unit">%</span></div>
                <div class="bar hero-bar"><div class="bar-fill ${barClass(h.disk.percent, 80, 95)}" style="width:${Math.min(h.disk.percent,100)}%"></div></div>
                <div class="hero-detail">${formatBytes(h.disk.used)} / ${formatBytes(h.disk.total)}</div>
                <div class="hero-detail" style="margin-top:4px;opacity:0.6">${h.procs} processes</div>
            </div>

            ${g ? `<div class="hero-section hero-gpu">
                <h3 class="hero-section-title">GPU</h3>
                <div class="hero-gpu-name">${g.name}</div>
                <div class="hero-gpu-stats">
                    <div class="hero-gpu-stat">
                        <span class="hero-temp-label">Temp</span>
                        <span class="badge ${tempClass(g.temp_c)}">${g.temp_c}°C</span>
                    </div>
                    <div class="hero-gpu-stat">
                        <span class="hero-temp-label">Load</span>
                        <span class="hero-detail">${g.util_pct}%</span>
                    </div>
                    <div class="hero-gpu-stat">
                        <span class="hero-temp-label">VRAM</span>
                        <span class="hero-detail">${vramPct}% — ${g.vram_used_mb}/${g.vram_total_mb} MB</span>
                    </div>
                </div>
                <div class="bar hero-bar"><div class="bar-fill ${barClass(parseFloat(vramPct), 80, 95)}" style="width:${Math.min(vramPct,100)}%"></div></div>
            </div>` : ''}
        </div>

        ${sensorsBlock}

        <div class="hero-footer">
            ${fans.length > 0 ? `<div class="hero-fans">${fans.map(f =>
                `<span class="hero-fan"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12c-1.5-3-4-5-7-4 1-3 4-5 7-4 -3-1.5-5-4-4-7 3 1 5 4 4 7 1.5-3 4-5 7-4-1 3-4 5-7 4 3 1.5 5 4 4 7-3-1-5-4-4-7z"/><circle cx="12" cy="12" r="2"/></svg> ${f.name} <b>${f.rpm}</b> RPM</span>`
            ).join('')}</div>` : ''}
            <button class="ssh-copy-btn" data-ssh-host="${escapeHtml(h.host)}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                ssh root@${escapeHtml(h.host)}
            </button>
        </div>
    </div>`;
}

function updateHostHero(el, h, gpu) {
    if (!el || !h || !h.online) return;
    const th = h.thermal || {};
    const g = gpu && gpu.online ? gpu : null;

    const tempEl = el.querySelector('[data-hero-cpu-temp]');
    if (tempEl && th.cpu_package > 0) {
        tempEl.textContent = th.cpu_package + '°C';
        tempEl.className = 'hero-temp-value badge ' + tempClass(th.cpu_package);
    }

    // Rerender on each tick for simplicity (hero is one card)
    const heroEl = document.getElementById('hostHero');
    if (heroEl && heroEl.querySelector('[data-host="' + h.name + '"]')) {
        heroEl.innerHTML = buildHostHero(h, g);
    }
}

// --- Host Cards (with SSH copy) ---
function buildHostCard(h, gpu) {
    return `
        <div class="host-card ${h.status}" data-host="${escapeHtml(h.name)}">
            <div class="host-header">
                <span class="host-name">${escapeHtml(h.name)}</span>
                <span class="badge ${h.status}" data-host-badge>${t(h.status)}</span>
            </div>
            <div class="host-meta">
                <span>${escapeHtml(h.type)}</span>
                <span class="host-ip">${escapeHtml(h.host)}</span>
                <span data-host-uptime>${h.uptime ? t('uptime_prefix') + ' ' + escapeHtml(h.uptime) : ''}</span>
                <span data-host-load>${h.load ? t('load_prefix') + ' ' + escapeHtml(h.load) : ''}</span>
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
            ${buildHostExtras(h, h.type === "proxmox" ? (window._dashGpu || null) : null)}
            ${h.online ? `<div class="host-footer">
                <button class="ssh-copy-btn" data-ssh-host="${escapeHtml(h.host)}" title="Скопировать SSH команду">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    ssh dev@${escapeHtml(h.host)}
                </button>
            </div>` : ''}
        </div>`;
}

function updateHostCard(card, h) {
    card.className = 'host-card ' + h.status;
    const badge = card.querySelector('[data-host-badge]');
    if (badge) { setClass(badge, 'badge ' + h.status); setText(badge, t(h.status)); }

    setText(card.querySelector('[data-host-uptime]'), h.uptime ? t('uptime_prefix') + ' ' + h.uptime : '');
    setText(card.querySelector('[data-host-load]'), h.load ? t('load_prefix') + ' ' + h.load : '');

    setText(card.querySelector('[data-host-cpu]'), h.online ? h.cpu.toFixed(1) + '%' : '-');
    const cpuBar = card.querySelector('[data-host-cpu-bar]');
    if (cpuBar) { setStyle(cpuBar, 'width', (h.online ? Math.min(h.cpu, 100) : 0) + '%'); setClass(cpuBar, 'bar-fill ' + (h.online ? barClass(h.cpu) : '')); }

    setText(card.querySelector('[data-host-ram]'), h.online ? h.ram.percent.toFixed(1) + '% \u2014 ' + formatBytes(h.ram.used) + ' / ' + formatBytes(h.ram.total) : '-');
    const ramBar = card.querySelector('[data-host-ram-bar]');
    if (ramBar) { setStyle(ramBar, 'width', (h.online ? Math.min(h.ram.percent, 100) : 0) + '%'); setClass(ramBar, 'bar-fill ' + (h.online ? barClass(h.ram.percent, 80, 95) : '')); }

    setText(card.querySelector('[data-host-disk]'), h.online ? h.disk.percent.toFixed(1) + '% \u2014 ' + formatBytes(h.disk.used) + ' / ' + formatBytes(h.disk.total) : '-');
    const diskBar = card.querySelector('[data-host-disk-bar]');
    if (diskBar) { setStyle(diskBar, 'width', (h.online ? Math.min(h.disk.percent, 100) : 0) + '%'); setClass(diskBar, 'bar-fill ' + (h.online ? barClass(h.disk.percent, 80, 95) : '')); }
}

function renderHosts(hosts, targetId) {
    const el = document.getElementById(targetId);
    if (!el || !hosts) return;

    // For full hosts tab: render hero separately, VMs in grid
    if (targetId === 'hostsGridFull') {
        const heroHost = hosts.find(h => h.type === 'proxmox');
        const vmHosts = hosts.filter(h => h.type !== 'proxmox');
        const heroEl = document.getElementById('hostHero');

        // Render hero
        if (heroEl && heroHost) {
            const gpu = window._dashGpu || null;
            heroEl.innerHTML = buildHostHero(heroHost, gpu);
        }

        // Render VM grid
        if (!el.children.length || el.children.length !== vmHosts.length) {
            el.innerHTML = vmHosts.map(h => buildHostCard(h)).join('');
        } else {
            vmHosts.forEach(h => {
                const card = el.querySelector(`[data-host="${h.name}"]`);
                if (card) updateHostCard(card, h);
            });
        }
        return;
    }

    // Overview: all hosts in compact grid
    if (!el.children.length || el.children.length !== hosts.length) {
        el.innerHTML = hosts.map(h => buildHostCard(h)).join('');
    } else {
        hosts.forEach(h => {
            const card = el.querySelector(`[data-host="${h.name}"]`);
            if (card) updateHostCard(card, h);
        });
    }
}

// --- Project Cards (with logo) ---
function buildProjectCard(p, compact) {
    const logo = getProjectLogo(p.name);
    const iconHtml = logo
        ? `<span class="project-icon project-logo-icon">${logo}</span>`
        : `<span class="project-icon">${getIcon(p.icon)}</span>`;

    return `
        <div class="project-card ${p.status}" data-project="${escapeHtml(p.name)}" style="cursor:pointer" onclick="openProjectModal(${JSON.stringify(p).replace(/"/g, '&quot;')})">
            <div class="project-header">
                ${iconHtml}
                <span class="project-name">${escapeHtml(p.name)}</span>
                <span class="project-status-badge badge ${p.status}" data-proj-badge>${t(p.status)}</span>
            </div>
            ${!compact ? `<div class="project-desc">${escapeHtml(p.description)}</div>` : ''}
            <div class="project-ram" data-proj-ram style="${p.memory_total ? '' : 'display:none'}">
                <span class="ram-label">RAM</span>
                <span class="ram-value" data-proj-ram-val>${formatBytes(p.memory_total || 0)}</span>
            </div>
            <div class="project-endpoints">
                ${p.local_web || p.local_api ? `<div class="env-label">DEV (VM100)</div>` : ''}
                ${p.local_api ? `
                    <div class="endpoint">
                        <span class="endpoint-dot up" data-proj-local-api-dot></span>
                        <span class="endpoint-label">API</span>
                        <span class="endpoint-url">${escapeHtml(p.local_api.replace('http://','').replace('https://',''))}</span>
                    </div>` : ''}
                ${p.local_web ? `
                    <div class="endpoint">
                        <span class="endpoint-dot up" data-proj-local-web-dot></span>
                        <span class="endpoint-label">WEB</span>
                        <span class="endpoint-url">${escapeHtml(p.local_web.replace('http://','').replace('https://',''))}</span>
                    </div>` : ''}
                ${p.web_url || p.api_url ? `<div class="env-label">PROD (VM200)</div>` : ''}
                ${p.api_url ? `
                    <div class="endpoint">
                        <span class="endpoint-dot ${p.api_up ? 'up' : 'down'}" data-proj-api-dot></span>
                        <span class="endpoint-label">API</span>
                        <a href="${escapeHtml(p.api_url)}" target="_blank">${escapeHtml(p.api_url.replace('https://',''))}</a>
                        <span class="endpoint-status" data-proj-api-code>${escapeHtml(p.api_status || '')}</span>
                    </div>` : ''}
                ${p.web_url ? `
                    <div class="endpoint">
                        <span class="endpoint-dot ${p.web_up ? 'up' : 'down'}" data-proj-web-dot></span>
                        <span class="endpoint-label">WEB</span>
                        <a href="${escapeHtml(p.web_url)}" target="_blank">${escapeHtml(p.web_url.replace('https://',''))}</a>
                        <span class="endpoint-status" data-proj-web-code>${escapeHtml(p.web_status || '')}</span>
                    </div>` : ''}
            </div>
            ${!compact && p.services && p.services.length ? `<div class="project-services" data-proj-svcs>
                ${p.services.map(s => `<span class="svc-tag ${s.active ? 'active' : 'inactive'}" data-svc="${escapeHtml(s.name)}">${escapeHtml(s.name)}${s.memory ? ' \u00b7 ' + formatBytes(s.memory) : ''}</span>`).join('')}
            </div>` : ''}
            ${!compact && (p.local_api || p.local_web) ? `<div class="project-controls" data-for-status="${escapeHtml(p.status)}" data-env="dev" onclick="event.stopPropagation()">
                <span class="ctrl-env-label">DEV</span>
                ${p.status !== 'running' ? `<button class="ctrl-btn primary" data-ctrl-action="start" data-ctrl-project="${escapeHtml(p.name)}" title="${t('ctrl_start')}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    ${t('ctrl_start')}
                </button>` : ''}
                ${p.status === 'running' ? `<button class="ctrl-btn danger" data-ctrl-action="stop" data-ctrl-project="${escapeHtml(p.name)}" title="${t('ctrl_stop')}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                    ${t('ctrl_stop')}
                </button>` : ''}
                <button class="ctrl-btn" data-ctrl-action="restart" data-ctrl-project="${escapeHtml(p.name)}" title="${t('ctrl_restart')}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    ${t('ctrl_restart')}
                </button>
                <button class="ctrl-btn" data-ctrl-action="logs" data-ctrl-project="${escapeHtml(p.name)}" title="${t('ctrl_logs')}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    ${t('ctrl_logs')}
                </button>
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

    if (p.services) {
        p.services.forEach(s => {
            const tag = card.querySelector(`[data-svc="${s.name}"]`);
            if (tag) {
                setClass(tag, 'svc-tag ' + (s.active ? 'active' : 'inactive'));
                setText(tag, s.name + (s.memory ? ' \u00b7 ' + formatBytes(s.memory) : ''));
            }
        });
    }

    // Rebuild controls bar when status changes (Start/Stop visibility depends on status)
    const controls = card.querySelector('.project-controls');
    if (controls) {
        const prevStatus = controls.dataset.forStatus;
        if (prevStatus !== p.status) {
            controls.dataset.forStatus = p.status;
            const startBtn = controls.querySelector('[data-ctrl-action="start"]');
            const stopBtn = controls.querySelector('[data-ctrl-action="stop"]');
            const isRunning = p.status === 'running';

            if (isRunning && startBtn) {
                // Replace start with stop
                const newStop = document.createElement('button');
                newStop.className = 'ctrl-btn danger';
                newStop.dataset.ctrlAction = 'stop';
                newStop.dataset.ctrlProject = p.name;
                newStop.title = t('ctrl_stop');
                newStop.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> ${t('ctrl_stop')}`;
                controls.replaceChild(newStop, startBtn);
            } else if (!isRunning && stopBtn) {
                // Replace stop with start
                const newStart = document.createElement('button');
                newStart.className = 'ctrl-btn primary';
                newStart.dataset.ctrlAction = 'start';
                newStart.dataset.ctrlProject = p.name;
                newStart.title = t('ctrl_start');
                newStart.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> ${t('ctrl_start')}`;
                controls.replaceChild(newStart, stopBtn);
            }
        }
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

// --- Projects env filter ---
function filterProjectsByEnv(env) {
    state.currentEnvFilter = env;
    document.body.classList.remove('env-dev', 'env-prod', 'env-all');
    document.body.classList.add('env-' + env);
    document.querySelectorAll('.env-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.env === env);
    });
    const cards = document.querySelectorAll('#projectsGridFull .project-card');
    cards.forEach(card => {
        if (env === 'all') { card.style.display = ''; return; }
        const endpoints = card.querySelectorAll('.env-label');
        const hasEnv = Array.from(endpoints).some(el => {
            if (env === 'dev') return el.textContent.includes('DEV');
            if (env === 'prod') return el.textContent.includes('PROD');
            return true;
        });
        card.style.display = hasEnv ? '' : 'none';
        // Hide opposite env sections
        card.querySelectorAll('.env-label').forEach(el => {
            const section = el;
            let next = section.nextElementSibling;
            const isTarget = (env === 'dev' && el.textContent.includes('DEV')) ||
                             (env === 'prod' && el.textContent.includes('PROD'));
            const isOther = !isTarget;
            section.style.display = env === 'all' ? '' : (isOther ? 'none' : '');
            while (next && !next.classList.contains('env-label')) {
                next.style.display = env === 'all' ? '' : (isOther ? 'none' : '');
                next = next.nextElementSibling;
            }
        });
    });
}

// --- Infra Grid ---
function renderInfra(infra, targetId) {
    const el = document.getElementById(targetId);
    if (!el || !infra) return;

    if (!el.children.length || el.children.length !== infra.length) {
        el.innerHTML = infra.map(i => {
            let dot = i.active ? 'active' : 'inactive';
            if (i.optional && !i.active) dot = 'optional';
            return `
                <div class="infra-item" data-infra="${escapeHtml(i.name)}">
                    <span class="infra-dot ${dot}" data-infra-dot></span>
                    <span class="infra-name">${escapeHtml(i.name)}</span>
                    ${i.port ? `<span class="infra-port">:${escapeHtml(i.port)}</span>` : ''}
                    <span class="infra-mem" data-infra-mem>${i.memory ? formatBytes(i.memory) : ''}</span>
                    <span class="infra-state" data-infra-state>${escapeHtml(i.state || '')}</span>
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

// --- Kuma Monitors ---
function renderKuma(monitors, targetId) {
    const el = document.getElementById(targetId);
    if (!el || !monitors) return;

    if (!el.children.length || el.children.length !== monitors.length) {
        el.innerHTML = monitors.map(m => {
            const statusCls = m.up ? 'up' : (m.status === 2 ? 'pending' : 'down');
            return `
                <div class="kuma-item" data-kuma="${escapeHtml(m.id)}">
                    <span class="kuma-dot ${statusCls}" data-kuma-dot></span>
                    <span class="kuma-name">${escapeHtml(m.name)}</span>
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


const PROJECT_DOMAIN_MAP = {
    'cargo': 'Cargo',      'cargo-api': 'Cargo',
    'fabro': 'Fabro',      'fabro-api': 'Fabro',
    'puls': 'Puls',        'puls-api': 'Puls',
    'emedic': 'e-medic',   'emedic-api': 'e-medic',
    'skazki': 'Skazki',    'skazki-api': 'Skazki',
    'kraeved': 'Краевед',  'kraeved-api': 'Краевед',
    'logist23': 'Logist23','logist23-api': 'Logist23',
    'racia': 'Racia',      'api.racia': 'Racia',
    'api': 'Racia',
};

const INFRA_DOMAINS = new Set([
    'tasks','status','grafana','admin','ai','errors','logs','s3','search','info','cdn'
]);


// --- Domain Modal ---
function openDomainModal(d) {
    state.domainModalDomain = d;
    const modal = document.getElementById('domainModal');
    if (!modal) return;

    document.getElementById('domainModalIcon').textContent = getDomainIcon(d.name) && getDomainIcon(d.name).startsWith('<svg') ? '' : getDomainIcon(d.name);
    document.getElementById('domainModalName').textContent = d.name;

    const href = d.url || 'https://' + d.fqdn;
    const bodyEl = document.getElementById('domainModalBody');
    bodyEl.innerHTML = '';

    const copySvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';

    // URL row
    const urlRow = document.createElement('div');
    urlRow.className = 'domain-modal-row';
    urlRow.innerHTML = '<span class="domain-modal-label">URL</span>';
    const urlVal = document.createElement('span');
    urlVal.className = 'domain-modal-val';
    const urlLink = document.createElement('a');
    urlLink.href = href;
    urlLink.target = '_blank';
    urlLink.textContent = d.fqdn;
    urlVal.appendChild(urlLink);
    urlRow.appendChild(urlVal);
    bodyEl.appendChild(urlRow);

    // Description row
    if (d.description) {
        const descRow = document.createElement('div');
        descRow.className = 'domain-modal-row';
        descRow.innerHTML = '<span class="domain-modal-label">Описание</span>';
        const descVal = document.createElement('span');
        descVal.className = 'domain-modal-val';
        descVal.textContent = d.description;
        descRow.appendChild(descVal);
        bodyEl.appendChild(descRow);
    }

    // LAN type row
    if (d.local) {
        const lanRow = document.createElement('div');
        lanRow.className = 'domain-modal-row';
        lanRow.innerHTML = '<span class="domain-modal-label">Тип</span><span class="domain-modal-val">🏠 LAN (локальный)</span>';
        bodyEl.appendChild(lanRow);
    }

    // Login row — use data-copy attribute, wired via addEventListener
    if (d.login) {
        const loginRow = document.createElement('div');
        loginRow.className = 'domain-modal-row';
        loginRow.innerHTML = '<span class="domain-modal-label">Логин</span>';
        const credRow = document.createElement('div');
        credRow.className = 'domain-cred-row';
        credRow.style.flex = '1';
        const loginVal = document.createElement('span');
        loginVal.className = 'domain-cred-val';
        loginVal.textContent = d.login;
        const copyBtn = document.createElement('button');
        copyBtn.className = 'domain-cred-copy';
        copyBtn.title = 'Копировать';
        copyBtn.innerHTML = copySvg;
        copyBtn.dataset.copy = d.login;
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(d.login).then(() => showCopyToast(d.login));
        });
        credRow.appendChild(loginVal);
        credRow.appendChild(copyBtn);
        loginRow.appendChild(credRow);
        bodyEl.appendChild(loginRow);
    }

    // Password row — store password in dataset, no inline onclick
    if (d.password) {
        const pwdRow = document.createElement('div');
        pwdRow.className = 'domain-modal-row';
        pwdRow.innerHTML = '<span class="domain-modal-label">Пароль</span>';
        const credRow = document.createElement('div');
        credRow.className = 'domain-cred-row';
        credRow.style.flex = '1';
        const pwdVal = document.createElement('span');
        pwdVal.className = 'domain-cred-val';
        pwdVal.id = 'modalPwdVal';
        pwdVal.dataset.show = 'false';
        pwdVal.dataset.pwd = d.password;
        pwdVal.textContent = '••••••••';
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'domain-cred-toggle';
        toggleBtn.title = 'Показать/скрыть';
        toggleBtn.textContent = '👁';
        toggleBtn.addEventListener('click', () => {
            const showing = pwdVal.dataset.show === 'true';
            pwdVal.dataset.show = showing ? 'false' : 'true';
            pwdVal.textContent = showing ? '••••••••' : pwdVal.dataset.pwd;
        });
        const copyBtn = document.createElement('button');
        copyBtn.className = 'domain-cred-copy';
        copyBtn.title = 'Копировать';
        copyBtn.innerHTML = copySvg;
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(d.password).then(() => showCopyToast('copied'));
        });
        credRow.appendChild(pwdVal);
        credRow.appendChild(toggleBtn);
        credRow.appendChild(copyBtn);
        pwdRow.appendChild(credRow);
        bodyEl.appendChild(pwdRow);
    }

    if (!d.login && !d.password) {
        const noAuthRow = document.createElement('div');
        noAuthRow.className = 'domain-modal-row';
        noAuthRow.innerHTML = '<span class="domain-modal-label"></span>';
        const noAuthVal = document.createElement('span');
        noAuthVal.className = 'domain-modal-val';
        noAuthVal.style.cssText = 'color:var(--text-muted);font-style:italic';
        noAuthVal.textContent = 'Без авторизации';
        noAuthRow.appendChild(noAuthVal);
        bodyEl.appendChild(noAuthRow);
    }

    modal.classList.remove('hidden');
}

function toggleModalPwd(pwd) {
    const el = document.getElementById('modalPwdVal');
    if (!el) return;
    const showing = el.dataset.show === 'true';
    el.dataset.show = showing ? 'false' : 'true';
    el.textContent = showing ? '••••••••' : pwd;
}

function closeDomainModal() {
    document.getElementById('domainModal')?.classList.add('hidden');
}

function initDomainModal() {
    document.getElementById('domainModalClose')?.addEventListener('click', closeDomainModal);
    document.getElementById('domainModal')?.addEventListener('click', function(e) {
        if (e.target === this) closeDomainModal();
    });
}

// --- Keys Button (navbar) - opens domains overview modal ---
function initKeysBtn() {
    document.getElementById('keysBtn')?.addEventListener('click', () => {
        if (!state.data || !state.data.domains) return;
        const hasCredentials = state.data.domains.filter(d => d.login || d.password);
        if (hasCredentials.length > 0) {
            openDomainModal(hasCredentials[0]);
        } else {
            switchTab('domains');
        }
    });
}



// --- Domains: grouped by project ---
function getDomainGroup(d) {
    if (d.local) return '__lan__';
    const name = d.name.toLowerCase();
    const proj = PROJECT_DOMAIN_MAP[name];
    if (proj) return proj;
    if (INFRA_DOMAINS.has(name)) return '__infra__';
    return '__other__';
}

function renderDomains(domains, targetId, full) {
    const el = document.getElementById(targetId);
    if (!el || !domains) return;

    if (full) {
        const q = (document.getElementById('domainsFilter')?.value || '').toLowerCase().trim();
        const typeF = document.getElementById('domainsTypeFilter')?.value || 'all';

        const filtered = domains.filter(d => {
            if (q && !d.name.toLowerCase().includes(q) && !d.fqdn.toLowerCase().includes(q) && !(d.description || '').toLowerCase().includes(q)) return false;
            if (typeF === 'cloud' && d.local) return false;
            if (typeF === 'lan' && !d.local) return false;
            if (typeF === 'down' && d.reachable !== false) return false;
            if (typeF === 'keys' && !d.login && !d.password) return false;
            return true;
        });

        // Group domains
        const groups = {};
        filtered.forEach(d => {
            const g = getDomainGroup(d);
            if (!groups[g]) groups[g] = [];
            groups[g].push(d);
        });

        // Render order: projects first (sorted), then infra, then lan, then other
        const projectNames = Object.keys(groups).filter(k => k !== '__infra__' && k !== '__lan__' && k !== '__other__').sort();
        const groupOrder = [...projectNames, '__infra__', '__lan__', '__other__'];

        const GROUP_META = {
            '__infra__': { title: 'Инфраструктура', icon: '⚙️' },
            '__lan__': { title: 'LAN / Локальные', icon: '🏠' },
            '__other__': { title: 'Прочие', icon: '🌐' },
        };

        let html = '';
        groupOrder.forEach(g => {
            if (!groups[g] || !groups[g].length) return;
            const meta = GROUP_META[g] || { title: g, icon: getProjectLogo(g) ? '' : '📦' };
            const logoHtml = getProjectLogo(g)
                ? '<span style="width:20px;height:20px;display:flex">' + getProjectLogo(g) + '</span>'
                : '<span>' + meta.icon + '</span>';

            html += '<div class="domains-group">' +
                '<div class="domains-group-header">' +
                logoHtml +
                '<span class="domains-group-title">' + meta.title + '</span>' +
                '<span class="domains-group-count">' + groups[g].length + '</span>' +
                '</div>';

            groups[g].forEach(d => {
                const href = d.url || 'https://' + d.fqdn;
                const hasKey = d.login || d.password;
                const domIcon = getDomainIcon(d.name);
                const isSvgIcon = domIcon && domIcon.startsWith('<svg');
                const iconHtml = isSvgIcon
                    ? '<span style="width:16px;height:16px;display:flex;flex-shrink:0">' + domIcon + '</span>'
                    : '<span style="font-size:14px;flex-shrink:0">' + domIcon + '</span>';

                html += '<div class="domain-row-item" onclick="openDomainModal(' + JSON.stringify(d).replace(/"/g, '&quot;') + ')">' +
                    iconHtml +
                    '<span class="domain-row-name">' + escapeHtml(d.name) + '</span>' +
                    '<span class="domain-row-fqdn">' + escapeHtml(d.fqdn) + '</span>' +
                    '<span class="domain-row-desc">' + escapeHtml(d.description || '') + '</span>' +
                    '<div class="domain-row-badges">' +
                    (d.local ? '<span class="domain-lan-badge">LAN</span>' : '') +
                    (hasKey ? '<span class="domain-key-icon">🔑</span>' : '') +
                    '<span class="badge ' + (d.reachable !== false ? 'ok' : 'crit') + '" style="font-size:9px;padding:1px 5px">' + (d.reachable !== false ? 'up' : 'down') + '</span>' +
                    '</div>' +
                    '</div>';
            });

            html += '</div>';
        });

        el.innerHTML = html || '<div style="text-align:center;color:var(--text-muted);padding:24px">Нет доменов</div>';

    } else {
        // Overview widget: compact tags
        el.innerHTML = domains.filter(d => !d.local).slice(0, 20).map(d => '<a class="domain-tag ' + (d.reachable === false ? 'unreachable' : '') + '" href="' + escapeHtml(d.url || 'https://' + d.fqdn) + '" target="_blank" title="' + escapeHtml(d.description || d.fqdn) + '">' +
            '<span class="endpoint-dot ' + (d.reachable !== false ? 'up' : 'down') + '" style="flex-shrink:0;margin-right:2px"></span>' +
            escapeHtml(d.name) + '</a>').join('');
    }
}

function initDomainsFilter() {
    const q = document.getElementById('domainsFilter');
    const s = document.getElementById('domainsTypeFilter');
    if (q) q.addEventListener('input', () => { if (state.data) renderDomains(state.data.domains, 'domainsGridFull', true); });
    if (s) s.addEventListener('change', () => { if (state.data) renderDomains(state.data.domains, 'domainsGridFull', true); });
}

// --- Services Table ---
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
                        <td>${escapeHtml(r.service)}</td>
                        <td>${escapeHtml(r.host)}</td>
                        <td>${escapeHtml(r.level || '-')}</td>
                        <td>${escapeHtml(r.port || '-')}</td>
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
    if (q) q.addEventListener('input', () => { if (state.data) renderServicesTable(state.data, 'servicesTable'); });
    if (s) s.addEventListener('change', () => { if (state.data) renderServicesTable(state.data, 'servicesTable'); });
}

// --- Status Banner (removed from UI, kept as no-op) ---
function updateBanner(data) {
    const banner = document.getElementById('statusBanner');
    if (!banner) return;
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

    if (data.hosts) {
        const online = data.hosts.find(h => h.online && h.uptime);
        if (online) {
            document.getElementById('bannerUptime').textContent = `${t('uptime_prefix')}: ${online.uptime}`;
        }
    }
}

// --- Ollama + GPU Widget ---
function renderOllama(gpu, ollama) {
    const el = document.getElementById('ollamaWidget');
    if (!el) return;

    const vramPct = (gpu && gpu.online && gpu.vram_total_mb)
        ? (gpu.vram_used_mb / gpu.vram_total_mb * 100) : 0;

    const gpuHtml = gpu && gpu.online
        ? '<div class="ollama-row ollama-gpu-name">' +
          '<span>' + gpu.name + '</span>' +
          '<span class="badge ok">GPU online</span>' +
          '</div>' +
          '<div class="metric">' +
          '<div class="metric-header">' +
          '<span class="metric-label">VRAM</span>' +
          '<span class="metric-value">' + vramPct.toFixed(0) + '% — ' + gpu.vram_used_mb + ' / ' + gpu.vram_total_mb + ' MB</span>' +
          '</div>' +
          '<div class="bar"><div class="bar-fill ' + barClass(vramPct, 80, 95) + '" style="width:' + Math.min(vramPct, 100) + '%"></div></div>' +
          '</div>' +
          '<div class="ollama-gpu-meta">' +
          '<span>🌡 ' + gpu.temp_c + '°C</span>' +
          '<span>⚡ ' + gpu.util_pct + '%</span>' +
          '</div>'
        : '<div class="ollama-row"><span class="badge crit">GPU offline</span></div>';

    const modelsHtml = (ollama && ollama.online && ollama.models && ollama.models.length)
        ? '<div class="ollama-models">' +
          ollama.models.map(m => '<span class="ollama-model-tag">' + m.name.replace(':latest', '') + '</span>').join('') +
          '</div>'
        : '';

    el.innerHTML =
        '<div class="ollama-gpu-section">' + gpuHtml + '</div>' +
        '<div class="ollama-models-section">' +
        '<div class="ollama-row">' +
        '<span class="metric-label">Ollama</span>' +
        '<span class="badge ' + (ollama && ollama.online ? 'ok' : 'crit') + '">' + (ollama && ollama.online ? 'online' : 'offline') + '</span>' +
        '</div>' +
        modelsHtml +
        '</div>';
}


// --- Project Detail Modal ---
function openProjectModal(p) {
    const modal = document.getElementById('projectDetailModal');
    if (!modal) return;

    const logo = getProjectLogo(p.name);
    const titleEl = document.getElementById('projModalTitle');
    titleEl.innerHTML =
        (logo ? '<span style="width:28px;height:28px;display:flex;flex-shrink:0">' + logo + '</span>'
               : '<span style="font-size:20px">' + getIcon(p.icon) + '</span>') +
        '<span>' + escapeHtml(p.name) + '</span>' +
        '<span class="badge ' + p.status + '" style="font-size:11px">' + t(p.status) + '</span>';

    let body = '';

    if (p.purpose || p.description) {
        body += '<div style="background:var(--bg-secondary);border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:13px;color:var(--text-secondary);line-height:1.5">' +
            escapeHtml(p.purpose || p.description) + '</div>';
    }

    // Production URLs
    body += '<div style="margin-bottom:14px"><div class="proj-section-title">Продакшн</div>';
    if (p.web_url) body += '<div class="domain-modal-row"><span class="domain-modal-label">WEB</span><span class="domain-modal-val"><span class="endpoint-dot ' + (p.web_up ? 'up' : 'down') + '" style="margin-right:6px"></span><a href="' + escapeHtml(p.web_url) + '" target="_blank">' + escapeHtml(p.web_url) + '</a>' + (p.web_status ? ' <span style="color:var(--text-muted);font-size:11px">' + escapeHtml(p.web_status) + '</span>' : '') + '</span></div>';
    if (p.api_url) body += '<div class="domain-modal-row"><span class="domain-modal-label">API</span><span class="domain-modal-val"><span class="endpoint-dot ' + (p.api_up ? 'up' : 'down') + '" style="margin-right:6px"></span><a href="' + escapeHtml(p.api_url) + '" target="_blank">' + escapeHtml(p.api_url) + '</a>' + (p.api_status ? ' <span style="color:var(--text-muted);font-size:11px">' + escapeHtml(p.api_status) + '</span>' : '') + '</span></div>';
    body += '</div>';

    // Local URLs
    if (p.local_web || p.local_api) {
        body += '<div style="margin-bottom:14px"><div class="proj-section-title">🏠 Локальные (LAN)</div>';
        if (p.local_web) body += '<div class="domain-modal-row"><span class="domain-modal-label">WEB</span><span class="domain-modal-val"><a href="' + escapeHtml(p.local_web) + '" target="_blank">' + escapeHtml(p.local_web) + '</a></span></div>';
        if (p.local_api) body += '<div class="domain-modal-row"><span class="domain-modal-label">API</span><span class="domain-modal-val"><a href="' + escapeHtml(p.local_api) + '" target="_blank">' + escapeHtml(p.local_api) + '</a></span></div>';
        body += '</div>';
    }

    // Accounts table — safe: use escapeHtml for all user data, data-* for sensitive values
    if (p.accounts && p.accounts.length) {
        body += '<div style="margin-bottom:14px"><div class="proj-section-title">\u{1F511} \u{423}\u{447}\u{451}\u{442}\u{43D}\u{44B}\u{435} \u{437}\u{430}\u{43F}\u{438}\u{441}\u{438}</div>';
        body += '<table class="accounts-table"><thead><tr><th>Email</th><th>\u{420}\u{43E}\u{43B}\u{44C}</th><th>\u{41F}\u{430}\u{440}\u{43E}\u{43B}\u{44C}</th><th>\u{417}\u{430}\u{43C}\u{435}\u{442}\u{43A}\u{430}</th><th></th></tr></thead><tbody>';
        p.accounts.forEach((a, idx) => {
            const pwdId = 'apwd_' + idx + '_' + p.name.replace(/[^a-z0-9]/gi, '');
            body += '<tr>' +
                '<td class="mono" style="font-size:11px">' + escapeHtml(a.email) + '</td>' +
                '<td><span class="role-badge">' + escapeHtml(a.role || '-') + '</span></td>' +
                '<td><span id="' + escapeHtml(pwdId) + '" data-pwd="' + escapeHtml(a.password||'') + '" data-show="false" style="font-family:var(--font-mono);font-size:11px">' + (a.password ? '\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}' : '\u{2014}') + '</span></td>' +
                '<td style="font-size:11px;color:var(--text-muted)">' + escapeHtml(a.note || '') + '</td>' +
                '<td style="white-space:nowrap">' +
                (a.password ? '<button class="domain-cred-toggle" data-pwd-target="' + escapeHtml(pwdId) + '" title="\u{41F}\u{43E}\u{43A}\u{430}\u{437}\u{430}\u{442}\u{44C}" style="margin-right:3px">\u{1F441}</button>' : '') +
                '<button class="domain-cred-copy" data-copy="' + escapeHtml(a.email||'') + '" title="Copy email"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>' +
                '</td></tr>';
        });
        body += '</tbody></table></div>';
    }

        // Services
    if (p.services && p.services.length) {
        body += '<div><div class="proj-section-title">Сервисы</div>';
        body += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
        p.services.forEach(s => {
            body += '<span class="svc-tag ' + (s.active ? 'active' : 'inactive') + '">' + escapeHtml(s.name) + (s.memory ? ' · ' + formatBytes(s.memory) : '') + '</span>';
        });
        body += '</div>';
        if (p.memory_total) body += '<div style="font-size:11px;color:var(--text-muted);margin-top:6px">Всего RAM: ' + formatBytes(p.memory_total) + '</div>';
        body += '</div>';
    }

    const bodyEl = document.getElementById('projModalBody');
    bodyEl.innerHTML = body;

    // Wire up copy buttons
    bodyEl.querySelectorAll('[data-copy]').forEach(btn => {
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(btn.dataset.copy).then(() => showCopyToast(btn.dataset.copy));
        });
    });

    // Wire up password toggles (table rows use data-pwd-target)
    bodyEl.querySelectorAll('[data-pwd-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            const el = document.getElementById(btn.dataset.pwdTarget);
            if (!el) return;
            const showing = el.dataset.show === 'true';
            el.dataset.show = showing ? 'false' : 'true';
            el.textContent = showing ? '••••••••' : el.dataset.pwd;
        });
    });
    // Legacy single-field toggle
    const pwdVal = bodyEl.querySelector('.proj-pwd-val');
    bodyEl.querySelector('.proj-pwd-toggle')?.addEventListener('click', () => {
        if (!pwdVal) return;
        const showing = pwdVal.dataset.show === 'true';
        pwdVal.dataset.show = showing ? 'false' : 'true';
        pwdVal.textContent = showing ? '••••••••' : pwdVal.dataset.pwd;
    });

    modal.classList.remove('hidden');
}


function initProjectModal() {
    document.getElementById('projModalClose')?.addEventListener('click', () => {
        document.getElementById('projectDetailModal')?.classList.add('hidden');
    });
    document.getElementById('projectDetailModal')?.addEventListener('click', function(e) {
        if (e.target === this) this.classList.add('hidden');
    });
}

// --- Main Render ---
function render(data) {
    renderEnvBadge(data.env);
    renderUptimeHero(data);
    renderQuickStats(data);
    renderHosts(data.hosts, 'hostsGridOverview');
    renderProjects(data.projects, 'projectsCompact', true);
    renderInfra(data.infrastructure, 'infraGridOverview');
    renderDomains(data.domains, 'domainsGridOverview', false);
    renderKuma(data.kuma, 'kumaGridOverview');
    renderServicesTable(data, 'servicesTableOverview');
    window._dashGpu = data.gpu; renderOllama(data.gpu, data.ollama);

    renderHosts(data.hosts, 'hostsGridFull');
    renderProjects(data.projects, 'projectsGridFull', false);
    renderServicesTable(data, 'servicesTable');
    renderDomains(data.domains, 'domainsGridFull', true);

    updateBanner(data);

    const dt = new Date(data.updated_at);
    document.getElementById('updatedAt').textContent = dt.toLocaleTimeString(state.lang === 'ru' ? 'ru-RU' : 'en-US');

    document.getElementById('pulse').className = 'pulse-dot live';
    document.getElementById('connectionText').textContent = t('connected');
    document.getElementById('loadingOverlay').classList.remove('visible');
    document.getElementById('errorOverlay').classList.remove('visible');

    buildSearchIndex(data);
}

// --- Routing ---
const VALID_TABS = ['overview', 'hosts', 'projects', 'services'];

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

// --- SSH Copy ---
function copySSH(host) {
    const cmd = `ssh dev@${host}`;
    navigator.clipboard.writeText(cmd).then(() => {
        showCopyToast(cmd);
    }).catch(() => {
        prompt('SSH команда:', cmd);
    });
}

function showCopyToast(text) {
    const toast = document.getElementById('copyToast');
    if (!toast) return;
    toast.textContent = `${t('copied')}: ${text}`;
    toast.classList.remove('toast-error');
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), COPY_TOAST_DURATION_MS);
}

// --- Action Toast (success/error variants for project controls) ---
const TOAST_ERROR_DISMISS_MS = 0; // 0 = stays until dismissed; success uses COPY_TOAST_DURATION_MS

function showActionToast(text, isError) {
    const toast = document.getElementById('copyToast');
    if (!toast) return;

    // Clear any pending auto-hide
    if (toast._hideTimer) { clearTimeout(toast._hideTimer); toast._hideTimer = null; }

    toast.textContent = text;
    if (isError) {
        toast.classList.add('toast-error');
        toast.style.pointerEvents = 'auto';
        toast.style.cursor = 'pointer';
        toast.onclick = () => {
            toast.classList.remove('visible');
            toast.classList.remove('toast-error');
            toast.style.pointerEvents = '';
            toast.style.cursor = '';
            toast.onclick = null;
        };
    } else {
        toast.classList.remove('toast-error');
        toast.style.pointerEvents = '';
        toast.style.cursor = '';
        toast.onclick = null;
        toast._hideTimer = setTimeout(() => {
            toast.classList.remove('visible');
        }, COPY_TOAST_DURATION_MS);
    }
    toast.classList.add('visible');
}

// --- Project Controls (Start / Stop / Restart) ---
async function projectControl(projectName, action) {
    const btn = document.querySelector(`[data-ctrl-action="${action}"][data-ctrl-project="${projectName}"]`);
    if (btn) { btn.disabled = true; btn.classList.add('ctrl-btn-loading'); }

    try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
        showActionToast(`${escapeHtml(projectName)}: ${action} \u2713`, false);
    } catch (e) {
        showActionToast(`${escapeHtml(projectName)}: ${action} \u2014 ${e.message}`, true);
    } finally {
        if (btn) { btn.disabled = false; btn.classList.remove('ctrl-btn-loading'); }
    }
}

// --- Logs Modal ---
function openLogsModal(projectName, services) {
    state.logsModal = { open: true, project: projectName, service: services && services.length ? services[0].name : null };

    const modal = document.getElementById('logsModal');
    if (!modal) return;

    document.getElementById('logsModalTitle').textContent = `${t('logs_title')} \u2014 ${projectName}`;

    // Build service selector options
    const select = document.getElementById('logsServiceSelect');
    select.innerHTML = '';
    if (services && services.length) {
        services.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.textContent = s.name;
            select.appendChild(opt);
        });
        select.style.display = '';
    } else {
        // No services listed — fall back to project name; selector hidden
        const opt = document.createElement('option');
        opt.value = projectName;
        opt.textContent = projectName;
        select.appendChild(opt);
        select.style.display = 'none';
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    refreshLogs();
}

function closeLogsModal() {
    state.logsModal.open = false;
    const modal = document.getElementById('logsModal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
}

async function refreshLogs() {
    const { project } = state.logsModal;
    if (!project) return;

    const select = document.getElementById('logsServiceSelect');
    const service = select ? select.value : project;
    state.logsModal.service = service;

    const content = document.getElementById('logsContent');
    if (!content) return;

    content.textContent = t('logs_loading');

    try {
        const res = await fetch(`/api/projects/${encodeURIComponent(project)}/logs?lines=100&service=${encodeURIComponent(service)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        const lines = data.lines || data.output || data.log || '';
        content.textContent = lines || t('logs_empty');
    } catch (e) {
        content.textContent = `Error: ${e.message}`;
    }

    // Auto-scroll to bottom
    const body = document.getElementById('logsBody');
    if (body) body.scrollTop = body.scrollHeight;
}

function initProjectControls() {
    // Event delegation on document body — works for dynamically rendered cards
    document.body.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-ctrl-action]');
        if (!btn) return;

        e.stopPropagation();

        const action = btn.dataset.ctrlAction;
        const project = btn.dataset.ctrlProject;
        if (!project) return;

        if (action === 'logs') {
            // Find current project data for service list
            const projectData = state.data && state.data.projects
                ? state.data.projects.find(p => p.name === project)
                : null;
            openLogsModal(project, projectData ? projectData.services : null);
            return;
        }

        if (action === 'stop') {
            if (!confirm(`${t('ctrl_confirm_stop')} ${project}?`)) return;
        }
        if (action === 'restart') {
            if (!confirm(`${t('ctrl_confirm_restart')} ${project}?`)) return;
        }

        await projectControl(project, action);
    });
}

function initLogsModal() {
    const modal = document.getElementById('logsModal');
    if (!modal) return;

    document.getElementById('logsCloseBtn')?.addEventListener('click', closeLogsModal);
    document.getElementById('logsRefreshBtn')?.addEventListener('click', refreshLogs);
    document.getElementById('logsServiceSelect')?.addEventListener('change', refreshLogs);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeLogsModal();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.logsModal.open) {
            e.preventDefault();
            closeLogsModal();
        }
    });
}

// --- Global Search ---
function buildSearchIndex(data) {
    state.searchIndex = [];
    (data.projects || []).forEach(p => {
        state.searchIndex.push({
            type: 'project',
            logo: getProjectLogo(p.name),
            icon: getIcon(p.icon),
            name: p.name,
            desc: p.description,
            sub: p.web_url ? p.web_url.replace('https://', '') : '',
            tab: 'projects',
            url: '',
            status: p.status,
        });
    });
    (data.domains || []).forEach(d => {
        state.searchIndex.push({
            type: 'domain',
            logo: null,
            icon: DOMAIN_EMOJI[d.name] || '🌐',
            name: d.fqdn,
            desc: d.description || '',
            sub: d.host || '',
            tab: 'domains',
            url: `https://${d.fqdn}`,
            status: d.reachable !== false ? 'ok' : 'down',
        });
    });
    (data.hosts || []).forEach(h => {
        state.searchIndex.push({
            type: 'host',
            logo: null,
            icon: '🖥️',
            name: h.name,
            desc: h.type,
            sub: h.host,
            tab: 'hosts',
            url: '',
            status: h.status,
        });
    });
    (data.infrastructure || []).forEach(i => {
        state.searchIndex.push({
            type: 'service',
            logo: null,
            icon: '⚙️',
            name: i.name,
            desc: i.service,
            sub: i.port ? ':' + i.port : '',
            tab: 'services',
            url: '',
            status: i.active ? 'ok' : 'inactive',
        });
    });
}

function doSearch(q) {
    const resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;
    state.searchFocusIdx = 0;

    if (!q.trim()) {
        resultsEl.innerHTML = `<div class="search-hint">${t('search_hint')}</div>`;
        return;
    }

    const ql = q.toLowerCase();
    const matches = state.searchIndex.filter(item =>
        item.name.toLowerCase().includes(ql) ||
        (item.desc || '').toLowerCase().includes(ql) ||
        (item.sub || '').toLowerCase().includes(ql)
    ).slice(0, 12);

    if (!matches.length) {
        resultsEl.innerHTML = `<div class="search-empty">${t('search_empty')}</div>`;
        return;
    }

    resultsEl.innerHTML = matches.map((item, i) => {
        const iconHtml = item.logo
            ? `<span class="si-logo">${item.logo}</span>`
            : `<span class="si-emoji">${item.icon}</span>`;
        return `
        <div class="search-item ${i === 0 ? 'focused' : ''}" data-idx="${i}" data-tab="${escapeHtml(item.tab)}" data-url="${escapeHtml(item.url || '')}">
            ${iconHtml}
            <div class="si-info">
                <div class="si-name">${highlightMatch(item.name, ql)}</div>
                ${item.desc ? `<div class="si-desc">${escapeHtml(item.desc)}</div>` : ''}
            </div>
            <div class="si-right">
                <span class="si-type-badge">${escapeHtml(item.type)}</span>
                ${item.sub ? `<span class="si-sub">${escapeHtml(item.sub)}</span>` : ''}
            </div>
        </div>`;
    }).join('');

    resultsEl.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => activateSearchItem(item));
        item.addEventListener('mouseenter', () => {
            resultsEl.querySelectorAll('.search-item').forEach(x => x.classList.remove('focused'));
            item.classList.add('focused');
            state.searchFocusIdx = parseInt(item.dataset.idx);
        });
    });
}

function highlightMatch(text, q) {
    if (!q) return escapeHtml(text);
    const idx = text.toLowerCase().indexOf(q);
    if (idx < 0) return escapeHtml(text);
    return escapeHtml(text.slice(0, idx)) +
        '<mark>' + escapeHtml(text.slice(idx, idx + q.length)) + '</mark>' +
        escapeHtml(text.slice(idx + q.length));
}

function activateSearchItem(node) {
    if (node.dataset.url) {
        window.open(node.dataset.url, '_blank');
    } else if (node.dataset.tab) {
        switchTab(node.dataset.tab);
    }
    closeSearch();
}

function navigateSearch(dir) {
    const items = document.querySelectorAll('#searchResults .search-item');
    if (!items.length) return;
    items[state.searchFocusIdx]?.classList.remove('focused');
    state.searchFocusIdx = (state.searchFocusIdx + dir + items.length) % items.length;
    const focused = items[state.searchFocusIdx];
    focused?.classList.add('focused');
    focused?.scrollIntoView({ block: 'nearest' });
}

function openSearch() {
    state.searchOpen = true;
    document.getElementById('searchOverlay').classList.add('visible');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        const input = document.getElementById('searchInput');
        if (input) { input.value = ''; input.focus(); }
        doSearch('');
    }, 50);
}

function closeSearch() {
    state.searchOpen = false;
    document.getElementById('searchOverlay').classList.remove('visible');
    document.body.style.overflow = '';
}

function initSearch() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.addEventListener('input', (e) => doSearch(e.target.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); navigateSearch(1); }
            if (e.key === 'ArrowUp') { e.preventDefault(); navigateSearch(-1); }
            if (e.key === 'Enter') {
                const focused = document.querySelector('#searchResults .search-item.focused');
                if (focused) activateSearchItem(focused);
            }
        });
    }

    const backdrop = document.getElementById('searchBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeSearch);

    const btn = document.getElementById('searchBtn');
    if (btn) btn.addEventListener('click', openSearch);

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Cmd/Ctrl+K → toggle search
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            state.searchOpen ? closeSearch() : openSearch();
            return;
        }
        // Escape → close search if open
        if (e.key === 'Escape' && state.searchOpen) {
            e.preventDefault();
            closeSearch();
            return;
        }
        // 1-5 tab shortcuts when not typing in input
        const active = document.activeElement;
        const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (!typing && !state.searchOpen && !e.metaKey && !e.ctrlKey && !e.altKey) {
            const tabKeys = { '1': 'overview', '2': 'hosts', '3': 'projects', '4': 'services', '5': 'domains' };
            if (tabKeys[e.key]) {
                e.preventDefault();
                switchTab(tabKeys[e.key]);
            }
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
        if (btn.dataset.lang === state.lang) btn.classList.add('active');
        else btn.classList.remove('active');

        btn.addEventListener('click', () => {
            state.lang = btn.dataset.lang;
            localStorage.setItem('lang', state.lang);
            document.querySelectorAll('#langToggle .toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyI18n();
            if (state.data) render(state.data);
        });
    });
}

// --- Visibility (pause when hidden) ---
function initVisibility() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            state.isPaused = true;
            document.getElementById('pauseOverlay').classList.add('visible');
        } else {
            state.isPaused = false;
            document.getElementById('pauseOverlay').classList.remove('visible');
        }
    });
}

// --- SSE ---
function connect() {
    const evtSource = new EventSource('/sse');

    evtSource.onopen = () => {
        state.reconnectAttempts = 0;
        document.getElementById('errorOverlay').classList.remove('visible');
    };

    evtSource.onmessage = (event) => {
        if (state.isPaused) return;
        try {
            const data = JSON.parse(event.data);
            state.data = data;
            render(data);
        } catch (e) {
            console.error('Parse error:', e);
        }
    };

    evtSource.onerror = (e) => {
        console.warn('SSE connection lost, reconnecting...', e);
        evtSource.close();
        document.getElementById('pulse').className = 'pulse-dot error';
        document.getElementById('connectionText').textContent = t('reconnecting');
        document.getElementById('loadingOverlay').classList.remove('visible');

        state.reconnectAttempts++;
        const delay = Math.min(SSE_RECONNECT_BASE_DELAY_MS * state.reconnectAttempts, SSE_RECONNECT_MAX_DELAY_MS);

        if (state.reconnectAttempts > SSE_ERROR_OVERLAY_THRESHOLD) {
            document.getElementById('errorOverlay').classList.add('visible');
        }

        setTimeout(connect, delay);
    };
}

// --- Widget Drag & Drop ---
function initWidgets() {
    const grid = document.getElementById('widgetGrid');
    if (!grid) return;

    restoreLayout();

    const editBtn = document.getElementById('editToggle');
    editBtn.addEventListener('click', () => {
        state.editMode = !state.editMode;
        document.body.classList.toggle('edit-mode', state.editMode);
        editBtn.classList.toggle('active', state.editMode);
        grid.querySelectorAll('.widget').forEach(w => { w.draggable = state.editMode; });
    });

    grid.querySelectorAll('.widget-resize').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const widget = e.target.closest('.widget');
            const current = widget.dataset.size;
            widget.dataset.size = current === '1' ? '2' : '1';
            saveLayout();
        });
    });

    grid.addEventListener('dragstart', (e) => {
        if (!state.editMode) return;
        state.draggedWidget = e.target.closest('.widget');
        if (!state.draggedWidget) return;
        state.draggedWidget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    grid.addEventListener('dragend', () => {
        if (state.draggedWidget) { state.draggedWidget.classList.remove('dragging'); state.draggedWidget = null; }
        grid.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
    });

    grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!state.editMode || !state.draggedWidget) return;
        const target = e.target.closest('.widget');
        if (!target || target === state.draggedWidget) return;
        grid.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
        target.classList.add('drag-over');
    });

    grid.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!state.editMode || !state.draggedWidget) return;
        const target = e.target.closest('.widget');
        if (!target || target === state.draggedWidget) return;
        target.classList.remove('drag-over');
        const widgets = [...grid.querySelectorAll('.widget')];
        const fromIdx = widgets.indexOf(state.draggedWidget);
        const toIdx = widgets.indexOf(target);
        if (fromIdx < toIdx) target.after(state.draggedWidget);
        else target.before(state.draggedWidget);
        saveLayout();
    });
}

function saveLayout() {
    const grid = document.getElementById('widgetGrid');
    if (!grid) return;
    const layout = [...grid.querySelectorAll('.widget')].map(w => ({ id: w.dataset.widget, size: w.dataset.size }));
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
        grid.querySelectorAll('.widget').forEach(w => { widgetMap[w.dataset.widget] = w; });
        layout.forEach(item => {
            const widget = widgetMap[item.id];
            if (widget) { widget.dataset.size = item.size; grid.appendChild(widget); }
        });
    } catch(e) {
        console.error('Layout restore error:', e);
    }
}

// --- SSH Copy Buttons (event delegation, avoids inline onclick) ---
function initSshCopyButtons() {
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ssh-host]');
        if (btn) copySSH(btn.dataset.sshHost);
    });
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
    initDomainsFilter();
    initDomainModal();
    initKeysBtn();
    initProjectModal();
    initSearch();
    initReloadConfig();
    initChat();
    initSshCopyButtons();
    initProjectControls();
    initLogsModal();
    applyI18n();
    connect();
});

// --- AI Chat ---
function initChat() {
    const fab = document.getElementById('chatFab');
    const panel = document.getElementById('chatPanel');
    const closeBtn = document.getElementById('chatClose');
    const input = document.getElementById('chatInput');
    const send = document.getElementById('chatSend');
    const messages = document.getElementById('chatMessages');
    if (!fab || !panel) return;

    fab.addEventListener('click', () => {
        const open = panel.classList.toggle('open');
        if (open) input?.focus();
    });
    closeBtn?.addEventListener('click', () => panel.classList.remove('open'));

    async function sendMessage() {
        const text = input.value.trim();
        if (!text || send.disabled) return;
        input.value = '';

        const userEl = document.createElement('div');
        userEl.className = 'chat-msg user';
        userEl.textContent = text;
        messages.appendChild(userEl);

        const aiEl = document.createElement('div');
        aiEl.className = 'chat-msg assistant streaming';
        aiEl.textContent = '...';
        messages.appendChild(aiEl);
        messages.scrollTop = messages.scrollHeight;

        send.disabled = true;
        input.disabled = true;

        try {
            const resp = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text }),
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);

            aiEl.textContent = '';
            aiEl.classList.remove('streaming');

            const reader = resp.body.getReader();
            const dec = new TextDecoder();
            let buf = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const parts = buf.split('\n\n');
                buf = parts.pop() || '';
                for (const part of parts) {
                    if (!part.startsWith('data: ')) continue;
                    const payload = part.slice(6);
                    if (payload === '[DONE]') break;
                    try {
                        aiEl.textContent += JSON.parse(payload);
                        messages.scrollTop = messages.scrollHeight;
                    } catch {}
                }
            }
        } catch (e) {
            aiEl.textContent = 'Ошибка: ' + e.message;
            aiEl.classList.add('error');
        } finally {
            send.disabled = false;
            input.disabled = false;
            input.focus();
            messages.scrollTop = messages.scrollHeight;
        }
    }

    send?.addEventListener('click', sendMessage);
    input?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
}

function initReloadConfig() {
    const btn = document.getElementById('reloadConfigBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.classList.add('spinning');
        try {
            const res = await fetch('/api/reload', { method: 'POST' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            showCopyToast('config.yaml перезагружен ✓');
        } catch (e) {
            showCopyToast('Ошибка: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.classList.remove('spinning');
        }
    });
}
