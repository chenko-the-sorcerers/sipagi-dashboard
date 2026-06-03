import { AppShell } from './shared/components/AppShell.js?v=nutrition-suite-20260513';
import { productModules } from './shared/data/productCatalog.js?v=settings-sidebar-20260511';
import { getRoleLabel, getVisibleModulesForRole, roleCanAccess, setActiveRoleId, toDashboardRoleId } from './shared/auth/permissionStore.js?v=settings-sidebar-20260511';
import { getCachedSessionUser, getCurrentSession, isSessionIdleExpired, logout, markSessionActivity } from './shared/auth/sessionClient.js';
import { LoginPage, bindLoginPage } from './modules/auth/pages/LoginPage.js';
import { installClientSecurityGuards } from './shared/security/securityClient.js';
import { decodeRoute, encodeRoute, setSecureHash } from './shared/router/secureRoutes.js';
import { ProductDashboardPage, initProductDashboardPage } from './modules/dashboard/pages/ProductDashboardPage.js';
import { RoleDashboardPage, initRoleDashboardPage } from './modules/dashboard/pages/RoleDashboardPage.js?v=dashboard-tabs-20260511';
import { SettingsPage, initSettingsPage } from './modules/settings/pages/SettingsPage.js?v=settings-sidebar-20260511';
import { InventoryPage, initInventoryPage } from './modules/inventory/pages/InventoryPage.js?v=inventory-polish-20260512';
import { FinancePage, initFinancePage } from './modules/finance/pages/FinancePage.js';
import { HrPage, initHrPage } from './modules/hr/pages/HrPage.js';
import { OperationalPage, initOperationalPage } from './modules/operational/pages/OperationalPage.js';
import { DistributionPage, initDistributionPage } from './modules/distribution/pages/DistributionPage.js';
import { SchoolPage, initSchoolPage } from './modules/school/pages/SchoolPage.js';
import { BgnPage, initBgnPage } from './modules/bgn/pages/BgnPage.js';
import { SupplierPage, initSupplierPage } from './modules/supplier/pages/SupplierPage.js';
import { AiPage, initAiPage } from './modules/ai/pages/AiPage.js';
import { NutritionistPage, initNutritionistPage } from './modules/nutritionist/pages/NutritionistPage.js?v=nutrition-suite-20260513';
import { ReportsPage, initReportsPage } from './modules/reports/pages/ReportsPage.js';
import { MbgPage, initMbgPage } from './modules/mbg/pages/MbgPage.js';

const app = document.getElementById('app');
const sidebarCollapseStorageKey = 'sipagi.sidebar.collapsed';
let sessionUser = getCachedSessionUser();
let authChecked = false;

function getSidebarCollapsedPreference() {
    try {
        return localStorage.getItem(sidebarCollapseStorageKey) === 'true';
    } catch {
        return false;
    }
}

function setSidebarCollapsedPreference(collapsed) {
    try {
        localStorage.setItem(sidebarCollapseStorageKey, collapsed ? 'true' : 'false');
    } catch {
        // Keep the UI state working even when storage is unavailable.
    }
}

function applySidebarCollapsedState(collapsed) {
    document.body.classList.toggle('kt-sidebar-collapse', collapsed);
    const toggle = document.getElementById('sidebar_toggle');
    if (!toggle) return;

    toggle.classList.toggle('active', collapsed);
    toggle.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    toggle.querySelector('i')?.classList.toggle('rotate-180', collapsed);
}

function getSessionRoleId() {
    return sessionUser?.roleId || sessionUser?.role?.id || 'kepala_sppg';
}

function findModuleByQuery(query, activeRoleId = getSessionRoleId()) {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;

    return getVisibleModulesForRole(activeRoleId).find((module) => {
        const haystack = [
            module.id,
            module.label,
            module.group,
            module.owner,
            module.description,
            ...module.features,
            ...module.tables
        ].join(' ').toLowerCase();

        return haystack.includes(needle);
    });
}

function closeShellPanels() {
    document.querySelectorAll('[data-shell-panel]').forEach((panel) => {
        panel.classList.add('hidden');
    });
}

function initializeMetronicShell() {
    requestAnimationFrame(() => {
        window.KTComponents?.init?.();
        window.KTScrollable?.init?.();
        window.KTSticky?.init?.();
        window.KTDrawer?.init?.();
        window.KTToggle?.init?.();
        (window.KTLayout || window.default)?.init?.();
    });
}

