// ==UserScript==
// @name JPDB Userscript (6a67)
// @namespace http://tampermonkey.net/
// @version 0.1.20
// @description Script for JPDB that adds some styling and functionality
// @match https://jpdb.io/*
// @grant GM_addStyle
// @grant GM_xmlhttpRequest
// @grant GM_setValue
// @grant GM_getValue
// @connect github.com
// @run-at document-start
// @updateURL https://raw.githubusercontent.com/6a67/jpdb-userscript/main/script.user.js
// ==/UserScript==

// Features
// - Design overhaul
// - - Updated dark mode
// - - Font change
// - - Rounded corners
// - - Updated accordion styling
// - Cleaned up homepage
// - Kanji grid on hover
// - Updated search bar styling
// - Updated deck list styling and shows all decks on learning page
// - - Hides deck list link
// - Review button styling
// - Replace kanji stroke order with KanjiVG

(function () {
	'use strict';

	const CONFIG = {
		enableButtonStyling: true,
		learnPageUrl: 'https://jpdb.io/learn',
		deckListPageUrl: 'https://jpdb.io/deck-list',
		reviewPageUrlPrefix: 'https://jpdb.io/review',
		deckListSelector: 'div.deck-list',
		deckListLinkSelector: 'a[href="/deck-list"]',
		reviewButtonSelector: '.review-button-group input[type="submit"]',
		enableReplaceKanjiStrokeOrder: true,
        useFontInsteadOfSvg: false,
		strokeOrderRepoUrl: 'https://github.com/KanjiVG/kanjivg/raw/master/kanji/',
		kanjiSvgSelector: '.kanji svg',
		kanjiPlainSelector: '.kanji.plain',
	};

	const STYLES = {
		main: `
            @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap');

            :root {
                /* Original button colors */
                --outline-v1-color: #ff2929;
                --outline-v3-color: #d98c00;
                --outline-v4-color: #0ccf0c;
                --easy-button-color: #4b8dff;
            }

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
                --mnemonic-main: #1a9e75;
                --mnemonic-component: #0a3d2d;
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

                /* Custom button colors */
                --outline-v1-color: #d42728;
                --outline-v3-color: #b57807;
                --outline-v4-color: #0eaf10;
                --easy-button-color: #3c6fc3;
            }
            
            :is(html.dark-mode) .main.column {
                --outline-input-color: var(--easy-button-color);
            }

            :is(html.dark-mode) .highlight {
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
            .accordion,
            fieldset {
                border-radius: 1rem !important;
            }

            .dropdown summary {
                border-radius: 0.5rem !important;
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
                right: 1em;
                padding: 0;
                width: 5em !important;
                border: none;
                background-color: transparent;
                box-shadow: none;
                z-index: 2;
            }

            #search-bar-lang > option {
                text-align: center;
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
            
            /* This hides the additional messages on the homepage, including the Patreon message */
		    /* Please support the developer by via Patreon */
            /* body :has(a[href*="patreon.com"]) > *:nth-child(n+6) {
                display: none !important;
            } */

            body > div.container.bugfix:has(a[href*="patreon.com"]) > *:nth-child(n+6) {
                display: none !important;
            }


            /* Kanji Grid on hover */
            .vbox .kanji.plain {
                position: relative;
                display: inline-block;
            }

            /* Kanji Grid for review */
            .hbox:has(> .kanji.plain):hover::before {
                content: '';
                position: absolute;
                top: 0%;
                left: calc(50% - 8rem);
                background-image:
                    linear-gradient(to right, var(--deeper-background-color) 5%, transparent 5%),
                    linear-gradient(to bottom, var(--deeper-background-color) 5%, transparent 5%);
                background-size: calc(calc(100% - 2.5%) / 2) calc(calc(100% - 2.5%) / 2);
                z-index: 1;
                border-radius: inherit;

                width: 16rem;
                height: 16rem;
            }

            /* Kanji Grid for search results */
            .vbox:has(> .kanji.plain) .kanji.plain:hover::before {
                content: '';
                position: absolute;
                top: 0;
                bottom: calc(2.5% / 2);
                left: 0;
                right: 0;
                background-image:
                    linear-gradient(to right, var(--deeper-background-color) 5%, transparent 5%),
                    linear-gradient(to bottom, var(--deeper-background-color) 5%, transparent 5%);
                background-size: calc(calc(100% - 2.5%) / 2) calc(calc(100% - 2.5%) / 2);
                z-index: 1;
                border-radius: 0.5rem;
            }
            
            .kanji.plain svg {
                position: relative;
                z-index: 2;
            }

            /* Kanji Stroke Order */
            svg.stroke-order-kanji [style*='stroke:'] {
                stroke: var(--text-color) !important;
            }
            
            svg.stroke-order-kanji [id*="strokenumbers" i] {
                fill: var(--text-strong-color) !important;
                opacity: 0.15;
                font-size: 6px !important;
            }

            /* The svgs are usually a bit too small */
            svg.stroke-order-kanji > g {
                position: relative !important;
                scale: 1.1;
                transform-origin: center center;
                overflow: visible;
            }

            svg.stroke-order-kanji {
                overflow: visible;
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
        `,

        kanjiFont: `
            @font-face {
                font-family: "KanjiStrokeOrders";
                src: url("https://raw.githubusercontent.com/edarzh/kanjistrokeorders/main/KanjiStrokeOrders_v4.004.woff2");
            }
            
            .kanji-font {
                position: absolute;
                top: 50%;
                left: 50%;
                font-family: KanjiStrokeOrders;
                transform: translate(-50%, -50%);

                z-index: 2;

                user-select: none;
                cursor: default;
            }

            svg.kanji > path {
                visibility: hidden;
            }
        `,
	};


	function applyStyles() {
		GM_addStyle(STYLES.main);
		if (CONFIG.enableButtonStyling) {
			GM_addStyle(STYLES.button);
		}
        if (CONFIG.enableReplaceKanjiStrokeOrder && CONFIG.useFontInsteadOfSvg) {
            GM_addStyle(STYLES.kanjiFont);
        }
	}

	function applyGridStyle(element) {
		if (!element) return;
		element.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        `;
		Array.from(element.children).forEach((child) => (child.style.margin = '0'));
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
		const colorVar = button.classList.contains('v1')
			? '--outline-v1-color'
			: button.classList.contains('v3')
			? '--outline-v3-color'
			: button.classList.contains('v4')
			? '--outline-v4-color'
			: '--outline-input-color';
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
			},
		};

		Object.entries(buttonEvents).forEach(([event, handler]) => {
			button.addEventListener(event, handler);
		});
	}

	function styleReviewButtons() {
		document.querySelectorAll(CONFIG.reviewButtonSelector).forEach(styleButton);
	}

    function replaceKanjiStrokeOrderFont() {
        const kanjiSvg = document.querySelector(CONFIG.kanjiSvgSelector);
        const kanjiPlain = document.querySelector(CONFIG.kanjiPlainSelector);
        if (!kanjiSvg || !kanjiPlain) return;
        const kanjiChar = kanjiPlain.getAttribute('href').split(/[?#]/)[0].split('/').pop();

        // kanjiSvg.remove();
        const kanjiFont = document.createElement('span');
        kanjiFont.classList.add('kanji-font');
        kanjiFont.textContent = kanjiChar;
        kanjiPlain.appendChild(kanjiFont);

        resizeKanjiStrokeOrderFont();
    }

    function resizeKanjiStrokeOrderFont() {
        const text = document.querySelector('.kanji-font');
        const container = text.parentElement.parentElement;

        const containerHeight = container.clientHeight;
        text.style.fontSize = '1px';
        let fontSize = 1;
        while (text.clientHeight < containerHeight) {
            fontSize++;
            text.style.fontSize = `${fontSize}px`;
        }
        fontSize--;
        
        // The font would match now, but is often a bit too small
        fontSize *= 1.25;
        text.style.fontSize = `${fontSize}px`;
    }

    function fetchAndCacheSVG(strokeOrderUrl, originalWidth, originalHeight, originalClass, kanjiSvg) {
        const cachedSVG = GM_getValue(strokeOrderUrl);
        
        if (cachedSVG) {
            processSVG(cachedSVG, originalWidth, originalHeight, originalClass, kanjiSvg);
        } else {
            GM_xmlhttpRequest({
                method: 'GET',
                url: strokeOrderUrl,
                onload: function (response) {
                    if (response.status === 200) {
                        GM_setValue(strokeOrderUrl, response.responseText);
                        processSVG(response.responseText, originalWidth, originalHeight, originalClass, kanjiSvg);
                    } else {
                        console.error('Error fetching kanji stroke order: Status ' + response.status);
                    }
                },
                onerror: function (error) {
                    console.error('Error fetching kanji stroke order:', error);
                },
            });
        }
    }

    function replaceKanjiStrokeOrderSvg() {
        const kanjiSvg = document.querySelector(CONFIG.kanjiSvgSelector);
        const kanjiPlain = document.querySelector(CONFIG.kanjiPlainSelector);
        if (!kanjiSvg || !kanjiPlain) return;
        const kanjiChar = kanjiPlain.getAttribute('href').split(/[?#]/)[0].split('/').pop();
        const kanjiUnicode = kanjiChar.codePointAt(0).toString(16).padStart(5, '0');
        const strokeOrderUrl = `${CONFIG.strokeOrderRepoUrl}${kanjiUnicode}.svg`;
    
        // Store the original SVG's dimensions
        const originalWidth = kanjiSvg.getAttribute('width');
        const originalHeight = kanjiSvg.getAttribute('height');
        const originalClass = kanjiSvg.getAttribute('class');
    
        // Check cache first
        const cachedSvg = GM_getValue(strokeOrderUrl);
        if (cachedSvg) {
            replaceSvgWithCached(cachedSvg);
        } else {
            fetchAndCacheSvg();
        }
    
        function replaceSvgWithCached(svgContent) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = svgContent;
            const newSvg = tempDiv.querySelector('svg');
            if (newSvg) {
                applySvgAttributes(newSvg);
                kanjiSvg.parentNode.replaceChild(newSvg, kanjiSvg);
            } else {
                console.error('New SVG not found in the cached content');
            }
        }
    
        function fetchAndCacheSvg() {
            GM_xmlhttpRequest({
                method: 'GET',
                url: strokeOrderUrl,
                onload: function (response) {
                    if (response.status === 200) {
                        const svgContent = response.responseText;
                        GM_setValue(strokeOrderUrl, svgContent); // Cache the SVG
                        replaceSvgWithCached(svgContent);
                    } else {
                        console.error('Error fetching kanji stroke order: Status ' + response.status);
                    }
                },
                onerror: function (error) {
                    console.error('Error fetching kanji stroke order:', error);
                },
            });
        }
    
        function applySvgAttributes(newSvg) {
            newSvg.setAttribute('width', originalWidth);
            newSvg.setAttribute('height', originalHeight);
    
            if (!newSvg.getAttribute('viewBox')) {
                const viewBox = `0 0 ${newSvg.getAttribute('width')} ${newSvg.getAttribute('height')}`;
                newSvg.setAttribute('viewBox', viewBox);
            }
    
            newSvg.setAttribute('class', originalClass);
            newSvg.classList.add('stroke-order-kanji');
        }
    }

	// This does external requests to github.com
	function replaceKanjiStrokeOrder() {
        if (CONFIG.useFontInsteadOfSvg) {
            replaceKanjiStrokeOrderFont();
        } else {
            replaceKanjiStrokeOrderSvg();
        }
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
					mutation.addedNodes.forEach((node) => {
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

	function initKanjiStrokeOrder() {
		replaceKanjiStrokeOrder();

		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						node.querySelectorAll(CONFIG.kanjiSvgSelector).forEach(replaceKanjiStrokeOrder);
					});
				}
			});
		});
		observer.observe(document.body, { childList: true, subtree: true });

        if (CONFIG.useFontInsteadOfSvg) {
            window.addEventListener('load', resizeKanjiStrokeOrderFont);
            window.addEventListener('resize', resizeKanjiStrokeOrderFont);
        }
	}

	function init() {
		applyStyles();

		if (window.location.href === CONFIG.learnPageUrl) {
			initLearnPage();
		} else if (window.location.href.startsWith(CONFIG.reviewPageUrlPrefix) && CONFIG.enableButtonStyling) {
			initReviewPage();
		}

		if (CONFIG.enableReplaceKanjiStrokeOrder) {
			initKanjiStrokeOrder();
		}
	}

	applyStyles();
	document.addEventListener('DOMContentLoaded', init);
})();
