// ==UserScript==
// @name JPDB Userscript
// @namespace http://tampermonkey.net/
// @version 0.1.7
// @description Apply custom styles to JPDB pages, replace deck list on learn page, and style buttons
// @match https://jpdb.io/*
// @grant GM_addStyle
// @run-at document-start
// @updateURL https://raw.githubusercontent.com/6a67/jpdb-userscript/main/script.user.js
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        enableButtonStyling: true,
        learnPageUrl: 'https://jpdb.io/learn',
        deckListPageUrl: 'https://jpdb.io/deck-list',
        reviewPageUrlPrefix: 'https://jpdb.io/review',
        deckListSelector: 'div.deck-list',
        deckListLinkSelector: 'a[href="/deck-list"]',
        reviewButtonSelector: '.review-button-group input[type="submit"]'
    };

    const STYLES = {
        main: `
            @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap');

            .dark-mode {
                --text-color: #ddd;
                --background-color: #151f24;
                --deeper-background-color: #0d1518;
                --foreground-background-color: #1e2a30;
                --link-underline-color: #00ffaa;
                --link-color: #00ffaa;
                --highlight-color: #1a3b33;
                --checkbox-focused-border-color: #3bdfac;
                --checkbox-background-color: #0d1518;
                --checkbox-focused-box-shadow-color: #3bdfac;
                --button-background-color: #1a3b33;
                --button-focused-border-color: #3bdfac;
                --outline-input-background-color-review: #0d1518;
                --outline-input-background-color: #1a262c;
                --answer-box-color: #1e2a30;
                --table-border-color: #444;
                --spelling-box-background-color: #1a3b33;
                --input-border-color: #2a3a42;
                --input-background-color: #1a262c;
                --input-box-shadow-color: #0d1518;
                --scrollbar-color: #3bdfac;
                --scrollbar-background-color: #0d1518;
                --mnemonic-main: #1a3b33;
                --mnemonic-component: #1e2a30;
                --background-button-border-color: #2a3a42;
                --big-shadow-color: #0a1114;
                --progress-bar-background: #1e2a30;
                --progress-bar-foreground: linear-gradient(#269d75, #2a7d66);
                --progress-bar-in-progress: #2a3a42;
                --review-button-group-border: #2a3a42;
            
                --focused-arrow-color: #3bdfac;
                --what-is-this-color: #888;
                --what-is-this-focus-color: #3bdfac;
                --what-is-this-focus-shadow-color: #1a3b33;
                --checkbox-color: #3bdfac;
                --checkbox-focused-text-underline-color: #3bdfac;
                --button-hover-border-color: #3bdfac;
                --outline-input-color: #3bdfac;
            
                --outline-input-shadow-color: #3bdfac;
                --subsection-label-color: #aaa;
                --table-header-color: #aaa;
                --input-focused-border-color: #3bdfac;
            
                --property-text-color: #aaa;
                --state-new: #3bdfac;
                --state-blacklisted: #888;
                --state-known: #4fa825;
                --state-overdue: #ff8c42;
                --state-failed: #ff3b3b;
            
                --outline-v1-color: #ff2929;
                --outline-v3-color: #d98c00;
                --outline-v4-color: #0ccf0c;
            }
            
            :is(html.dark-mode) .highlight,
            :is(html.dark-mode) .main.column {
                --outline-input-color: #4b8dff;
            }
            
            :is(html.dark-mode) .tooltip:before {
                background-color: #101518;
            }
            
            body,
            input {
                font-family: 'Manrope', 'Nunito Sans', 'Extra Sans JP', 'Noto Sans Symbols2', 'Segoe UI', 'Noto Sans JP', 'Noto Sans CJK JP',
                    'Hiragino Sans GB', 'Meiryo', sans-serif;
            }
            
            input[type='button'],
            input[type='submit'].button,
            a.outline,
            label.outline,
            input.outline {
                border-radius: 1rem !important;
            }
            
            input[type='email'],
            input[type='number'],
            input[type='password'],
            input[type='search'],
            input[type='tel'],
            input[type='text'],
            input[type='url'],
            select {
                border-radius: 9999px;
            }
            
            .accordion:has(input[type='text']) input[type='text'] {
                border-radius: 0.5rem;
                padding: 0.15em 0.75em;
            }

            .accordion > div > form > div:nth-child(1) {
                display: grid !important;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
            }

            .accordion:has(.form-row) .form-row {
                // flex align right
                display: flex;
                justify-content: flex-end;
            }

            textarea {
                border-radius: 1rem !important;
            }
            
            body {
                /* zoom: 1.2; */
            }
            
            .deck-list > div {
                border-radius: 1rem !important;
            }
            
            [style*='border-radius: 4px'],
            [style*='border-radius:4px'],
            [style*='border-radius: 8px'],
            [style*='border-radius:8px'] {
                border-radius: 1rem !important;
            }
            
            .ranking-entry {
                border-radius: 1rem !important;
            }

            .message-box, .error-box {
                border-radius: 1rem !important;
            }

            .search .result,
            .dropdown .dropdown-content,
            .dropdown summary,
            .accordion,
            fieldset {
                border-radius: 1rem !important;
            }
            
            fieldset legend {
                margin-left: 1em;
            }
            
            div.deck-list:not(div.deck-list ~ div.deck-list) {
                display: grid !important;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
            }

            /* Searchbar mod */
            #search-bar-lang {
                position: absolute;
                top: 0;
                right: 2.5em;
                margin: 0;
                padding: 0;
                border: none;
                background-color: transparent;
                box-shadow: none;
                z-index: 2;
            }

            :has(#search-bar-lang) > input {
                z-index: 1;
                padding-right: 3em !important;
                position: relative;
            }

            :has(#search-bar-lang) > input::-webkit-search-cancel-button {
                position: absolute;
                right: 3em;
                top: 50%;
            }
        `,



        button: `
            .main.column form {
                display: inline-block;
            }
            .main.column input[type="submit"] {
                font-weight: bold;
                cursor: pointer;
                color: white;
                border: none;
                transition: all 0.05s ease;
                outline: none;
                user-select: none;
                text-align: center;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                position: relative;
                overflow: hidden;
            }
            .main.column input[type="submit"]::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 50%;
                background: linear-gradient(to bottom, rgba(255,255,255,0.2), rgba(255,255,255,0));
                pointer-events: none;
            }
            .main.column input[type="submit"]:active {
                transform: translateY(4px);
                box-shadow: 0 1px 0 rgba(0,0,0,0.3) !important;
            }
            .main.column input[type="submit"]:active::before {
                opacity: 0.5;
            }
        `
    };

    function applyStyles() {
        GM_addStyle(STYLES.main);
        if (CONFIG.enableButtonStyling) {
            GM_addStyle(STYLES.button);
        }
    }

    function applyGridStyle(element) {
        if (!element) return;
        element.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        `;
        Array.from(element.children).forEach(child => child.style.margin = '0');
    }

    function hideDeckListLink() {
        const deckListLink = document.querySelector(CONFIG.deckListLinkSelector);
        if (deckListLink) {
            deckListLink.style.display = 'none';
        }
    }

    async function replaceDeckList() {
        try {
            const response = await fetch(CONFIG.deckListPageUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const deckListPage = parser.parseFromString(html, 'text/html');
            const newDeckList = deckListPage.querySelector(CONFIG.deckListSelector);
            
            if (newDeckList) {
                const currentDeckList = document.querySelector(CONFIG.deckListSelector);
                if (currentDeckList) {
                    const clonedDeckList = newDeckList.cloneNode(true);
                    currentDeckList.replaceWith(clonedDeckList);
                    applyGridStyle(clonedDeckList);
                    hideDeckListLink();
                }
            }
        } catch (error) {
            console.error('Error replacing deck list:', error);
        }
    }

    function darkenColor(hex, factor = 0.8) {
        const r = Math.floor(parseInt(hex.slice(1, 3), 16) * factor);
        const g = Math.floor(parseInt(hex.slice(3, 5), 16) * factor);
        const b = Math.floor(parseInt(hex.slice(5, 7), 16) * factor);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    function styleButton(button) {
        const computedStyle = window.getComputedStyle(button);
        const colorVar = button.classList.contains('v1') ? '--outline-v1-color' :
                         button.classList.contains('v3') ? '--outline-v3-color' :
                         button.classList.contains('v4') ? '--outline-v4-color' :
                         '--outline-input-color';
        const buttonColor = computedStyle.getPropertyValue(colorVar).trim();
        const darkerColor = darkenColor(buttonColor);

        button.style.cssText = `
            background-color: ${buttonColor};
            box-shadow: 0 5px 0 ${darkerColor}, 0 5px 10px rgba(0,0,0,0.2);
        `;

        const buttonEvents = {
            mousedown: () => {
                button.style.transform = 'translateY(4px)';
                button.style.boxShadow = `0 1px 0 ${darkerColor}, 0 1px 3px rgba(0,0,0,0.2)`;
                button.style.backgroundColor = darkerColor;
            },
            mouseup: () => {
                button.style.transform = '';
                button.style.boxShadow = `0 5px 0 ${darkerColor}, 0 5px 10px rgba(0,0,0,0.2)`;
                button.style.backgroundColor = buttonColor;
            },
            mouseleave: () => {
                button.style.transform = '';
                button.style.boxShadow = `0 5px 0 ${darkerColor}, 0 5px 10px rgba(0,0,0,0.2)`;
                button.style.backgroundColor = buttonColor;
            }
        };

        Object.entries(buttonEvents).forEach(([event, handler]) => {
            button.addEventListener(event, handler);
        });
    }

    function styleReviewButtons() {
        document.querySelectorAll(CONFIG.reviewButtonSelector).forEach(styleButton);
    }

    function initLearnPage() {
        replaceDeckList();
        hideDeckListLink();

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.target.classList.contains('deck-list')) {
                    replaceDeckList();
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function initReviewPage() {
        styleReviewButtons();

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.classList.contains('review-button-group')) {
                                styleReviewButtons();
                            } else {
                                node.querySelectorAll(CONFIG.reviewButtonSelector).forEach(styleButton);
                            }
                        }
                    });
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        applyStyles();

        if (window.location.href === CONFIG.learnPageUrl) {
            initLearnPage();
        } else if (window.location.href.startsWith(CONFIG.reviewPageUrlPrefix) && CONFIG.enableButtonStyling) {
            initReviewPage();
        }
    }

    applyStyles();
    document.addEventListener('DOMContentLoaded', init);
})();