function bindShellInteractions() {
    document.addEventListener('click', (event) => {
        const accordionToggle = event.target.closest('[data-sidebar-accordion]');
        if (!accordionToggle) return;

        event.preventDefault();
        event.stopPropagation();

        const menuItem = accordionToggle.closest('.kt-menu-item');
        const isOpen = menuItem?.classList.toggle('show') || false;
        accordionToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.target.id !== 'global-search' || event.key !== 'Enter') return;

        const module = findModuleByQuery(event.target.value);
        if (!module) return;

        setSecureHash(module.id);
        event.target.value = '';
        closeShellPanels();
    });

    document.addEventListener('click', (event) => {
        const sidebarToggle = event.target.closest('[data-action="toggle-sidebar-collapse"]');
        if (sidebarToggle) {
            const collapsed = !document.body.classList.contains('kt-sidebar-collapse');
            applySidebarCollapsedState(collapsed);
            setSidebarCollapsedPreference(collapsed);
            closeShellPanels();
            return;
        }

        const shellAction = event.target.closest('[data-action="sync-current-module"], [data-action="toggle-shell-panel"]');
        if (!shellAction) {
            if (!event.target.closest('.sipagi-shell-popover')) closeShellPanels();
            return;
        }

        if (shellAction.dataset.action === 'sync-current-module') {
            const route = decodeRoute(window.location.hash.replace('#', '') || 'dashboard');
            const refreshButton = document.querySelector(`[data-action="refresh-${route}"]`);
            if (refreshButton) {
                refreshButton.click();
            } else {
                render();
            }
            closeShellPanels();
            return;
        }

        const panelName = shellAction.dataset.panel;
        const panel = document.querySelector(`[data-shell-panel="${panelName}"]`);
        const willOpen = panel?.classList.contains('hidden');
        closeShellPanels();
        if (panel && willOpen) panel.classList.remove('hidden');
    });
}

function modulePlaceholder(module) {
    const features = module.features.map((feature) => `<li>${feature}</li>`).join('');
    const tables = module.tables.map((table) => `<span class="product-chip">${table}</span>`).join('');

    return `
        <div class="erp-card">
            <div class="product-module-head">
                <div>
                    <div class="erp-stat-label">${module.group}</div>
                    <h3>${module.label}</h3>
                </div>
                <span class="erp-status warning">${module.status}</span>
            </div>
            <p class="erp-muted">${module.description}</p>
            <h3 style="margin-top: 1.25rem;">Fitur Direncanakan</h3>
            <ul class="product-feature-list">${features}</ul>
            <h3 style="margin-top: 1.25rem;">Sheet Database</h3>
            <div class="product-chip-list">${tables}</div>
        </div>
    `;
}

function accessDeniedPage(module, activeRoleId) {
    return `
        <div class="kt-card kt-card-border shadow-none">
            <div class="kt-card-content grid gap-4 p-6">
                <div class="flex items-start gap-3">
                    <span class="kt-badge kt-badge-destructive kt-badge-circle size-10">
                        <i class="ki-filled ki-lock text-lg"></i>
                    </span>
                    <div class="grid gap-1">
                        <h3 class="text-lg font-semibold text-mono">Halaman ditutup untuk role ini</h3>
                        <p class="text-sm text-secondary-foreground">
                            Role <strong>${getRoleLabel(activeRoleId)}</strong> belum memiliki akses baca untuk halaman <strong>${module.label}</strong>.
                            Kepala SPPG dapat membuka akses dari Dashboard > Kontrol Akses Role.
                        </p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    <a class="kt-btn kt-btn-primary kt-btn-sm" href="#${encodeRoute('dashboard')}">Kembali ke Dashboard</a>
                    <a class="kt-btn kt-btn-outline kt-btn-sm" href="#${encodeRoute('dashboard')}">Atur Permission</a>
                </div>
            </div>
        </div>
    `;
}

