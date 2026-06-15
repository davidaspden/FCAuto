// ==UserScript==
// @name         Basic Top Drawer.
// @namespace    http://tampermonkey.net/
// @version      2026-06-15
// @description  try to take over the world!
// @author       LTD
// @match        https://davidaspden.github.io*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    /* ─── CSS ─────────────────────────────────────────────── */
    const style = document.createElement('style');
    style.textContent = `
        #tm-drawer-wrap {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 2147483647;
            display: flex;
            overflow: hidden;
            justify-content: center;
            pointer-events: none;
        }

        #tm-drawer {
            pointer-events: auto;
            width: max(640px, calc(100% - 24px));
            background: #fff;
            border-radius: 0 0 12px 12px;
            box-shadow: 0 6px 28px rgba(0,0,0,.18);
            overflow: hidden;
            height: 52px;
            transition: height var(--tm-dur, 320ms) ease;
            position: relative;
        }

        /* animated gradient bottom border */
        #tm-drawer::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(
                90deg,
                var(--tm-grad-a, #2f80ed),
                var(--tm-grad-b, #ffffff),
                var(--tm-grad-a, #2f80ed)
            );
            background-size: 200% 100%;
            animation: tm-bounce 1.8s ease-in-out infinite alternate;
        }

        @keyframes tm-bounce {
            0%   { background-position: 0% 50%; }
            100% { background-position: 100% 50%; }
        }

        #tm-drawer-inner {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px 16px 16px;
            gap: 10px;
        }

        #tm-toggle-btn {
            padding: 10px 28px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            border: none;
            border-radius: var(--tm-radius, 18px);
            background: #0f6ad9;
            color: #fff;
            min-width: 200px;
            transition: background 200ms ease;
        }

        #tm-toggle-btn:hover { background: #0b56b5; }

        #tm-drawer-content {
            opacity: 0;
            transform: translateY(-6px);
            transition: opacity 250ms ease, transform 250ms ease;
            width: 100%;
            text-align: center;
            font-family: sans-serif;
            font-size: 14px;
            color: #333;
        }

        #tm-drawer.tm-open #tm-drawer-content {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);

    /* ─── HTML ────────────────────────────────────────────── */
    const wrap = document.createElement('div');
    wrap.id = 'tm-drawer-wrap';
    wrap.innerHTML = `
        <div id="tm-drawer" aria-expanded="false">
            <div id="tm-drawer-inner">
                <button id="tm-toggle-btn" type="button">Open</button>
                <div id="tm-drawer-content">
                    <!-- put your drawer content here -->
                    <p>Drawer content area</p>
                </div>
            </div>
        </div>
    `;
    document.body.insertBefore(wrap, document.body.firstChild);

    /* ─── openDrawer(options) ─────────────────────────────── */
    // All options are optional – omit any you don't need.
    // options = {
    //   height   : 220,        // px  – how tall the drawer grows when open
    //   radius   : 20,         // px  – button border-radius
    //   gradA    : '#2f80ed',  // CSS colour – outer gradient stops
    //   gradB    : '#f2994a',  // CSS colour – centre gradient stop
    //   duration : 320,        // ms  – open/close transition speed
    // }
    function openDrawer(options = {}) {
        const root   = document.documentElement;
        const drawer = document.getElementById('tm-drawer');
        const btn    = document.getElementById('tm-toggle-btn');
        const isOpen = drawer.classList.toggle('tm-open');

        if (options.height   != null) root.style.setProperty('--tm-open-height', options.height   + 'px');
        if (options.radius   != null) root.style.setProperty('--tm-radius',      options.radius   + 'px');
        if (options.gradA    != null) root.style.setProperty('--tm-grad-a',       options.gradA);
        if (options.gradB    != null) root.style.setProperty('--tm-grad-b',       options.gradB);
        if (options.duration != null) root.style.setProperty('--tm-dur',          options.duration + 'ms');

        const openHeight = root.style.getPropertyValue('--tm-open-height') || '220px';

        drawer.style.height = isOpen ? openHeight : '52px';
        drawer.setAttribute('aria-expanded', String(isOpen));
        btn.textContent = isOpen ? 'Close' : 'Open';

        // slide the page down so content is not hidden under the drawer
        const dur = root.style.getPropertyValue('--tm-dur') || '320ms';
        document.body.style.transition = `padding-top ${dur} ease`;
        document.body.style.paddingTop = isOpen ? openHeight : '0px';
    }

    document.getElementById('tm-toggle-btn').addEventListener('click', () => {
        openDrawer({
            height:   220,
            radius:   10,
            gradA:    '#000000',
            gradB:    '#ffffff',
            duration: 320,
        });
    });

})();