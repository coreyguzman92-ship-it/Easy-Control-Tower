// ==UserScript==
// @name         Easy Control Tower
// @version      2.1.0
// @description  Station controls and scheduled enables/disables for Control Tower
// @author       dbann@
// @match        https://beta.control-tower.meta.amazon.dev/*
// @updateURL    https://tamarin.aces.amazon.dev/scripts/easy-control-tower/install.user.js
// @downloadURL  https://tamarin.aces.amazon.dev/scripts/easy-control-tower/install.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ── State ────────────────────────────────────────────────────────────────────
    let isProcessing  = false;
    let scheduleQueue = [];
    let queueRunning  = false;
    const SCHED_KEY   = 'ect_schedules_v1';

    // ── Styles ───────────────────────────────────────────────────────────────────
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
    .ect-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 32px; height: 32px; margin-left: 10px;
        border: none; border-radius: 4px;
        background: rgb(6,117,134); color: #fff;
        font-size: 18px; cursor: pointer; vertical-align: middle; flex-shrink: 0;
    }
    .ect-btn:hover { background: rgb(5,100,114); }
    .ect-menu {
        position: fixed; background: #fff; border-radius: 4px;
        box-shadow: 0 0 16px rgba(0,0,0,.2); z-index: 9999;
        min-width: 230px; overflow: hidden;
    }
    .ect-item {
        display: block; width: 100%; padding: 12px 16px;
        border: none; background: none; text-align: left;
        font-family: "Amazon Ember", Arial, sans-serif;
        font-size: 14px; font-weight: bold; color: rgb(2,8,14);
        cursor: pointer; box-sizing: border-box;
    }
    .ect-item:hover { background: #f2f3f3; }
    .ect-divider { height: 1px; background: #e0e0e0; margin: 4px 0; }
    .ect-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 10100;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .ect-spinner {
        width: 50px; height: 50px;
        border: 5px solid rgba(6,117,134,.3); border-radius: 50%;
        border-top-color: rgb(6,117,134);
        animation: ect-spin 1s linear infinite; margin-bottom: 20px;
    }
    .ect-status {
        color: #fff; font-size: 14px; font-family: "Amazon Ember", Arial, sans-serif;
        text-align: center; max-width: 420px; line-height: 1.5;
    }
    .ect-banner {
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: rgb(6,117,134); color: #fff;
        padding: 12px 24px; border-radius: 4px; z-index: 10200;
        text-align: center; animation: ect-fade 4s forwards; white-space: nowrap;
    }
    .ect-banner div { color: #fff; }
    .ect-toolbar { position: fixed; top: 12px; right: 16px; z-index: 9990; }
    .ect-tb-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 14px; border: none; border-radius: 6px;
        font-family: "Amazon Ember", Arial, sans-serif;
        font-size: 13px; font-weight: bold; cursor: pointer;
        white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,.25);
        transition: background .15s;
    }
    .ect-tb-btn.ect-sched { background: rgb(6,117,134); color: #fff; }
    .ect-tb-btn.ect-sched:hover { background: rgb(5,100,114); }
    .ect-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,.5);
        z-index: 10050; display: flex; align-items: center; justify-content: center;
    }
    .ect-modal {
        background: #fff; border-radius: 8px;
        width: 620px; max-width: 95vw; max-height: 84vh;
        display: flex; flex-direction: column;
        box-shadow: 0 8px 32px rgba(0,0,0,.3);
    }
    .ect-modal-hdr {
        padding: 16px 20px; border-bottom: 1px solid #e0e0e0;
        display: flex; align-items: center; justify-content: space-between;
        flex-shrink: 0;
    }
    .ect-modal-hdr h2 {
        margin: 0; font-size: 16px;
        font-family: "Amazon Ember", Arial, sans-serif; color: rgb(2,8,14);
    }
    .ect-modal-close {
        background: none; border: none; font-size: 24px;
        cursor: pointer; color: #999; line-height: 1; padding: 0;
    }
    .ect-modal-close:hover { color: rgb(2,8,14); }
    .ect-modal-body { overflow-y: auto; flex: 1; padding: 0 20px; }
    .ect-modal-footer {
        padding: 16px 20px; border-top: 1px solid #e0e0e0;
        display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;
    }
    .ect-form-row {
        display: flex; gap: 10px; align-items: flex-end;
        padding: 14px 0; border-bottom: 1px solid #f2f3f3; flex-wrap: wrap;
    }
    .ect-form-row label {
        display: flex; flex-direction: column; gap: 4px;
        font-family: "Amazon Ember", Arial, sans-serif;
        font-size: 12px; font-weight: bold; color: #666;
    }
    .ect-form-row input, .ect-form-row select {
        padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px;
        font-family: "Amazon Ember", Arial, sans-serif; font-size: 13px;
        background: #fff; box-sizing: border-box;
    }
    .ect-sched-row {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 0; border-bottom: 1px solid #f2f3f3; flex-wrap: wrap;
    }
    .ect-sched-label {
        font-family: "Amazon Ember", Arial, sans-serif;
        font-size: 13px; font-weight: bold; color: rgb(2,8,14);
        flex: 1; min-width: 180px;
    }
    .ect-sched-meta {
        font-family: "Amazon Ember", Arial, sans-serif;
        font-size: 12px; color: #666;
    }
    .ect-sched-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .ect-btn-sm {
        padding: 5px 10px; border: none; border-radius: 4px;
        font-family: "Amazon Ember", Arial, sans-serif;
        font-size: 12px; font-weight: bold; cursor: pointer;
    }
    .ect-btn-sm.primary { background: rgb(6,117,134); color: #fff; }
    .ect-btn-sm.primary:hover { background: rgb(5,100,114); }
    .ect-btn-sm.danger  { background: #c0392b; color: #fff; }
    .ect-btn-sm.danger:hover  { background: #a93226; }
    .ect-btn-sm.muted   { background: #e0e0e0; color: #333; }
    .ect-btn-sm.muted:hover   { background: #ccc; }
    .ect-empty {
        padding: 30px 0; text-align: center; color: #999;
        font-family: "Amazon Ember", Arial, sans-serif; font-size: 13px;
    }
    @keyframes ect-spin { to { transform: rotate(360deg); } }
    @keyframes ect-fade {
        0%   { opacity: 0; }
        10%  { opacity: 1; }
        80%  { opacity: 1; }
        100% { opacity: 0; }
    }`;
    document.head.appendChild(styleSheet);

    // ── Helpers ──────────────────────────────────────────────────────────────────
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function groupCleanName(raw) {
        return raw.replace(/^(Priority\s*\d+\s*[-–—]?\s*)/i, '')
                  .replace(/[^\w\s]/g, '').trim();
    }
    function normalizeForMatch(s) {
        return s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    }

    // FIX: match X-Y pattern first (take second number) to handle "Station 1-02" correctly
    function getStationNumber(row) {
        const text = (
            row.querySelector('td:first-child span') ||
            row.querySelector('td:first-child')
        )?.textContent.trim() || '';

        // "1-02", "1 - 02" → station number is the part after the dash
        const dashMatch = text.match(/\d+\s*[-–]\s*(\d+)/);
        if (dashMatch) return parseInt(dashMatch[1], 10);

        // Trailing number
        const trailing = text.match(/(\d+)\s*$/);
        if (trailing) return parseInt(trailing[1], 10);

        // First number found
        const any = text.match(/(\d+)/);
        return any ? parseInt(any[0], 10) : null;
    }

    function getStationLabel(row) {
        return row.querySelector('td:first-child')?.textContent.trim() || '';
    }

    // ── Tooltip primitives ───────────────────────────────────────────────────────
    function getAllTooltips() {
        return Array.from(document.querySelectorAll('div[role="tooltip"]'));
    }

    async function waitForTooltipCountUp(countBefore, timeout = 2500) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (getAllTooltips().length > countBefore) return true;
            await sleep(80);
        }
        return false;
    }

    async function closeAllTooltips() {
        let attempts = 0;
        while (attempts < 10) {
            const tips = getAllTooltips();
            if (tips.length === 0) return;
            attempts++;
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape', bubbles: true, cancelable: true
            }));
            await sleep(150);
            for (const t of getAllTooltips()) {
                const cancel = Array.from(t.querySelectorAll('button'))
                    .find(b => /^cancel$/i.test(b.textContent.trim()));
                if (cancel) { cancel.click(); await sleep(100); }
            }
            await sleep(200);
        }
    }

    // ── Core station action ──────────────────────────────────────────────────────
    // FIX: enable branch now correctly finds and clicks the Enable button
    async function handleStation(link, operation) {
        await closeAllTooltips();
        await sleep(150);

        const countBefore = getAllTooltips().length;
        link.click();

        const appeared = await waitForTooltipCountUp(countBefore, 2500);
        if (!appeared) return false;

        const tips = getAllTooltips();
        const tip  = tips[tips.length - 1];
        const isAssignmentModal = !!tip.querySelector('input[placeholder*="Search for login"]');

        if (operation === 'disable') {
            if (!isAssignmentModal) {
                // Already disabled — close and skip
                await closeAllTooltips();
                return false;
            }
            const disBtn = Array.from(tip.querySelectorAll('button'))
                .find(b => /^disable$/i.test(b.textContent.trim()));
            if (!disBtn) { await closeAllTooltips(); return false; }

            disBtn.click();
            // FIX: CT does not show a second confirmation — just wait briefly then clean up
            await sleep(400);
            await closeAllTooltips();
            return true;
        }

        if (operation === 'enable') {
            if (isAssignmentModal) {
                // Already enabled — close and skip
                await closeAllTooltips();
                return false;
            }
            // FIX: station is disabled — find and click Enable button
            const enableBtn = Array.from(tip.querySelectorAll('button'))
                .find(b => /\benable\b/i.test(b.textContent.trim()) && !/\b(disable|cancel)\b/i.test(b.textContent.trim()));
            if (!enableBtn) { await closeAllTooltips(); return false; }

            enableBtn.click();
            // CT first removes the disabled tooltip, then shows the assignment modal.
            // Wait briefly for the disabled tooltip to close, then wait for the assignment modal.
            await sleep(200);
            const countAfterEnable = getAllTooltips().length;
            await waitForTooltipCountUp(countAfterEnable, 2000); // wait for assignment modal
            await closeAllTooltips(); // cancel assignment modal → station becomes enabled
            return true;
        }

        await closeAllTooltips();
        return false;
    }

    // ── Overlay helpers ──────────────────────────────────────────────────────────
    function showOverlay(msg) {
        removeOverlay();
        const el = document.createElement('div');
        el.className = 'ect-overlay';
        el.id = 'ect-overlay';
        el.innerHTML = `<div class="ect-spinner"></div><div class="ect-status">${msg}</div>`;
        document.body.appendChild(el);
        return el;
    }
    function updateOverlay(msg) {
        const el = document.getElementById('ect-overlay');
        if (el) el.querySelector('.ect-status').innerHTML = msg;
    }
    function removeOverlay() { document.getElementById('ect-overlay')?.remove(); }
    function showBanner(html) {
        const b = document.createElement('div');
        b.className = 'ect-banner';
        b.innerHTML = html;
        document.body.appendChild(b);
        setTimeout(() => b.remove(), 4500);
    }

    // ── Station / group discovery ────────────────────────────────────────────────
    // FIX: walk up from each h5 to find the TIGHTEST ancestor div containing tbody tr
    // (prevents section-wrapper divs from being captured as the group div)
    function getGroupDivs() {
        const results = [];
        document.querySelectorAll('h5').forEach(h5 => {
            let el = h5.parentElement;
            while (el && el !== document.body) {
                if (el.tagName === 'DIV' && el.querySelector('table tbody tr')) {
                    results.push(el);
                    break;
                }
                el = el.parentElement;
            }
        });
        return [...new Set(results)];
    }

    function getStationRows(groupDiv) {
        return Array.from(groupDiv.querySelectorAll('table tbody tr'));
    }

    function getStationLink(row) {
        return row.querySelector('a.css-1jtrum4') || row.querySelector('a');
    }

    function isLaneGroup(groupDiv) {
        return getStationRows(groupDiv).some(r => getStationNumber(r) !== null);
    }

    // ── Target filter ────────────────────────────────────────────────────────────
    function buildQualifyFn(target, rows, labelFilter) {
        let candidates = rows;
        if (labelFilter && labelFilter.trim()) {
            const lf = labelFilter.trim().toLowerCase();
            candidates = rows.filter(r => getStationLabel(r).toLowerCase().includes(lf));
        }

        const anyNumbered = candidates.some(r => getStationNumber(r) !== null);

        if (target === 'all')  return r => candidates.includes(r);
        if (target === 'even') return r => { const n = getStationNumber(r); return n !== null && n % 2 === 0 && candidates.includes(r); };
        if (target === 'odd')  return r => { const n = getStationNumber(r); return n !== null && n % 2 !== 0 && candidates.includes(r); };

        if (target === 'low' || target === 'high') {
            if (!anyNumbered) return r => candidates.includes(r);
            const nums = candidates.map(r => getStationNumber(r)).filter(n => n !== null).sort((a, b) => a - b);
            const mid  = nums[Math.floor(nums.length / 2)];
            if (target === 'low')  return r => { const n = getStationNumber(r); return n !== null && n < mid  && candidates.includes(r); };
            if (target === 'high') return r => { const n = getStationNumber(r); return n !== null && n >= mid && candidates.includes(r); };
        }

        if (target === 'first') {
            const half = Math.ceil(candidates.length / 2);
            const set  = new Set(candidates.slice(0, half));
            return r => set.has(r);
        }
        if (target === 'second') {
            const half = Math.ceil(candidates.length / 2);
            const set  = new Set(candidates.slice(half));
            return r => set.has(r);
        }

        return r => candidates.includes(r);
    }

    // ── Run operation on a group ─────────────────────────────────────────────────
    async function runGroupAction(groupDiv, operation, target = 'all', labelFilter = '', updateFn = null) {
        const rows     = getStationRows(groupDiv);
        const qualFn   = buildQualifyFn(target, rows, labelFilter);
        const eligible = rows.filter(r => qualFn(r) && getStationLink(r));

        let done = 0, skipped = 0;
        for (let i = 0; i < eligible.length; i++) {
            const link = getStationLink(eligible[i]);
            if (updateFn) updateFn(i + 1, eligible.length, done, skipped);
            const result = await handleStation(link, operation);
            if (result) done++; else skipped++;
            await sleep(1000);
        }
        return { done, skipped, total: eligible.length };
    }

    // ── Dropdown menu per group ──────────────────────────────────────────────────
    function createDropdown(groupDiv) {
        const h5 = groupDiv.querySelector('h5');
        if (!h5 || h5.dataset.ectInjected) return;
        h5.dataset.ectInjected = '1';

        const cleanName = groupCleanName(h5.textContent.trim());
        const isLane    = isLaneGroup(groupDiv);

        const btn = document.createElement('button');
        btn.className   = 'ect-btn';
        btn.title       = 'ECT controls';
        btn.textContent = '⚙';
        h5.appendChild(btn);

        let menu = null;
        const closeMenu       = () => { menu?.remove(); menu = null; document.removeEventListener('click', closeOnOutside); };
        const closeOnOutside  = (e) => { if (!menu?.contains(e.target)) closeMenu(); };

        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (menu) { closeMenu(); return; }

            menu = document.createElement('div');
            menu.className = 'ect-menu';

            const actions = isLane
                ? [
                    { label: 'Disable All',         op: 'disable', target: 'all'    },
                    { label: 'Disable Even',         op: 'disable', target: 'even'   },
                    { label: 'Disable Odd',          op: 'disable', target: 'odd'    },
                    { label: 'Disable Low',          op: 'disable', target: 'low'    },
                    { label: 'Disable High',         op: 'disable', target: 'high'   },
                    null,
                    { label: 'Enable All',           op: 'enable',  target: 'all'    },
                    { label: 'Enable Even',          op: 'enable',  target: 'even'   },
                    { label: 'Enable Odd',           op: 'enable',  target: 'odd'    },
                    { label: 'Enable Low',           op: 'enable',  target: 'low'    },
                    { label: 'Enable High',          op: 'enable',  target: 'high'   },
                  ]
                : [
                    { label: 'Disable All',          op: 'disable', target: 'all'    },
                    { label: 'Disable First Half',   op: 'disable', target: 'first'  },
                    { label: 'Disable Second Half',  op: 'disable', target: 'second' },
                    null,
                    { label: 'Enable All',           op: 'enable',  target: 'all'    },
                    { label: 'Enable First Half',    op: 'enable',  target: 'first'  },
                    { label: 'Enable Second Half',   op: 'enable',  target: 'second' },
                  ];

            for (const a of actions) {
                if (a === null) {
                    const d = document.createElement('div');
                    d.className = 'ect-divider';
                    menu.appendChild(d);
                    continue;
                }
                const item = document.createElement('button');
                item.className   = 'ect-item';
                item.textContent = a.label;
                item.addEventListener('click', () => {
                    closeMenu();
                    if (isProcessing) { showBanner('⚠ Already processing'); return; }
                    triggerGroupAction(groupDiv, cleanName, a.op, a.target, '');
                });
                menu.appendChild(item);
            }

            const rect = btn.getBoundingClientRect();
            menu.style.top  = `${rect.bottom + 4}px`;
            menu.style.left = `${rect.left}px`;
            document.body.appendChild(menu);
            document.addEventListener('click', closeOnOutside);
        });
    }

    async function triggerGroupAction(groupDiv, groupName, operation, target, labelFilter) {
        isProcessing = true;
        showOverlay(`<b>${groupName}</b><br>${operation} (${target})…`);
        try {
            const { done, skipped, total } = await runGroupAction(
                groupDiv, operation, target, labelFilter,
                (i, t, d, s) => updateOverlay(`<b>${groupName}</b><br>${operation} (${target})<br>${i}/${t} — ✓${d} skip ${s}`)
            );
            showBanner(`<b>${groupName}</b><br>${operation}: ✓${done} done, ${skipped} skipped of ${total}`);
        } finally {
            isProcessing = false;
            removeOverlay();
        }
    }

    // ── Scheduler ────────────────────────────────────────────────────────────────
    function loadSchedules()      { try { return JSON.parse(localStorage.getItem(SCHED_KEY) || '[]'); } catch { return []; } }
    function saveSchedules(arr)   { localStorage.setItem(SCHED_KEY, JSON.stringify(arr)); }

    async function drainScheduleQueue() {
        if (queueRunning) return;
        queueRunning = true;
        while (scheduleQueue.length > 0) { await executeSchedule(scheduleQueue.shift()); }
        queueRunning = false;
    }

    async function executeSchedule(sched) {
        const groups  = getGroupDivs();
        const matchKey = normalizeForMatch(sched.groupMatch);
        const groupDiv = groups.find(g => {
            const h5 = g.querySelector('h5');
            return h5 && normalizeForMatch(groupCleanName(h5.textContent)) === matchKey;
        });
        if (!groupDiv) { showBanner(`⚠ Schedule "${sched.label}": group not found (${sched.groupMatch})`); return; }

        const schedules = loadSchedules();
        const idx = schedules.findIndex(s => s.id === sched.id);
        if (idx >= 0) { schedules[idx].lastRun = new Date().toISOString(); saveSchedules(schedules); }

        isProcessing = true;
        showOverlay(`<b>Schedule: ${sched.label}</b><br>Running…`);
        try {
            const { done, skipped, total } = await runGroupAction(
                groupDiv, sched.operation, sched.target, sched.labelFilter || '',
                (i, t, d, s) => updateOverlay(`<b>Schedule: ${sched.label}</b><br>${i}/${t} — ✓${d} skip ${s}`)
            );
            showBanner(`<b>Schedule: ${sched.label}</b><br>✓${done} done, ${skipped} skipped of ${total}`);
        } finally {
            isProcessing = false;
            removeOverlay();
        }
    }

    function checkSchedules() {
        const now  = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        for (const s of loadSchedules().filter(s => s.active && s.time === hhmm)) {
            const last = s.lastRun ? new Date(s.lastRun) : null;
            if (last && (now - last) < 60000) continue;
            scheduleQueue.push(s);
        }
        if (scheduleQueue.length > 0) drainScheduleQueue();
    }

    // ── Scheduler helpers ────────────────────────────────────────────────────────
    // Scan ALL h5 elements on the page — works even if the group is collapsed
    function getGroupOptions() {
        return [...new Set(
            Array.from(document.querySelectorAll('h5'))
                .map(h5 => groupCleanName(h5.textContent.trim()))
                .filter(Boolean)
        )];
    }

    // Extract unique label-type prefixes from a group's station rows
    // e.g. "Audit 6-47" becomes "Audit", "Problem Solve 2" becomes "Problem Solve"
    function getLabelOptions(groupName) {
        const groups   = getGroupDivs();
        const matchKey = normalizeForMatch(groupName);
        const groupDiv = groups.find(g => {
            const h5 = g.querySelector('h5');
            return h5 && normalizeForMatch(groupCleanName(h5.textContent)) === matchKey;
        });
        if (!groupDiv) return [];
        const labels = getStationRows(groupDiv).map(r => getStationLabel(r));
        const types  = [...new Set(
            labels.map(l => l.replace(/[\s\-\u2013]+\d[\d\s\-\u2013]*$/, '').trim()).filter(Boolean)
        )];
        return types;
    }

    // ── Scheduler UI ─────────────────────────────────────────────────────────────
    function openScheduler() {
        const backdrop = document.createElement('div');
        backdrop.className = 'ect-backdrop';
        const modal = document.createElement('div');
        modal.className = 'ect-modal';
        modal.innerHTML = `
            <div class="ect-modal-hdr">
                <h2>⏰ Scheduled Actions</h2>
                <button class="ect-modal-close">×</button>
            </div>
            <div class="ect-modal-body">
                <div id="ect-sched-list"></div>
                <div style="padding:16px 8px;font-family:'Amazon Ember',Arial,sans-serif;font-size:13px;font-weight:bold;color:#333;">Add New Schedule</div>
                <div class="ect-form-row">
                    <label>Label<input id="ect-f-label" type="text" placeholder="e.g. 10am Learning Disable" style="width:180px"></label>
                    <label>Group<select id="ect-f-group" style="width:160px"><option value="">-- select group --</option></select></label>
                    <label>Operation<select id="ect-f-op"><option value="disable">disable</option><option value="enable">enable</option></select></label>
                    <label>Target<select id="ect-f-target">
                        <option value="all">all</option>
                        <option value="first">first half</option>
                        <option value="second">second half</option>
                        <option value="even">even</option>
                        <option value="odd">odd</option>
                        <option value="low">low</option>
                        <option value="high">high</option>
                    </select></label>
                    <label>Time (HH:MM)<input id="ect-f-time" type="time" style="width:110px"></label>
                    <label>Label filter<select id="ect-f-lfilter" style="width:120px"><option value="">any</option></select></label>
                </div>
            </div>
            <div class="ect-modal-footer">
                <button class="ect-btn-sm muted" id="ect-sched-cancel">Cancel</button>
                <button class="ect-btn-sm primary" id="ect-sched-add">Add Schedule</button>
            </div>`;
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const close = () => backdrop.remove();
        modal.querySelector('.ect-modal-close').addEventListener('click', close);
        modal.querySelector('#ect-sched-cancel').addEventListener('click', close);
        backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
        renderScheduleList(modal);

        // Populate group dropdown from live page groups
        const groupSel   = modal.querySelector('#ect-f-group');
        const lfilterSel = modal.querySelector('#ect-f-lfilter');

        function populateLabelOptions(groupName) {
            lfilterSel.innerHTML = '<option value="">any</option>';
            for (const l of getLabelOptions(groupName)) {
                const opt = document.createElement('option');
                opt.value = opt.textContent = l;
                lfilterSel.appendChild(opt);
            }
        }

        for (const g of getGroupOptions()) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = g;
            groupSel.appendChild(opt);
        }
        // Pre-populate label options for first group
        if (groupSel.options.length > 1) populateLabelOptions(groupSel.options[1].value);
        groupSel.addEventListener('change', () => populateLabelOptions(groupSel.value));

        modal.querySelector('#ect-sched-add').addEventListener('click', () => {
            const label   = modal.querySelector('#ect-f-label').value.trim();
            const group   = groupSel.value;
            const op      = modal.querySelector('#ect-f-op').value;
            const target  = modal.querySelector('#ect-f-target').value;
            const time    = modal.querySelector('#ect-f-time').value;
            const lfilter = lfilterSel.value;
            if (!label || !group || !time) { alert('Label, Group, and Time are required.'); return; }
            const arr = loadSchedules();
            arr.push({ id: Date.now().toString(), label, groupMatch: group, operation: op, target, time, labelFilter: lfilter, active: true, lastRun: null });
            saveSchedules(arr);
            renderScheduleList(modal);
            modal.querySelector('#ect-f-label').value = '';
            modal.querySelector('#ect-f-time').value  = '';
            // Reset selects to first real group and repopulate labels
            if (groupSel.options.length > 1) { groupSel.selectedIndex = 1; populateLabelOptions(groupSel.options[1].value); }
            else { groupSel.selectedIndex = 0; lfilterSel.innerHTML = '<option value="">any</option>'; }
        });
    }

    function renderScheduleList(modal) {
        const list = modal.querySelector('#ect-sched-list');
        const arr  = loadSchedules();
        if (arr.length === 0) { list.innerHTML = '<div class="ect-empty">No schedules yet.</div>'; return; }
        list.innerHTML = '';
        for (const s of arr) {
            const row = document.createElement('div');
            row.className = 'ect-sched-row';
            // FIX: added spaces between class names (primary ect-run-now / danger ect-del)
            row.innerHTML = `
                <div class="ect-sched-label">${s.label}</div>
                <div class="ect-sched-meta">${s.time} · ${s.operation} ${s.target}${s.labelFilter ? ' [' + s.labelFilter + ']' : ''}<br><span style="font-size:11px;color:#999">${s.groupMatch}</span></div>
                <label style="display:flex;align-items:center;gap:4px;font-size:12px;font-family:'Amazon Ember',Arial,sans-serif;cursor:pointer">
                    <input type="checkbox" data-id="${s.id}" class="ect-toggle" ${s.active ? 'checked' : ''}> Active</label>
                <div class="ect-sched-actions">
                    <button class="ect-btn-sm primary ect-run-now" data-id="${s.id}">Run Now</button>
                    <button class="ect-btn-sm danger ect-del"      data-id="${s.id}">Delete</button>
                </div>`;
            list.appendChild(row);
        }
        // FIX: event delegation — prevents CT React event delegation from intercepting clicks
        list.addEventListener('click', e => {
            e.stopPropagation();
            const delBtn = e.target.closest('.ect-del');
            if (delBtn) {
                saveSchedules(loadSchedules().filter(x => x.id !== delBtn.dataset.id));
                renderScheduleList(modal);
                return;
            }
            const runBtn = e.target.closest('.ect-run-now');
            if (runBtn) {
                const s = loadSchedules().find(x => x.id === runBtn.dataset.id);
                if (!s) return;
                if (isProcessing) { showBanner('⚠ Already processing'); return; }
                scheduleQueue.push(s);
                drainScheduleQueue();
                modal.closest('.ect-backdrop').remove();
            }
        });
        list.addEventListener('change', e => {
            const toggle = e.target.closest('.ect-toggle');
            if (!toggle) return;
            const a = loadSchedules();
            const s = a.find(x => x.id === toggle.dataset.id);
            if (s) { s.active = toggle.checked; saveSchedules(a); }
        });
    }

    // ── Toolbar ──────────────────────────────────────────────────────────────────
    function buildToolbar() {
        if (document.getElementById('ect-toolbar')) return;
        const bar = document.createElement('div');
        bar.className = 'ect-toolbar';
        bar.id = 'ect-toolbar';
        const schedBtn = document.createElement('button');
        schedBtn.className   = 'ect-tb-btn ect-sched';
        schedBtn.textContent = '⏰ Schedules';
        schedBtn.addEventListener('click', openScheduler);
        bar.appendChild(schedBtn);
        document.body.appendChild(bar);
    }

    // ── DOM injection ────────────────────────────────────────────────────────────
    function injectButtons() { getGroupDivs().forEach(createDropdown); }

    const observer = new MutationObserver(() => { injectButtons(); buildToolbar(); });
    observer.observe(document.body, { childList: true, subtree: true });

    injectButtons();
    buildToolbar();
    checkSchedules();
    setInterval(checkSchedules, 60000);

})();