function render() {
    if (!authChecked) {
        app.innerHTML = '<div class="sipagi-auth-loading"><span class="sipagi-dot-loader"><i></i><i></i><i></i></span><p>Memeriksa sesi aman...</p></div>';
        return;
    }

    if (!sessionUser) {
        app.innerHTML = LoginPage();
        bindLoginPage((user) => {
            sessionUser = user;
            setSecureHash('dashboard');
            render();
        });
        return;
    }

    const sidebarCollapsed = getSidebarCollapsedPreference();
    applySidebarCollapsedState(sidebarCollapsed);
    const activeRoleId = getSessionRoleId();
    setActiveRoleId(toDashboardRoleId(activeRoleId));
    const rawRoute = decodeRoute(window.location.hash.replace('#', '') || 'dashboard');
    const [route, subRoute = ''] = rawRoute.split('/');
    if (route === 'mbg') {
        setSecureHash(`dashboard/${subRoute || 'mbg'}`);
        return;
    }
    if (route === 'purchasing') {
        setSecureHash('inventory');
        return;
    }
    const module = productModules.find((entry) => entry.id === route) || productModules[0];
    const isDashboard = module.id === 'dashboard';
    const isSettings = module.id === 'settings';
    const isDevDashboard = module.id === 'dev-dashboard';
    const isInventory = module.id === 'inventory';
    const isFinance = module.id === 'finance';
    const isHr = module.id === 'hr';
    const isOperational = module.id === 'operational';
    const isDistribution = module.id === 'distribution';
    const isSchool = module.id === 'school';
    const isBgn = module.id === 'bgn';
    const isSupplier = module.id === 'supplier';
    const isAi = module.id === 'ai';
    const isNutritionist = module.id === 'nutritionist';
    const isReports = module.id === 'reports';
    const canAccessRoute = roleCanAccess(activeRoleId, module.id);
    const content = !canAccessRoute
        ? accessDeniedPage(module, activeRoleId)
        : isDashboard && ['mbg', 'lpj', 'finance', 'compliance', 'reports'].includes(subRoute) && activeRoleId === 'kepala_sppg'
        ? MbgPage()
        : isDashboard
        ? RoleDashboardPage(toDashboardRoleId(activeRoleId))
        : isSettings
            ? SettingsPage()
        : isDevDashboard
            ? ProductDashboardPage()
        : isInventory
            ? InventoryPage()
                : isFinance
                    ? FinancePage()
                    : isHr
                        ? HrPage()
                        : isOperational
                            ? OperationalPage()
                            : isDistribution
                                ? DistributionPage()
                                : isSchool
                                ? SchoolPage()
                                : isBgn
                                    ? BgnPage()
                                    : isSupplier
                                        ? SupplierPage()
                                        : isAi
                                            ? AiPage()
                                            : isNutritionist
                                                ? NutritionistPage()
                                                : isReports
                                                    ? ReportsPage()
                                                    : modulePlaceholder(module);
    const actions = '';

    app.innerHTML = AppShell({
        activeModule: module.id,
        activeSubModule: isDashboard ? subRoute || 'overview' : isSettings ? subRoute || 'overview' : isInventory ? subRoute || 'overview' : isFinance ? subRoute || 'overview' : isHr ? subRoute || 'overview' : isOperational ? subRoute || 'overview' : isDistribution ? subRoute || 'overview' : isSchool ? subRoute || 'overview' : isSupplier ? subRoute || 'overview' : isReports ? subRoute || 'overview' : isBgn ? subRoute || 'overview' : isAi ? subRoute || 'runs' : isNutritionist ? subRoute || 'overview' : '',
        title: module.label,
        subtitle: module.description,
        content,
        actions,
        sidebarCollapsed,
        activeRoleId,
        sppgName: sessionUser?.sppgName || sessionUser?.sppgCode || 'SPPG Nakala'
    });

    if (canAccessRoute && isDashboard && ['mbg', 'lpj', 'finance', 'compliance', 'reports'].includes(subRoute) && activeRoleId === 'kepala_sppg') initMbgPage();
    else if (canAccessRoute && isDashboard) initRoleDashboardPage(toDashboardRoleId(activeRoleId));
    if (canAccessRoute && isSettings) initSettingsPage(subRoute || 'overview');
    if (canAccessRoute && isDevDashboard) initProductDashboardPage();
    if (canAccessRoute && isInventory) initInventoryPage(subRoute || 'overview');
    if (canAccessRoute && isFinance) initFinancePage(subRoute || 'overview');
    if (canAccessRoute && isHr) initHrPage(subRoute || 'overview');
    if (canAccessRoute && isOperational) initOperationalPage(subRoute || 'overview');
    if (canAccessRoute && isDistribution) initDistributionPage(subRoute || 'overview');
    if (canAccessRoute && isSchool) initSchoolPage(subRoute || 'overview');
    if (canAccessRoute && isBgn) initBgnPage(subRoute || 'overview');
    if (canAccessRoute && isSupplier) initSupplierPage(subRoute || 'overview');
    if (canAccessRoute && isAi) initAiPage(subRoute || 'runs');
    if (canAccessRoute && isNutritionist) initNutritionistPage(subRoute || 'overview');
    if (canAccessRoute && isReports) initReportsPage(subRoute || 'overview');

    initializeMetronicShell();
}

bindShellInteractions();
window.addEventListener('hashchange', render);

function bindSessionActivityTracking() {
    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    activityEvents.forEach((eventName) => {
        document.addEventListener(eventName, () => {
            if (!sessionUser) return;
            markSessionActivity({ sync: true });
        }, { passive: true });
    });

    window.setInterval(() => {
        if (!sessionUser || !isSessionIdleExpired()) return;
        sessionUser = null;
        logout();
        render();
    }, 60 * 1000);
}

async function bootstrap() {
    installClientSecurityGuards();
    try {
        const payload = await getCurrentSession();
        sessionUser = payload.authenticated ? payload.user : null;
    } catch {
        sessionUser = null;
    } finally {
        authChecked = true;
        render();
    }
}

function startApp() {
    bootstrap().catch((error) => {
        authChecked = true;
        sessionUser = null;
        app.innerHTML = `
            <div class="sipagi-auth-loading">
                <span class="sipagi-dot-loader"><i></i><i></i><i></i></span>
                <p>SIPAGI sedang menyiapkan sesi. Muat ulang halaman jika tampilan belum terbuka.</p>
                <small style="color:#64748b;">${error?.message || 'Bootstrap gagal dijalankan.'}</small>
            </div>
        `;
    });
}

document.addEventListener('click', async (event) => {
    const logoutButton = event.target.closest('[data-action="logout"]');
    if (!logoutButton) return;
    event.preventDefault();
    sessionUser = null;
    logout();
    render();
});

bindSessionActivityTracking();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp, { once: true });
} else {
    startApp();
}
