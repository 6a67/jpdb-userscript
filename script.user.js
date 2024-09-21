// ==UserScript==
// @name JPDB Userscript (6a67)
// @namespace http://tampermonkey.net/
// @version 0.1.135
// @description Script for JPDB that adds some styling and functionality
// @match *://jpdb.io/*
// @grant GM_addStyle
// @grant GM_xmlhttpRequest
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_setClipboard
// @grant GM_listValues
// @grant GM_deleteValue
// @connect github.com
// @run-at document-start
// @require https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @require https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js
// @updateURL https://raw.githubusercontent.com/6a67/jpdb-userscript/main/script.user.js
// ==/UserScript==

(function () {
    'use strict';

    // document.body.style.display = 'none';
    // document.addEventListener(`${GM_info.script.name}-initialized`, () => {
    //     document.body.style.display = '';
    // });

    class UserSetting {
        constructor(name, defaultValue, shortDescription, longDescription = '', possibleValues = null, minVal = 1, maxVal = 99999, dependency = null) {
            this.name = name;
            this.defaultValue = defaultValue;
            this.shortDescription = shortDescription;
            this.longDescription = longDescription;
            this.possibleValues = possibleValues;
            this.minVal = minVal;
            this.maxVal = maxVal;
            this.dependency = dependency;

            // Initialize the value, ensuring it's within possible values if specified
            this.value = this.validateValue(GM_getValue(name, defaultValue));

            // Create a function that can be called and also act as an object
            const settingFunction = (...args) => {
                if (args.length > 0) {
                    this.setValue(args[0]);
                    return this.getValue();
                } else {
                    return this.getValue();
                }
            };

            // Add methods to the function
            settingFunction.getValue = this.getValue.bind(this);
            settingFunction.setValue = this.setValue.bind(this);
            settingFunction.getName = this.getName.bind(this);
            settingFunction.getShortDescription = this.getShortDescription.bind(this);
            settingFunction.getLongDescription = this.getLongDescription.bind(this);
            settingFunction.getPossibleValues = this.getPossibleValues.bind(this);
            settingFunction.getMinVal = this.getMinVal.bind(this);
            settingFunction.getMaxVal = this.getMaxVal.bind(this);
            settingFunction.getDependency = this.getDependency.bind(this);

            // Return the function with added methods
            return settingFunction;
        }

        validateValue(value) {
            if (this.possibleValues && !this.possibleValues.includes(value)) {
                console.warn(`Invalid value for ${this.name}. Using default value.`);
                return this.defaultValue;
            }
            if (typeof value === 'number') {
                if (value < this.minVal || value > this.maxVal) {
                    console.warn(`Invalid value for ${this.name}. Using default value.`);
                    return this.defaultValue;
                }
            }
            return value;
        }

        getValue() {
            return this.value;
        }

        setValue(newValue) {
            const validatedValue = this.validateValue(newValue);
            if (validatedValue !== this.value) {
                this.value = validatedValue;
                GM_setValue(this.name, validatedValue);
            }
        }

        getName() {
            return this.name;
        }

        getShortDescription() {
            return this.shortDescription;
        }

        getLongDescription() {
            return this.longDescription;
        }

        getPossibleValues() {
            return this.possibleValues;
        }

        getMinVal() {
            return this.minVal;
        }

        getMaxVal() {
            return this.maxVal;
        }

        getDependency() {
            return this.dependency;
        }
    }

    let STATE = {
        currentlyBuildingKanjiCache: false,
        cachedEffects: GM_getValue('cachedEffects', false),
        warmingEffectsPromise: null,
        revealEffectPlayed: false,
    };

    let WARM = {};

    const CONFIG = {
        learnPageUrl: 'https://jpdb.io/learn',
        deckListPageUrl: 'https://jpdb.io/deck-list',
        reviewPageUrlPrefix: 'https://jpdb.io/review',
        settingsPageUrl: 'https://jpdb.io/settings',
        deckListClass: 'deck-list',
        deckListSelector: 'div.deck-list',
        newDeckListClass: 'injected-deck-list',
        newDeckListSelector: 'div.injected-deck-list',
        deckListLinkSelector: 'a[href="/deck-list"]',
        reviewButtonSelector: '.review-button-group input[type="submit"]',
        // strokeOrderRepoUrl: 'https://github.com/KanjiVG/kanjivg/raw/master/kanji/',
        strokeOrderHost: 'https://github.com',
        strokeOrderRawHost: 'https://raw.githubusercontent.com',
        strokeOrderRepo: 'KanjiVG/kanjivg',
        strokeOrderFolder: 'kanji',
        strokeOrderBranch: 'master',
        kanjiSvgSelector: '.kanji svg',
        kanjiPlainSelector: '.kanji.plain',
        searchOverlayTransitionDuration: 200,
        cachePrefix: 'cache_',
        indexedDBName: 'HttpRequestCache',
        indexedDBStoreName: 'responses',
        soundUrlFail: 'https://d35aaqx5ub95lt.cloudfront.net/sounds/f0b6ab4396d5891241ef4ca73b4de13a.mp3',
        soundUrlHard: 'https://d35aaqx5ub95lt.cloudfront.net/sounds/a28ff0a501ef5f33ca78c0afc45ee53e.mp3',
        soundUrlOkay: 'https://d35aaqx5ub95lt.cloudfront.net/sounds/37d8f0b39dcfe63872192c89653a93f6.mp3',
        soundUrlEasy: 'https://d35aaqx5ub95lt.cloudfront.net/sounds/2aae0ea735c8e9ed884107d6f0a09e35.mp3',
        soundUrlReveal: 'https://files.catbox.moe/hzxzzb.ogg',
        // lottieWebScript: 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js',
        lottieSparkles: [
            'https://d35aaqx5ub95lt.cloudfront.net/lottie/e13df96082d0e4dbc6d78b6f5346e2a2.json',
            'https://d35aaqx5ub95lt.cloudfront.net/lottie/b50a27f803ddd071fdbd83af2fc05c8a.json',
        ],
        lottieSmallFireworks: ['https://files.catbox.moe/1ggh8q.json', 'https://files.catbox.moe/5t0xm4.json'],
        lottieBigFireworks: ['https://files.catbox.moe/cb35i9.json'],
        lottieExplosions: ['https://d35aaqx5ub95lt.cloudfront.net/lottie/2a62162ea93d55dee67189cc47bd98ab.json'],
    };

    const DEBUG = {
        enableCacheLogs: false,
        enableProgress: GM_getValue('progress_enableProgress', false),
    };

    const TRANSLATIONS = {
        'None': {},
        'ja': {
            'Kanji': '漢字',
            'Type a word, a kanji, or a sentence': '単語、漢字、または文章を入力してください',
            'Settings': '設定',
            'Logout': 'ログアウト',
            'Stats': '統計',
            'Vocabulary': '単語',
            'Component': '部品',
            'Show answer': '答えを表示',
            '✘ Nothing': '✘ 全然',
            '✘ Something': '✘ 何か',
            '✔ Hard': '✔ 難しい',
            '✔ Okay': '✔ 大丈夫',
            '✔ Easy': '✔ 簡単',
            'Blacklist': 'ブラックリスト',
            "I'll never forget": '絶対に忘れない',
            'I know this, will never forget': '完全に覚えている、絶対に忘れない',
            'I know this, but may forget': '知っているが、忘れる可能性がある',
            "I don't know this": 'これは知らない',
            [String.raw`/^Words \((.*?)\)$/`]: '単語（{1}）', // works as well with normal strings, but then the backslashes need to be escaped as well (e.g. `/^Words \\((.*?)\\)$/`)
            [String.raw`/^Kanji \((.*?)\)$/`]: '漢字（{1}）',
            'Learn (': '学習 (',
            'Built-in decks': '内蔵デッキ',
            'Start reviewing': '復習を始める',
            'Welcome back!': 'お帰りなさい！',
            'Quiz': 'クイズ',
            'Leaderboard': 'リーダーボード',
            'Meanings': '意味',
            'config.reviewButtonFontWeight': '500',
        },
    };

    const createUserSettings = () => {
        const settings = {};
        settings.enableButtonStyling = new UserSetting(
            'enableButtonStyling',
            true,
            'Enable button styling',
            'Adds styling to the buttons on the review page.'
        );
        settings.enableButtonEffects = new UserSetting(
            'enableButtonEffects',
            true,
            'Enable button effects',
            '',
            null,
            0,
            1,
            settings.enableButtonStyling
        );
        settings.enableButtonSound = new UserSetting(
            'enableButtonSound',
            true,
            'Enable button audio',
            '',
            null,
            0,
            1,
            settings.enableButtonStyling
        );
        settings.buttonSoundVolume = new UserSetting(
            'buttonSoundVolume',
            0.7,
            'Button audio volume',
            '',
            null,
            0,
            1,
            settings.enableButtonSound
        );
        settings.buttonSoundDelay = new UserSetting(
            'buttonSoundDelay',
            -1,
            'Button audio delay',
            'The delay in milliseconds before the site redirects after a button starts playing a sound. Use -1 to automatically detect the delay. To disable the delay, enter a large negative number.',
            null,
            -99999,
            99999,
            settings.enableButtonSound
        );
        settings.enableReplaceKanjiStrokeOrder = new UserSetting(
            'enableReplaceKanjiStrokeOrder',
            true,
            'Enable replace kanji stroke order',
            'Replaces the stroke order with KanjiVG.'
        );
        settings.useFontInsteadOfSvg = new UserSetting(
            'useFontInsteadOfSvg',
            false,
            'Use font instead of SVG',
            'Use a font for the stroke order instead of an SVG.',
            null,
            0,
            1,
            settings.enableReplaceKanjiStrokeOrder
        );
        settings.enableSentenceBlur = new UserSetting(
            'enableSentenceBlur',
            true,
            'Blur sentence translation on the back of the card. Can be clicked to toggle blur.'
        );
        settings.enableVerticalSentence = new UserSetting('enableVerticalSentence', false, 'Display sentence vertically on the review card');
        settings.searchBarOverlayTransition = new UserSetting('searchBarOverlayTransition', false, 'Enable transition effect for the search overlay');
        settings.alwaysShowKanjiGrid = new UserSetting('alwaysShowKanjiGrid', true, 'Always show kanji grid');
        settings.enableMonolingualMachineTranslation = new UserSetting(
            'enableMonolingualMachineTranslation',
            true,
            'Enable machine translation for monolingual sentences',
            'Shows a placeholder sentence that can be clicked to translate the sentence using JPDBs machine translation.'
        );
        settings.translationLanguage = new UserSetting('translation', 'None', 'Enable partial translation', null, Object.keys(TRANSLATIONS));

        return settings;
    };

    const USER_SETTINGS = createUserSettings();

    const STYLES = {
        main: `
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
                --button-focused-border-color: var(--easy-button-color);
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
                right: 0;
                padding: 0;
                width: 5em !important;
                border: none;
                background-color: transparent;
                box-shadow: none;
                z-index: 2;
            }

            div:has(> input[type="search"]) {
                position: relative;
                z-index: 0;
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

            body > div.container.bugfix:has(a[href*="patreon.com"]):has(form[action*="/review#"]) > *:nth-child(n+6) {
                display: none !important;
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
                scale: 1.125;
                transform-origin: center center;
                overflow: visible;
            }

            /* Bigger scaling for search results */
            .vbox:has(> .kanji.plain) .kanji.plain > svg.stroke-order-kanji > g {
                scale: 1.3;
            }

            svg.stroke-order-kanji {
                overflow: visible;
            }

            /* Kanji copy button */
            .subsection-composed-of-kanji:has(> .subsection-label) > .subsection-label {
                align-items: center;
            }

            .kanji-copy-button {
                all: unset !important;
                margin-left: 0.5em !important;
                cursor: pointer !important;
                vertical-align: middle !important;
            }
        
            .kanji-copy-button-svg {
                fill: var(--subsection-label-color) !important;
                vertical-align: middle;
            }

            /* Remove shadow from review bar */
            .review-button-group {
                box-shadow: none !important;
            }

            .pending-translation {
                cursor: pointer;
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

        kanjiFontOverrideFallback: `
            svg.kanji > path {
                visibility: unset !important;
            }
        `,

        hideKanjiSvg: `
            /* Hide the original when using svg to prevent flickering */
            svg.kanji:not(.stroke-order-kanji) {
                display: none;
            }
        `,

        hideKanjiSvgOverrideFallback: `
            svg.kanji:not(.stroke-order-kanji) {
                display: unset !important;
            }
        `,

        kanjiGridOnHover: `
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
                bottom: 1.875%;
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
        `,

        kanjiGridAlways: `
            .vbox .kanji.plain {
                position: relative;
                display: inline-block;
            }

            /* Kanji Grid for review */
            .hbox:has(> .kanji.plain)::before {
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
            .vbox:has(> .kanji.plain) .kanji.plain::before {
                content: '';
                position: absolute;
                top: 0;
                bottom: 1.875%;
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
        `,

        sentenceBlur: `
            .sentence-translation {
                filter: blur(0.5rem);
                transition: filter 0.2s;
                cursor: pointer;
            }

            .unblur {
                filter: blur(0) !important;
            }
        `,

        verticalSentence: `
            .card-sentence {
                writing-mode: vertical-rl;
                text-orientation: upright;
                position: absolute;
                right: 1rem;
                height: 50vh;
                letter-spacing: 0.15rem;
            }
            .card-sentence:has(.icon-link) {
                transform: translateY(2rem);
            }
            .card-sentence .icon-link {
                position: absolute;
                transform: translateY(-2rem);
            }
            .card-sentence .icon-link:has(.ti-pencil) {
                position: absolute;
            }
            .card-sentence:has(.ti-volume) .icon-link:has(.ti-pencil) {
                right: 2.25rem;
            }

            .card-sentence:not(:has(.ti-volume)) .icon-link:has(.ti-pencil) {
                right: 0rem;
            }

            .card-sentence .sentence {
                text-align: unset;
                line-height: 2rem;
            }
        `,
    };

    function log(...args) {
        if (DEBUG.enableCacheLogs) {
            console.log(...args);
        }
    }

    async function httpRequest(
        url,
        cacheTimeSeconds = -1,
        allowStaleCache = false,
        allowAnyResponseCode = false,
        useIndexedDB = false,
        withCredentials = true,
        responseType = ''
    ) {
        if (
            typeof url !== 'string' ||
            typeof cacheTimeSeconds !== 'number' ||
            typeof allowStaleCache !== 'boolean' ||
            typeof allowAnyResponseCode !== 'boolean' ||
            typeof useIndexedDB !== 'boolean'
        ) {
            throw new TypeError('Invalid input types');
        }

        const cacheKey = `${CONFIG.cachePrefix}${url}`;
        const isCachingEnabled = cacheTimeSeconds > 0;

        const normalChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-_';

        function compressData(data) {
            const compressed = LZString.compressToBase64(JSON.stringify(data));
            return mapToNormalChars(compressed);
        }

        function decompressData(compressedData) {
            const unmapped = unmapFromNormalChars(compressedData);
            return JSON.parse(LZString.decompressFromBase64(unmapped));
        }

        function mapToNormalChars(input) {
            return input
                .split('')
                .map((char) => {
                    const index = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.indexOf(char);
                    return normalChars[index] || char;
                })
                .join('');
        }

        function unmapFromNormalChars(input) {
            return input
                .split('')
                .map((char) => {
                    const index = normalChars.indexOf(char);
                    return index !== -1 ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='[index] : char;
                })
                .join('');
        }

        async function blobToBase64(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        function base64ToBlob(base64, type = 'application/octet-stream') {
            const binStr = atob(base64);
            const len = binStr.length;
            const arr = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                arr[i] = binStr.charCodeAt(i);
            }
            return new Blob([arr], { type: type });
        }

        async function getCachedData() {
            if (useIndexedDB) {
                return new Promise((resolve) => {
                    const request = indexedDB.open(CONFIG.indexedDBName, 1);
                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        db.createObjectStore(CONFIG.indexedDBStoreName, { keyPath: 'key' });
                    };
                    request.onsuccess = (event) => {
                        const db = event.target.result;
                        const transaction = db.transaction([CONFIG.indexedDBStoreName], 'readonly');
                        const store = transaction.objectStore(CONFIG.indexedDBStoreName);
                        const getRequest = store.get(cacheKey);
                        getRequest.onsuccess = () => {
                            if (!getRequest.result) {
                                resolve(null);
                                return;
                            }
                            const cachedData = decompressData(getRequest.result.value);
                            const { timestamp, response } = cachedData;
                            const cacheAge = (Date.now() - timestamp) / 1000;
                            const isStale = cacheAge > cacheTimeSeconds;
                            resolve({ isStale, response, source: 'IndexedDB' });
                        };
                        getRequest.onerror = () => resolve(null);
                    };
                    request.onerror = () => resolve(null);
                });
            } else {
                const compressedCachedData = await GM_getValue(cacheKey);
                if (!compressedCachedData) return null;
                const cachedData = decompressData(compressedCachedData);
                const { timestamp, response } = cachedData;
                const cacheAge = (Date.now() - timestamp) / 1000;
                const isStale = cacheAge > cacheTimeSeconds;
                return { isStale, response, source: 'GM Storage' };
            }
        }

        async function cacheResponse(response) {
            let responseToCache = response;
            if (responseType === 'blob' && response.response instanceof Blob) {
                responseToCache = { ...response };
                responseToCache.response = await blobToBase64(response.response);
                responseToCache.isBlob = true;
            }
            const cacheData = {
                timestamp: Date.now(),
                response: responseToCache,
            };
            const compressedCacheData = compressData(cacheData);

            if (useIndexedDB) {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open(CONFIG.indexedDBName, 1);
                    request.onsuccess = (event) => {
                        const db = event.target.result;
                        const transaction = db.transaction([CONFIG.indexedDBStoreName], 'readwrite');
                        const store = transaction.objectStore(CONFIG.indexedDBStoreName);
                        const putRequest = store.put({ key: cacheKey, value: compressedCacheData });
                        putRequest.onsuccess = () => resolve();
                        putRequest.onerror = () => reject(putRequest.error);
                    };
                    request.onerror = () => reject(request.error);
                });
            } else {
                await GM_setValue(cacheKey, compressedCacheData);
            }
        }

        async function makeRequest() {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    nocache: true,
                    withCredentials: withCredentials,
                    responseType: responseType,
                    onload: async function (response) {
                        if (isCachingEnabled) {
                            await cacheResponse(response);
                        }
                        resolve(response);
                    },
                    onerror: reject,
                });
            });
        }

        function handleResponse(response, source = 'Network') {
            if (response.status !== 200) {
                throw new Error(`Requesting ${url} failed with status: ${response.status}`);
            }
            log(`Response retrieved from: ${source}`);
            if (responseType === 'blob' && response.isBlob) {
                response.response = base64ToBlob(response.response, response.responseHeaders['content-type']);
            }
            return response;
        }

        if (isCachingEnabled) {
            const cachedResult = await getCachedData();
            if (cachedResult) {
                const { isStale, response, source } = cachedResult;

                if (!isStale && (response.status === 200 || allowAnyResponseCode)) {
                    log(`Using fresh cached response from ${source}`);
                    return handleResponse(response, source);
                }

                if (isStale && allowStaleCache && (response.status === 200 || allowAnyResponseCode)) {
                    log(`Using stale cached response from ${source} and updating in background`);
                    makeRequest().catch(() => {});
                    return handleResponse(response, `${source} (stale)`);
                }
            }
        }

        log('Fetching fresh response from network');
        const response = await makeRequest();
        return handleResponse(response);
    }

    async function loadScript(url) {
        const response = await httpRequest(url, 12 * 60 * 60, true);
        if (response.status !== 200) {
            throw new Error(`Failed to load script: ${response.status}`);
        }
        const script = document.createElement('script');
        script.textContent = response.responseText;
        document.body.appendChild(script);
    }

    function purgeHttpRequestCache() {
        return new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(CONFIG.indexedDBName);

            deleteRequest.onerror = (event) => {
                console.error(`Error deleting database ${CONFIG.indexedDBName}:`, event.target.error);
                reject(event.target.error);
            };

            deleteRequest.onsuccess = (event) => {
                console.log(`Database ${CONFIG.indexedDBName} successfully deleted`);
                resolve();
            };

            deleteRequest.onblocked = (event) => {
                console.warn(`Database ${CONFIG.indexedDBName} deletion blocked. Please close all other tabs with this site open.`);
            };
        });
    }

    function removeAllGMValues() {
        const keys = GM_listValues();
        keys.forEach((key) => {
            GM_deleteValue(key);
        });

        function verifyDeletion() {
            const remainingKeys = GM_listValues();
            return remainingKeys.length === 0;
        }

        return verifyDeletion();
    }

    function applyStyles() {
        GM_addStyle(STYLES.main);
        if (USER_SETTINGS.enableButtonStyling()) {
            GM_addStyle(STYLES.button);
        }
        if (USER_SETTINGS.alwaysShowKanjiGrid()) {
            GM_addStyle(STYLES.kanjiGridAlways);
        } else {
            GM_addStyle(STYLES.kanjiGridOnHover);
        }
        if (USER_SETTINGS.enableReplaceKanjiStrokeOrder() && USER_SETTINGS.useFontInsteadOfSvg()) {
            GM_addStyle(STYLES.kanjiFont);
        }
        if (USER_SETTINGS.enableReplaceKanjiStrokeOrder() && !USER_SETTINGS.useFontInsteadOfSvg()) {
            GM_addStyle(STYLES.hideKanjiSvg);
        }
    }

    async function injectFont() {
        // Inject Manrope main font
        const fontUrl = 'https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap';
        const fontStyles = await httpRequest(fontUrl, 24 * 60 * 60);
        if (fontStyles) {
            GM_addStyle(fontStyles.responseText);
        }

        // Inject Noto Sans JP for review buttons
        if (USER_SETTINGS.enableButtonStyling() && TRANSLATIONS[USER_SETTINGS.translationLanguage()]['config.reviewButtonFontWeight']) {
            const fontUrl = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap';
            const fontStyles = await httpRequest(fontUrl, 24 * 60 * 60);
            if (fontStyles) {
                GM_addStyle(fontStyles.responseText);
                GM_addStyle(`
                    .review-button-group input[type="submit"] {
                        font-family: 'Noto Sans JP', sans-serif;
                        font-weight: ${TRANSLATIONS[USER_SETTINGS.translationLanguage()]['config.reviewButtonFontWeight']} !important;
                    }
                `);
            }
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
                newDeckList.querySelectorAll('input[name="origin"]').forEach((input) => {
                    input.value = new URL(window.location.href).pathname;
                });

                const currentDeckList = document.querySelector(CONFIG.deckListSelector);
                if (currentDeckList) {
                    const clonedDeckList = newDeckList.cloneNode(true);
                    clonedDeckList.classList.add(CONFIG.newDeckListClass);
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

    async function playButtonSound(button) {
        let soundUrl;
        if (button.classList.contains('v1')) {
            soundUrl = CONFIG.soundUrlFail;
        } else if (button.classList.contains('v3')) {
            soundUrl = CONFIG.soundUrlHard;
        } else if (button.classList.contains('v4')) {
            soundUrl = CONFIG.soundUrlOkay;
        } else if (button.classList.contains('outline')) {
            soundUrl = CONFIG.soundUrlEasy;
        }

        if (soundUrl) {
            const audioBlob = await httpRequest(soundUrl, 30 * 24 * 60 * 60, false, true, true, true, 'blob');
            const audioUrl = URL.createObjectURL(audioBlob.response);
            const audio = new Audio(audioUrl);
            audio.volume = USER_SETTINGS.buttonSoundVolume();
            await new Promise((resolve) => {
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };
                audio.onloadedmetadata = () => {
                    const duration = audio.duration;
                    const timeToWait = Math.max(duration - 0.5, 0) * 1000;
                    setTimeout(() => {
                        URL.revokeObjectURL(audioUrl);
                        resolve();
                    }, timeToWait);
                };
                audio.play().catch(() => {
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                });
            });
        }
    }

    // Function to load the animation
    function loadLottieAnimation(animationData) {
        if (!animationData) {
            console.error('Animation data is null or undefined');
            return null;
        }

        try {
            const animationConfig = {
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: animationData,
            };

            return animationConfig;
        } catch (error) {
            console.error('Error preparing animation:', error);
            return null;
        }
    }

    // Function to play the animation
    function playLottieAnimation(targetElement, loadedAnimation, options = {}) {
        if (!targetElement || !loadedAnimation) {
            console.error('Target element or loaded animation is null or undefined');
            return null;
        }

        const defaultOptions = {
            loop: false,
            autoplay: true,
            speed: 1,
            size: { width: 100, height: 100 },
            opacity: 1,
            playBehind: false,
            rotation: 0,
        };

        const animOptions = { ...defaultOptions, ...options };

        const lottieContainer = document.createElement('div');
        lottieContainer.style.position = 'absolute';
        lottieContainer.style.pointerEvents = 'none';
        lottieContainer.style.display = 'flex';
        lottieContainer.style.justifyContent = 'center';
        lottieContainer.style.alignItems = 'center';

        const rect = targetElement.getBoundingClientRect();
        animOptions.size = animOptions.size || { width: rect.width, height: rect.height };

        const updatePosition = () => {
            if (animOptions.playBehind) {
                const targetRect = targetElement.getBoundingClientRect();
                lottieContainer.style.width = targetRect.width + 'px';
                lottieContainer.style.height = targetRect.height + 'px';
                lottieContainer.style.left = '0';
                lottieContainer.style.top = '0';
            } else {
                lottieContainer.style.width = animOptions.size.width + 'px';
                lottieContainer.style.height = animOptions.size.height + 'px';
                const rect = targetElement.getBoundingClientRect();
                const targetWidth = rect.width;
                const targetHeight = rect.height;
                const containerWidth = lottieContainer.offsetWidth;
                const containerHeight = lottieContainer.offsetHeight;

                const left = rect.left + (targetWidth - containerWidth) / 2;
                const top = rect.top + (targetHeight - containerHeight) / 2;

                lottieContainer.style.left = left + 'px';
                lottieContainer.style.top = top + 'px';
            }
        };

        lottieContainer.style.opacity = animOptions.opacity;
        lottieContainer.style.transform = `rotate(${animOptions.rotation}deg)`;

        const targetPosition = window.getComputedStyle(targetElement).position;
        if (targetPosition === 'static') {
            targetElement.style.position = 'relative';
        }

        if (animOptions.playBehind) {
            targetElement.parentNode.insertBefore(lottieContainer, targetElement);
        } else {
            document.body.appendChild(lottieContainer);
            lottieContainer.style.position = 'fixed';
            lottieContainer.style.zIndex = '9999';
        }

        updatePosition();

        try {
            const anim = lottie.loadAnimation({
                ...loadedAnimation,
                container: lottieContainer,
                loop: animOptions.loop,
                autoplay: animOptions.autoplay,
            });

            anim.setSpeed(animOptions.speed);

            if (animOptions.playBehind) {
                anim.resize();
            }

            anim.addEventListener('complete', () => {
                if (!animOptions.loop) {
                    lottieContainer.remove();
                    if (targetPosition === 'static') {
                        targetElement.style.position = '';
                    }
                }
            });

            if (!animOptions.playBehind) {
                window.addEventListener('scroll', updatePosition);
                window.addEventListener('resize', updatePosition);
            }

            if (animOptions.autoplay) {
                anim.play();
            }

            return anim;
        } catch (error) {
            console.error('Error loading animation:', error);
            return null;
        }
    }

    async function playEffect(button) {
        if (button.classList.contains('v1')) {
            return;
        }
        const answerBox = document.querySelector('.answer-box');
        const target = answerBox || document.querySelector('.result.kanji')?.querySelector('.plain').firstElementChild;
        const rect = target.getBoundingClientRect();

        if (target) {
            playLottieAnimation(target, WARM['smallFireworkAnimation'], {
                loop: false,
                autoplay: true,
                renderer: 'svg',
                size: { width: rect.height * 3, height: rect.height },
                opacity: 0.5,
            });
            playLottieAnimation(target, WARM['bigFireworkAnimation'], {
                loop: false,
                autoplay: true,
                renderer: 'svg',
                size: { width: rect.height * 3, height: rect.height },
                opacity: 0.5,
            });

            // const html = document.querySelector('html');
            // const backgroundFirework =  CONFIG.lottieSmallFireworks[1];
            // const backgroundFireworkJson = await JSON.parse((await httpRequest(backgroundFirework, 30 * 24 * 60 * 60, true)).responseText);
            // for (let i = 0; i < 2; i++) {
            //     playLottieAnimation(html, backgroundFireworkJson, { loop: false, autoplay: true, renderer: 'svg', rotation: Math.random() * 360, opacity: 0.025});
            // }
            // for (let i = 0; i < 1; i++) {
            //     playLottieAnimation(html, smallFireworkJson, { loop: false, autoplay: true, renderer: 'svg', rotation: Math.random() * 360, opacity: 0.025});
            // }
        }
        playLottieAnimation(button, WARM['sparkleAnimation'], { loop: false, autoplay: true, renderer: 'svg', speed: 1.5 });
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
            click: async (event) => {
                if (!document.querySelector('.review-reveal')) {
                    return;
                }
                event.preventDefault();
                if (USER_SETTINGS.enableButtonEffects()) {
                    playEffect(button);
                }

                if (USER_SETTINGS.enableButtonSound()) {
                    await playButtonSound(button);
                }
                const form = button.closest('form');
                if (form) {
                    form.submit();
                }
            },
        };

        Object.entries(buttonEvents).forEach(([event, handler]) => {
            button.addEventListener(event, handler);
        });

        // warm up caches for effects and audio
        if (USER_SETTINGS.enableButtonEffects()) {
            async function warmUpEffects() {
                // If the function is already running, return the existing promise
                if (STATE.warmingEffectsPromise) {
                    return STATE.warmingEffectsPromise;
                }

                // Create a new promise for this execution
                STATE.warmingEffectsPromise = (async () => {
                    try {
                        if (!WARM['smallFireworkAnimation']) {
                            const smallFirework = CONFIG.lottieSmallFireworks[0];
                            const smallFireworkJson = await JSON.parse(
                                (
                                    await httpRequest(smallFirework, 30 * 24 * 60 * 60, true, false, true)
                                ).responseText
                            );
                            WARM['smallFireworkAnimation'] = loadLottieAnimation(smallFireworkJson);
                        }

                        if (!WARM['bigFireworkAnimation']) {
                            const bigFirework = CONFIG.lottieBigFireworks[0];
                            const bigFireworkJson = await JSON.parse(
                                (
                                    await httpRequest(bigFirework, 30 * 24 * 60 * 60, true, false, true)
                                ).responseText
                            );
                            WARM['bigFireworkAnimation'] = loadLottieAnimation(bigFireworkJson);
                        }

                        if (!WARM['sparkleAnimation']) {
                            const randomSparkle = CONFIG.lottieSparkles[0];
                            const sparkleJson = await JSON.parse(
                                (
                                    await httpRequest(randomSparkle, 30 * 24 * 60 * 60, true, false, true)
                                ).responseText
                            );
                            WARM['sparkleAnimation'] = loadLottieAnimation(sparkleJson);
                        }

                        if (!WARM['explosionAnimation']) {
                            const explosion = CONFIG.lottieExplosions[0];
                            const explosionJson = await JSON.parse(
                                (
                                    await httpRequest(explosion, 30 * 24 * 60 * 60, true, false, true)
                                ).responseText
                            );
                            WARM['explosionAnimation'] = loadLottieAnimation(explosionJson);
                        }
                    } finally {
                        // Reset the promise when done, allowing future calls to run
                        STATE.warmingEffectsPromise = null;
                    }
                })();

                return STATE.warmingEffectsPromise;
            }

            warmUpEffects().then(() => {
                // check if url has "review?c=" in it
                if (window.location.href.includes('review?c=')) {
                    function revealEffect() {
                        if (STATE.revealEffectPlayed) {
                            return;
                        }

                        let target =
                            document.querySelector('.answer-box') ||
                            document.querySelector('.result.kanji')?.querySelector('.stroke-order-kanji') ||
                            document.querySelector('.result.kanji')?.querySelector('.kanji-font');

                        if (!USER_SETTINGS.enableReplaceKanjiStrokeOrder() && !target) {
                            target = document.querySelector('.result.kanji')?.querySelector('.plain').firstElementChild;
                        }

                        if (target) {
                            STATE.revealEffectPlayed = true;

                            // Play reveal audio effect
                            if (USER_SETTINGS.enableButtonSound()) {
                                async function playRevealSound() {
                                    const audio = await httpRequest(
                                        CONFIG.soundUrlReveal,
                                        30 * 24 * 60 * 60,
                                        false,
                                        true,
                                        true,
                                        true,
                                        'blob'
                                    );
                                    const audioUrl = URL.createObjectURL(audio.response);
                                    const audioElement = new Audio(audioUrl);
                                    audioElement.volume = USER_SETTINGS.buttonSoundVolume();
                                    audioElement.play().catch((error) => {
                                        console.error('Error playing reveal sound:', error);
                                    });
                                }
                                playRevealSound();
                            }

                            const rect = target.getBoundingClientRect();
                            playLottieAnimation(target, WARM['explosionAnimation'], {
                                loop: false,
                                autoplay: true,
                                renderer: 'svg',
                                speed: 1.5,
                                size: { width: rect.width, height: rect.height },
                                opacity: 0.5,
                            });
                            playLottieAnimation(target, WARM['bigFireworkAnimation'], {
                                loop: false,
                                autoplay: true,
                                renderer: 'svg',
                                speed: 1.5,
                                size: { width: rect.width, height: rect.height },
                                opacity: 0.5,
                            });
                            return true;
                        }
                        return false;
                    }

                    const observer = new MutationObserver(() => {
                        if (revealEffect()) {
                            observer.disconnect();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });

                    revealEffect();
                }
            });
        }
    }

    function styleReviewButtons() {
        document.querySelectorAll(CONFIG.reviewButtonSelector).forEach(styleButton);
    }

    // prettier-ignore
    const unicodeSet = new Set(['00000','00020','00021','00022','00023','00024','00025','00026','00027','00028','00029','0002a','0002b','0002c','0002d','0002e','0002f','00030','00031','00032','00033','00034','00035','00036','00037','00038','00039','0003a','0003b','0003c','0003d','0003e','0003f','00040','00041','00042','00043','00044','00045','00046','00047','00048','00049','0004a','0004b','0004c','0004d','0004e','0004f','00050','00051','00052','00053','00054','00055','00056','00057','00058','00059','0005a','0005b','0005c','0005d','0005e','0005f','00060','00061','00062','00063','00064','00065','00066','00067','00068','00069','0006a','0006b','0006c','0006d','0006e','0006f','00070','00071','00072','00073','00074','00075','00076','00077','00078','00079','0007a','0007b','0007c','0007d','0007e','000a0','000a1','000a2','000a3','000a4','000a5','000a6','000a7','000a8','000a9','000aa','000ab','000ac','000ad','000ae','000af','000b0','000b1','000b2','000b3','000b4','000b5','000b6','000b7','000b8','000b9','000ba','000bb','000bc','000bd','000be','000bf','000c0','000c1','000c2','000c3','000c4','000c5','000c6','000c7','000c8','000c9','000ca','000cb','000cc','000cd','000ce','000cf','000d0','000d1','000d2','000d3','000d4','000d5','000d6','000d7','000d8','000d9','000da','000db','000dc','000dd','000de','000df','000e0','000e1','000e2','000e3','000e4','000e5','000e6','000e7','000e8','000e9','000ea','000eb','000ec','000ed','000ee','000ef','000f0','000f1','000f2','000f3','000f4','000f5','000f6','000f7','000f8','000f9','000fa','000fb','000fc','000fd','000fe','000ff','00100','00101','00102','00103','00104','00105','00106','00107','00108','00109','0010a','0010b','0010c','0010d','0010e','0010f','00112','00113','00114','00115','00116','00117','00118','00119','0011a','0011b','0011c','0011d','0011e','0011f','00120','00121','00122','00124','00125','00126','00127','00128','00129','0012a','0012b','0012c','0012d','0012e','0012f','00130','00131','00132','00133','00134','00135','00136','00137','00138','00139','0013a','0013b','0013c','0013d','0013e','0013f','00140','00141','00142','00143','00144','00145','00146','00147','00148','00149','0014c','0014d','0014e','0014f','00150','00151','00152','00153','00154','00155','00156','00157','00158','00159','0015a','0015b','0015c','0015d','0015e','0015f','00160','00161','00162','00163','00164','00165','00168','00169','0016a','0016b','0016c','0016d','0016e','0016f','00170','00171','00172','00173','00174','00175','00176','00177','00178','00179','0017a','0017b','0017c','0017d','0017e','00186','00189','0018e','0018f','00190','00194','0019c','0019e','0019f','001c0','001c1','001c2','001c3','001cd','001ce','001cf','001d0','001d1','001d2','001d3','001d4','001dd','001e2','001e3','001e6','001e7','001e8','001e9','001ea','001eb','001ec','001ed','001f0','001f4','001f5','001f8','001f9','001fc','001fd','001fe','001ff','00200','00201','00202','00203','00204','00205','00206','00207','00208','00209','0020a','0020b','0020c','0020d','0020e','0020f','00210','00211','00212','00213','00214','00215','00216','00217','00218','00219','0021a','0021b','0021e','0021f','00220','00222','00223','00226','00227','00228','00229','0022e','0022f','00230','00231','00232','00233','00237','00250','00251','00252','00254','00258','00259','0025b','0025c','00262','00263','00265','00268','0026a','0026b','0026f','00270','00274','00280','0028f','00299','0029c','0029f','002bb','002bc','002bd','002c6','002c7','002c9','002ca','002cb','002d8','002d9','002da','002db','002dc','002dd','002df','002ee','002f5','0030c','0030f','00327','00391','00392','00393','00394','00395','00396','00397','00398','00399','0039a','0039b','0039c','0039d','0039e','0039f','003a0','003a1','003a3','003a4','003a5','003a6','003a7','003a8','003a9','003aa','003ab','003ac','003ad','003ae','003af','003b0','003b1','003b2','003b3','003b4','003b5','003b6','003b7','003b8','003b9','003ba','003bb','003bc','003bd','003be','003bf','003c0','003c1','003c2','003c3','003c4','003c5','003c6','003c7','003c8','003c9','003ca','003cb','00400','00401','00402','00403','00404','00405','00406','00407','00408','00409','0040a','0040b','0040d','0040e','0040f','00410','00411','00412','00413','00414','00415','00416','00417','00418','00419','0041a','0041b','0041c','0041d','0041e','0041f','00420','00421','00422','00423','00424','00425','00426','00427','00428','00429','0042a','0042b','0042c','0042d','0042e','0042f','00430','00431','00432','00433','00434','00435','00436','00437','00438','00439','0043a','0043b','0043c','0043d','0043e','0043f','00440','00441','00442','00443','00444','00445','00446','00447','00448','00449','0044a','0044b','0044c','0044d','0044e','0044f','00450','00451','00452','00453','00454','00455','00456','00457','00458','00459','0045a','0045b','0045c','0045d','0045e','0045f','00460','00461','0058f','01d00','01d04','01d05','01d07','01d0a','01d0b','01d0d','01d0e','01d0f','01d18','01d1b','01d1c','01d20','01d21','01d22','02010','02011','02012','02013','02014','02015','02016','02018','02019','0201a','0201b','0201c','0201d','0201e','0201f','02020','02021','02022','02023','02024','02025','02026','02030','02031','02032','02033','02034','02035','02036','02037','02038','02039','0203a','0203b','0203c','0203d','0203e','02047','02048','02049','0204b','020a4','020a9','020ac','020b9','020ba','02100','02101','02103','02104','02105','02106','02109','02116','02117','02120','02121','02122','02126','02127','0212a','0212b','02132','0213a','0213b','02141','02142','02143','02144','0214b','0214d','0214e','02150','02151','02152','02153','02154','02155','02156','02157','02158','02159','0215a','0215b','0215c','0215d','0215e','0215f','02160','02161','02162','02163','02164','02165','02166','02167','02168','02169','0216a','0216b','0216c','0216d','0216e','0216f','02170','02171','02172','02173','02174','02175','02176','02177','02178','02179','0217a','0217b','0217c','0217d','0217e','0217f','02180','02181','02182','02183','02184','02185','02186','02187','02188','02189','02190','02191','02192','02193','02196','02197','02198','02199','021a4','021a5','021a6','021a7','021bc','021bd','021be','021bf','021c0','021c1','021c2','021c3','021c4','021c5','021c6','021c7','021c8','021c9','021ca','021cb','021cc','021d2','021d3','021d4','021d5','021d6','021d7','021d8','021d9','02200','02202','02203','02204','02206','02207','02208','0220a','0220b','0220d','0220e','02212','02213','02217','0221a','0221d','0221e','0221f','02220','02225','02227','02228','02229','0222a','0222b','0222c','0222d','02234','02235','02236','02237','0223d','02248','02250','02251','02252','02253','02254','02255','02260','02261','02262','02263','02264','02265','02266','02267','02268','02269','0226a','0226b','02282','02283','02286','02287','022a2','022a3','022a4','022a5','02312','02313','02319','0231c','0231d','0231e','0231f','023fb','023fc','023fd','023fe','02400','02401','02402','02403','02404','02405','02406','02407','02408','02409','0240a','0240b','0240c','0240d','0240e','0240f','02410','02411','02412','02413','02414','02415','02416','02417','02418','02419','0241a','0241b','0241c','0241d','0241e','0241f','02420','02421','02422','02423','02424','02425','02426','02460','02461','02462','02463','02464','02465','02466','02467','02468','02469','0246a','0246b','0246c','0246d','0246e','0246f','02470','02471','02472','02473','02474','02475','02476','02477','02478','02479','0247a','0247b','0247c','0247d','0247e','0247f','02480','02481','02482','02483','02484','02485','02486','02487','02488','02489','0248a','0248b','0248c','0248d','0248e','0248f','02490','02491','02492','02493','02494','02495','02496','02497','02498','02499','0249a','0249b','0249c','0249d','0249e','0249f','024a0','024a1','024a2','024a3','024a4','024a5','024a6','024a7','024a8','024a9','024aa','024ab','024ac','024ad','024ae','024af','024b0','024b1','024b2','024b3','024b4','024b5','024b6','024b7','024b8','024b9','024ba','024bb','024bc','024bd','024be','024bf','024c0','024c1','024c2','024c3','024c4','024c5','024c6','024c7','024c8','024c9','024ca','024cb','024cc','024cd','024ce','024cf','024d0','024d1','024d2','024d3','024d4','024d5','024d6','024d7','024d8','024d9','024da','024db','024dc','024dd','024de','024df','024e0','024e1','024e2','024e3','024e4','024e5','024e6','024e7','024e8','024e9','024ea','024eb','024ec','024ed','024ee','024ef','024f0','024f1','024f2','024f3','024f4','024f5','024f6','024f7','024f8','024f9','024fa','024fb','024fc','024fd','024fe','024ff','02500','02501','02502','02503','02504','02505','02506','02507','02508','02509','0250a','0250b','0250c','0250d','0250e','0250f','02510','02511','02512','02513','02514','02515','02516','02517','02518','02519','0251a','0251b','0251c','0251d','0251e','0251f','02520','02521','02522','02523','02524','02525','02526','02527','02528','02529','0252a','0252b','0252c','0252d','0252e','0252f','02530','02531','02532','02533','02534','02535','02536','02537','02538','02539','0253a','0253b','0253c','0253d','0253e','0253f','02540','02541','02542','02543','02544','02545','02546','02547','02548','02549','0254a','0254b','0254c','0254d','0254e','0254f','025a0','025a1','025a3','025aa','025ab','025ac','025ad','025ae','025af','025b0','025b1','025b2','025b3','025b4','025b5','025b6','025b7','025b8','025b9','025ba','025bb','025bc','025bd','025be','025bf','025c0','025c1','025c2','025c3','025c4','025c5','025c6','025c7','025c8','025c9','025ca','025cb','025ce','025cf','025d0','025d1','025d2','025d3','025d6','025d7','025dc','025dd','025de','025df','025e0','025e1','025e2','025e3','025e4','025e5','025e6','025ef','02602','02605','02606','02610','02611','02614','02621','0262d','02639','0263a','0263b','0263c','0263d','0263e','02640','02641','02642','02654','02655','02656','02657','02658','02659','0265a','0265b','0265c','0265d','0265e','0265f','02660','02661','02662','02663','02664','02665','02666','02667','02668','02669','0266a','0266b','0266c','0266d','0266e','0266f','02690','02691','026a0','026a1','026ad','026ae','026af','02776','02777','02778','02779','0277a','0277b','0277c','0277d','0277e','0277f','02780','02781','02782','02783','02784','02785','02786','02787','02788','02789','0278a','0278b','0278c','0278d','0278e','0278f','02790','02791','02792','02793','02b58','02e2e','02e84','02e8c','02e8d','02e95','02e97','02e99','02ea1','02ea4','02ea6','02ea7','02ea8','02ea9','02eaa','02eac','02eae','02eb6','02eb7','02eba','02ebb','02ebc','02eca','02ecc','02ecf','02ed6','02ed7','02f21','03000','03001','03002','03003','03004','03005','03006','03007','03008','03009','0300a','0300b','0300c','0300d','0300e','0300f','03010','03011','03012','03013','03014','03015','03016','03017','03018','03019','0301a','0301b','0301c','0301d','0301e','0301f','03020','03030','03031','03032','03033','03034','03035','03036','03037','03038','03039','0303a','0303b','0303c','0303d','0303e','0303f','03040','03041','03042','03043','03044','03045','03046','03047','03048','03049','0304a','0304b','0304c','0304d','0304e','0304f','03050','03051','03052','03053','03054','03055','03056','03057','03058','03059','0305a','0305b','0305c','0305d','0305e','0305f','03060','03061','03062','03063','03064','03065','03066','03067','03068','03069','0306a','0306b','0306c','0306d','0306e','0306f','03070','03071','03072','03073','03074','03075','03076','03077','03078','03079','0307a','0307b','0307c','0307d','0307e','0307f','03080','03081','03082','03083','03084','03085','03086','03087','03088','03089','0308a','0308b','0308c','0308d','0308e','0308f','03090','03091','03092','03093','03094','03095','03096','0309b','0309c','0309d','0309e','030a0','030a1','030a2','030a3','030a4','030a5','030a6','030a7','030a8','030a9','030aa','030ab','030ac','030ad','030ae','030af','030b0','030b1','030b2','030b3','030b4','030b5','030b6','030b7','030b8','030b9','030ba','030bb','030bc','030bd','030be','030bf','030c0','030c1','030c2','030c3','030c4','030c5','030c6','030c7','030c8','030c9','030ca','030cb','030cc','030cd','030ce','030cf','030d0','030d1','030d2','030d3','030d4','030d5','030d6','030d7','030d8','030d9','030da','030db','030dc','030dd','030de','030df','030e0','030e1','030e2','030e3','030e4','030e5','030e6','030e7','030e8','030e9','030ea','030eb','030ec','030ed','030ee','030ef','030f0','030f1','030f2','030f3','030f4','030f5','030f6','030f7','030f8','030f9','030fa','030fb','030fc','030fd','030fe','031c0','031c1','031c2','031c3','031c4','031c5','031c6','031c7','031c8','031c9','031ca','031cb','031cc','031cd','031ce','031cf','031d0','031d1','031d2','031d3','031d4','031d5','031d6','031d7','031d8','031d9','031da','031db','031dc','031dd','031de','031df','031e0','031e1','031e2','031e3','03250','0327f','032cf','0342c','034b5','034c1','03514','0353e','038fa','041f3','04e00','04e01','04e02','04e03','04e04','04e05','04e07','04e08','04e09','04e0a','04e0b','04e0c','04e0d','04e0e','04e10','04e11','04e14','04e15','04e16','04e17','04e18','04e19','04e1e','04e21','04e26','04e28','04e29','04e2a','04e2c','04e2d','04e31','04e32','04e36','04e37','04e38','04e39','04e3b','04e3c','04e3f','04e40','04e41','04e42','04e43','04e44','04e45','04e47','04e4b','04e4d','04e4e','04e4f','04e55','04e56','04e57','04e58','04e59','04e5a','04e5d','04e5e','04e5f','04e61','04e62','04e71','04e73','04e7e','04e80','04e82','04e85','04e86','04e88','04e89','04e8a','04e8b','04e8c','04e8d','04e8e','04e91','04e92','04e94','04e95','04e96','04e98','04e99','04e9b','04e9c','04e9e','04e9f','04ea0','04ea1','04ea2','04ea4','04ea5','04ea6','04ea8','04eab','04eac','04ead','04eae','04eb0','04eb3','04eb6','04eba','04ebb','04ec0','04ec1','04ec2','04ec4','04ec6','04ec7','04eca','04ecb','04ecd','04ece','04ecf','04ed4','04ed5','04ed6','04ed7','04ed8','04ed9','04edd','04ede','04edf','04ee3','04ee4','04ee5','04eed','04eee','04ef0','04ef2','04ef6','04ef7','04efb','04f01','04f09','04f0a','04f0d','04f0e','04f0f','04f10','04f11','04f1a','04f1c','04f1d','04f2f','04f30','04f34','04f36','04f38','04f3a','04f3c','04f3d','04f43','04f46','04f47','04f4d','04f4e','04f4f','04f50','04f51','04f53','04f55','04f57','04f59','04f5a','04f5b','04f5c','04f5d','04f5e','04f69','04f6f','04f70','04f73','04f75','04f76','04f7b','04f7c','04f7f','04f83','04f86','04f88','04f8b','04f8d','04f8f','04f91','04f96','04f98','04f9b','04f9d','04fa0','04fa1','04fab','04fad','04fae','04faf','04fb5','04fb6','04fbf','04fc2','04fc3','04fc4','04fca','04fce','04fd0','04fd1','04fd4','04fd7','04fd8','04fda','04fdb','04fdd','04fdf','04fe0','04fe1','04fe3','04fe4','04fe5','04fee','04fef','04ff1','04ff3','04ff5','04ff6','04ff8','04ffa','04ffe','05005','05006','05009','0500b','0500d','0500f','05011','05012','05014','05016','05019','0501a','0501f','05020','05021','05023','05024','05025','05026','05028','05029','0502a','0502b','0502c','0502d','05036','05039','05043','05047','05048','05049','0504f','05050','05055','05056','0505a','0505c','05065','0506c','05072','05074','05075','05076','05078','0507d','05080','05085','0508d','05091','05098','05099','0509a','050ac','050ad','050b2','050b3','050b4','050b5','050b7','050be','050c2','050c5','050c9','050ca','050cd','050cf','050d1','050d5','050d6','050da','050de','050e3','050e5','050e7','050ed','050ee','050f5','050f9','050fb','05100','05101','05102','05104','05109','05112','05114','05115','05116','05118','0511a','0511f','05121','0512a','05132','05137','0513a','0513b','0513c','0513f','05140','05141','05143','05144','05145','05146','05147','05148','05149','0514b','0514c','0514d','0514e','05150','05152','05154','0515a','0515c','05162','05165','05168','05169','0516a','0516b','0516c','0516d','0516e','05171','05173','05175','05176','05177','05178','0517c','05180','05182','05185','05186','05189','0518a','0518c','0518d','0518f','05190','05191','05192','05193','05195','05196','05197','05199','051a0','051a2','051a4','051a5','051a6','051a8','051a9','051aa','051ab','051ac','051b0','051b1','051b2','051b3','051b4','051b5','051b6','051b7','051bd','051c4','051c5','051c6','051c9','051cb','051cc','051cd','051d6','051db','051dc','051dd','051e0','051e1','051e6','051e7','051e9','051ea','051ed','051f0','051f1','051f5','051f6','051f8','051f9','051fa','051fd','051fe','05200','05202','05203','05204','05206','05207','05208','0520a','0520b','0520e','05211','05214','05217','0521d','05224','05225','05227','05229','0522a','0522e','05230','05233','05236','05237','05238','05239','0523a','0523b','05243','05244','05247','0524a','0524b','0524c','0524d','0524f','05254','05256','0525b','0525d','0525e','05263','05264','05265','05269','0526a','0526f','05270','05271','05272','05273','05274','05275','0527d','0527f','05283','05287','05288','05289','0528d','05291','05292','05294','0529b','0529e','0529f','052a0','052a3','052a9','052aa','052ab','052ac','052ad','052b1','052b4','052b5','052b9','052bc','052be','052c1','052c3','052c5','052c7','052c9','052cd','052d2','052d5','052d7','052d8','052d9','052dd','052de','052df','052e0','052e2','052e3','052e4','052e6','052e7','052f2','052f3','052f5','052f8','052f9','052fa','052fe','052ff','05300','05301','05302','05305','05306','05308','0530d','0530f','05310','05315','05316','05317','05319','0531a','0531d','05320','05321','05323','0532a','0532f','05331','05333','05338','05339','0533a','0533b','0533f','05340','05341','05342','05343','05344','05345','05346','05347','05348','05349','0534a','0534d','05351','05352','05353','05354','05357','05358','0535a','0535c','0535e','05360','05366','05369','0536e','0536f','05370','05371','05373','05374','05375','05377','05378','0537b','0537d','0537f','05382','05384','05396','05398','0539a','0539f','053a0','053a5','053a6','053a8','053a9','053ad','053ae','053b0','053b3','053b6','053bb','053c2','053c3','053c8','053c9','053ca','053cb','053cc','053cd','053ce','053d4','053d6','053d7','053d9','053da','053db','053df','053e1','053e2','053e3','053e4','053e5','053e8','053e9','053ea','053eb','053ec','053ed','053ee','053ef','053f0','053f1','053f2','053f3','053f6','053f7','053f8','053fa','05401','05403','05404','05408','05409','0540a','0540b','0540c','0540d','0540e','0540f','05410','05411','0541b','0541d','0541e','0541f','05420','05426','05429','0542b','0542c','0542d','0542e','05436','05438','05439','0543b','0543c','0543d','0543e','05440','05442','05446','05448','05449','0544a','0544e','05451','0545f','05468','0546a','05470','05471','05473','05475','05476','05477','0547b','0547c','0547d','05480','05484','05486','0548b','0548c','0548e','0548f','05490','05492','054a2','054a4','054a5','054a8','054ab','054ac','054af','054b2','054b3','054b8','054bc','054bd','054be','054c0','054c1','054c2','054c4','054c7','054c8','054c9','054d8','054e1','054e2','054e5','054e6','054e8','054e9','054ed','054ee','054f2','054fa','054fd','05504','05506','05507','0550f','05510','05514','05516','0552e','0552f','05531','05533','05538','05539','0553e','05540','05544','05545','05546','0554c','0554f','05553','05556','05557','0555c','0555d','05563','0557b','0557c','0557e','05580','05583','05584','05587','05589','0558a','0558b','05598','05599','0559a','0559c','0559d','0559e','0559f','055a7','055a8','055a9','055aa','055ab','055ac','055ae','055b0','055b6','055bb','055bf','055c4','055c5','055c7','055d4','055da','055dc','055df','055e3','055e4','055f7','055f9','055fd','055fe','05606','05609','05614','05616','05617','05618','0561b','05629','0562f','05631','05632','05634','05636','05638','05642','0564c','0564e','05650','05653','0565b','05664','05668','0566a','0566b','0566c','05674','05678','0567a','05680','05686','05687','0568a','0568f','05694','05699','056a0','056a2','056a5','056ae','056b4','056b6','056bc','056c0','056c1','056c2','056c3','056c8','056ce','056d1','056d3','056d7','056d8','056da','056db','056de','056e0','056e3','056ee','056f0','056f2','056f3','056f9','056fa','056fd','056ff','05700','05703','05704','05708','05709','0570b','0570d','0570f','05712','05713','05716','05718','0571c','0571f','05723','05726','05727','05728','0572d','05730','05737','05738','0573b','05740','05742','05747','0574a','0574e','0574f','05750','05751','05761','05764','05766','05769','0576a','0577f','05782','05788','05789','0578b','05793','057a0','057a2','057a3','057a4','057aa','057b0','057b3','057c0','057c3','057c6','057cb','057ce','057d2','057d3','057d4','057d6','057dc','057df','057e0','057e3','057f4','057f6','057f7','057f9','057fa','057fc','05800','05802','05805','05806','0580a','0580b','05815','05819','0581d','05821','05824','0582a','0582f','05830','05831','05834','05835','0583a','0583d','05840','05841','0584a','0584b','05851','05852','05854','05857','05858','05859','0585a','0585e','05861','05862','05869','0586b','05870','05872','05875','05879','0587e','05883','05885','05893','05897','0589c','0589e','0589f','058a8','058ab','058ae','058b3','058b8','058b9','058ba','058bb','058be','058c1','058c5','058c7','058ca','058cc','058d1','058d3','058d5','058d7','058d8','058d9','058dc','058de','058df','058e4','058e5','058eb','058ec','058ee','058ef','058f0','058f1','058f2','058f7','058f9','058fa','058fb','058fc','058fd','05902','05909','0590a','0590c','0590d','0590f','05910','05915','05916','05918','05919','0591a','0591b','0591c','05922','05925','05927','05929','0592a','0592b','0592c','0592d','0592e','05931','05932','05937','05938','0593e','05944','05947','05948','05949','0594e','0594f','05950','05951','05954','05955','05957','05958','0595a','05960','05962','05965','05967','05968','05969','0596a','0596c','0596e','05973','05974','05978','0597d','05981','05982','05983','05984','0598a','0598d','05993','05996','05999','0599b','0599d','059a3','059a5','059a8','059ac','059b2','059b9','059bb','059be','059c6','059c9','059cb','059d0','059d1','059d3','059d4','059d9','059da','059dc','059e5','059e6','059e8','059ea','059eb','059f6','059f8','059fb','059ff','05a01','05a03','05a09','05a11','05a18','05a1a','05a1c','05a1f','05a20','05a25','05a29','05a2f','05a35','05a36','05a3c','05a40','05a41','05a46','05a49','05a5a','05a5c','05a62','05a66','05a6a','05a6c','05a7f','05a92','05a9a','05a9b','05abc','05abd','05abe','05ac1','05ac2','05ac9','05acb','05acc','05ad0','05ad6','05ad7','05ae1','05ae3','05ae6','05ae9','05afa','05afb','05b09','05b0b','05b0c','05b16','05b22','05b2a','05b2c','05b30','05b32','05b36','05b3e','05b40','05b43','05b45','05b50','05b51','05b54','05b55','05b57','05b58','05b5a','05b5b','05b5c','05b5d','05b5f','05b63','05b64','05b65','05b66','05b69','05b6b','05b70','05b71','05b73','05b75','05b78','05b7a','05b80','05b83','05b85','05b87','05b88','05b89','05b8b','05b8c','05b8d','05b8f','05b95','05b97','05b98','05b99','05b9a','05b9b','05b9c','05b9d','05b9f','05ba2','05ba3','05ba4','05ba5','05ba6','05bae','05bb0','05bb3','05bb4','05bb5','05bb6','05bb8','05bb9','05bbf','05bc2','05bc3','05bc4','05bc5','05bc6','05bc7','05bc9','05bcc','05bd0','05bd2','05bd3','05bd4','05bdb','05bdd','05bde','05bdf','05be1','05be2','05be4','05be5','05be6','05be7','05be8','05be9','05beb','05bec','05bee','05bf0','05bf3','05bf5','05bf6','05bf8','05bfa','05bfe','05bff','05c01','05c02','05c03','05c04','05c05','05c06','05c07','05c08','05c09','05c0a','05c0b','05c0d','05c0e','05c0f','05c11','05c13','05c16','05c1a','05c1e','05c20','05c22','05c23','05c24','05c28','05c2d','05c31','05c38','05c39','05c3a','05c3b','05c3c','05c3d','05c3e','05c3f','05c40','05c41','05c45','05c46','05c48','05c4a','05c4b','05c4d','05c4e','05c4f','05c50','05c51','05c53','05c55','05c5b','05c5e','05c60','05c61','05c64','05c65','05c6c','05c6e','05c6f','05c71','05c76','05c79','05c8c','05c90','05c91','05c94','05ca1','05ca8','05ca9','05cab','05cac','05cb1','05cb3','05cb6','05cb7','05cb8','05cbb','05cbc','05cbe','05cc5','05cc7','05cd9','05ce0','05ce1','05ce8','05ce9','05cea','05ced','05cef','05cf0','05cf6','05cfa','05cfb','05cfd','05d07','05d0b','05d0e','05d11','05d14','05d15','05d16','05d17','05d18','05d19','05d1a','05d1b','05d1f','05d22','05d29','05d4b','05d4c','05d4e','05d50','05d52','05d5c','05d69','05d6c','05d6f','05d73','05d76','05d82','05d84','05d87','05d8b','05d8c','05d90','05d9d','05da2','05dac','05dae','05db7','05dba','05dbc','05dbd','05dc9','05dcc','05dcd','05dd2','05dd3','05dd6','05ddb','05ddc','05ddd','05dde','05de1','05de2','05de3','05de5','05de6','05de7','05de8','05deb','05dee','05df1','05df2','05df3','05df4','05df5','05df7','05dfb','05dfd','05dfe','05e02','05e03','05e06','05e0b','05e0c','05e11','05e16','05e19','05e1a','05e1b','05e1d','05e25','05e2b','05e2d','05e2f','05e30','05e33','05e36','05e37','05e38','05e3d','05e40','05e43','05e44','05e45','05e47','05e4c','05e4e','05e54','05e55','05e57','05e5f','05e61','05e62','05e63','05e64','05e72','05e73','05e74','05e75','05e76','05e77','05e78','05e79','05e7a','05e7b','05e7c','05e7d','05e7e','05e7f','05e81','05e83','05e84','05e87','05e8a','05e8f','05e95','05e96','05e97','05e9a','05e9c','05ea0','05ea6','05ea7','05eab','05ead','05eb5','05eb6','05eb7','05eb8','05ec1','05ec2','05ec3','05ec8','05ec9','05eca','05ecf','05ed0','05ed3','05ed6','05eda','05edb','05edd','05edf','05ee0','05ee1','05ee2','05ee3','05ee8','05ee9','05eec','05ef0','05ef1','05ef3','05ef4','05ef6','05ef7','05ef8','05efa','05efb','05efc','05efe','05eff','05f01','05f03','05f04','05f09','05f0a','05f0b','05f0c','05f0d','05f0f','05f10','05f11','05f13','05f14','05f15','05f16','05f17','05f18','05f1b','05f1f','05f25','05f26','05f27','05f29','05f2d','05f2f','05f31','05f35','05f37','05f38','05f3c','05f3e','05f41','05f48','05f4a','05f4c','05f4e','05f50','05f51','05f53','05f56','05f57','05f59','05f5c','05f5d','05f61','05f62','05f66','05f69','05f6a','05f6b','05f6c','05f6d','05f70','05f71','05f73','05f77','05f79','05f7c','05f7f','05f80','05f81','05f82','05f83','05f84','05f85','05f87','05f88','05f8a','05f8b','05f8c','05f90','05f91','05f92','05f93','05f97','05f98','05f99','05f9e','05fa0','05fa1','05fa8','05fa9','05faa','05fad','05fae','05fb3','05fb4','05fb5','05fb7','05fb9','05fbc','05fbd','05fc3','05fc4','05fc5','05fcc','05fcd','05fd6','05fd7','05fd8','05fd9','05fdc','05fdd','05fe0','05fe4','05feb','05ff0','05ff1','05ff5','05ff8','05ffb','05ffd','05fff','0600e','0600f','06010','06012','06015','06016','06019','0601b','0601c','0601d','06020','06021','06025','06026','06027','06028','06029','0602a','0602b','0602f','06031','0603a','06041','06042','06043','06046','0604a','0604b','0604d','06050','06052','06055','06059','0605a','0605f','06060','06062','06063','06064','06065','06068','06069','0606a','0606b','0606c','0606d','0606f','06070','06075','06077','06081','06083','06084','06089','0608b','0608c','0608d','06092','06094','06096','06097','0609a','0609b','0609f','060a0','060a3','060a6','060a7','060a9','060aa','060b2','060b3','060b4','060b5','060b6','060b8','060bc','060bd','060c5','060c6','060c7','060d1','060d3','060d8','060da','060dc','060df','060e0','060e1','060e3','060e7','060e8','060f0','060f1','060f3','060f4','060f6','060f7','060f9','060fa','060fb','06100','06101','06103','06106','06108','06109','0610d','0610e','0610f','06115','0611a','0611b','0611f','06121','06127','06128','0612c','06134','0613c','0613d','0613e','0613f','06142','06144','06147','06148','0614a','0614b','0614c','0614d','0614e','06153','06155','06158','06159','0615a','0615d','0615f','06162','06163','06165','06167','06168','0616b','0616e','0616f','06170','06171','06173','06174','06175','06176','06177','0617e','06182','06187','0618a','0618e','06190','06191','06194','06196','06199','0619a','061a4','061a7','061a9','061ab','061ac','061ae','061b2','061b6','061ba','061be','061c3','061c6','061c7','061c8','061c9','061ca','061cb','061cc','061cd','061d0','061e3','061e6','061f2','061f4','061f6','061f7','061f8','061fa','061fc','061fd','061fe','061ff','06200','06208','06209','0620a','0620c','0620d','0620e','06210','06211','06212','06214','06216','0621a','0621b','0621d','0621e','0621f','06220','06221','06226','0622a','0622e','0622f','06230','06232','06233','06234','06236','06237','06238','0623b','0623f','06240','06241','06247','06248','06249','0624b','0624c','0624d','0624e','06253','06255','06258','0625b','0625e','06260','06263','06268','0626e','06271','06276','06279','0627c','0627e','0627f','06280','06282','06283','06284','06289','0628a','06291','06292','06293','06294','06295','06296','06297','06298','0629b','0629c','0629e','062ab','062ac','062b1','062b5','062b9','062bb','062bc','062bd','062c2','062c5','062c6','062c7','062c8','062c9','062ca','062cc','062cd','062cf','062d0','062d1','062d2','062d3','062d4','062d7','062d8','062d9','062db','062dc','062dd','062e0','062e1','062ec','062ed','062ee','062ef','062f1','062f3','062f5','062f6','062f7','062fe','062ff','06301','06302','06307','06308','06309','0630c','06311','06319','0631f','06327','06328','0632b','0632f','0633a','0633d','0633e','0633f','06349','0634c','0634d','0634f','06350','06355','06357','0635c','06367','06368','06369','0636b','0636e','06372','06376','06377','0637a','0637b','06380','06383','06388','06389','0638c','0638e','0638f','06392','06396','06398','0639b','0639f','063a0','063a1','063a2','063a3','063a5','063a7','063a8','063a9','063aa','063ab','063ac','063b2','063b4','063b5','063bb','063be','063c0','063c3','063c4','063c6','063c9','063cf','063d0','063d2','063d6','063da','063db','063e1','063e3','063e9','063ed','063ee','063f4','063f6','063fa','06406','0640d','0640f','06413','06414','06416','06417','0641c','06426','06428','0642c','0642d','06434','06436','0643a','0643e','06442','0644e','06451','06458','06467','06469','0646f','06476','06478','0647a','06483','06488','06492','06493','06495','0649a','0649e','064a4','064a5','064a9','064ab','064ad','064ae','064b0','064b2','064b9','064bb','064bc','064c1','064c2','064c5','064c7','064ca','064cd','064d2','064d4','064d8','064da','064e0','064e1','064e2','064e3','064e6','064e7','064ec','064ef','064f1','064f2','064f4','064f6','064fa','064fd','064fe','06500','06505','06518','0651c','0651d','06523','06524','0652a','0652b','0652c','0652f','06534','06535','06536','06537','06538','06539','0653b','0653e','0653f','06545','06548','0654d','0654f','06551','06555','06556','06557','06558','06559','0655d','0655e','06562','06563','06566','0656c','06570','06572','06574','06575','06577','06578','06582','06583','06587','06588','06589','0658c','0658e','06590','06591','06597','06599','0659b','0659c','0659f','065a1','065a4','065a5','065a7','065ab','065ac','065ad','065af','065b0','065b7','065b9','065bc','065bd','065bf','065c1','065c3','065c4','065c5','065c6','065cb','065cc','065cf','065d2','065d7','065d9','065db','065e0','065e1','065e2','065e5','065e6','065e7','065e8','065e9','065ec','065ed','065f1','065fa','065fb','06602','06603','06606','06607','0660a','0660c','0660e','0660f','06613','06614','0661c','0661f','06620','06625','06627','06628','0662d','0662f','06634','06635','06636','0663c','0663f','06641','06642','06643','06644','06649','0664b','0664f','06652','0665a','0665d','0665e','0665f','06662','06664','06666','06667','06668','06669','0666e','0666f','06670','06674','06676','0667a','06681','06683','06684','06687','06688','06689','0668e','06691','06696','06697','06698','0669d','066a2','066a6','066ab','066ae','066b4','066b8','066b9','066bc','066be','066c1','066c4','066c6','066c7','066c9','066d6','066d9','066da','066dc','066dd','066e0','066e6','066e9','066f0','066f2','066f3','066f4','066f5','066f7','066f8','066f9','066fc','066fd','066fe','066ff','06700','06703','06708','06709','0670b','0670d','0670f','06714','06715','06716','06717','0671b','0671d','0671e','0671f','06726','06727','06728','0672a','0672b','0672c','0672d','0672e','06731','06734','06736','06737','06738','0673a','0673d','0673f','06741','06746','06749','0674e','0674f','06750','06751','06753','06756','06759','0675c','0675e','0675f','06760','06761','06762','06763','06764','06765','0676a','0676d','0676f','06770','06771','06772','06773','06775','06777','0677c','0677e','0677f','06785','06787','06789','0678b','0678c','06790','06795','06797','0679a','0679c','0679d','067a0','067a1','067a2','067a6','067a9','067af','067b3','067b4','067b6','067b7','067b8','067b9','067c1','067c4','067c6','067ca','067ce','067cf','067d0','067d1','067d3','067d4','067d8','067da','067dd','067de','067e2','067e4','067e7','067e9','067ec','067ee','067ef','067f1','067f3','067f4','067f5','067fb','067fe','067ff','06801','06802','06803','06804','06813','06816','06817','0681e','06821','06822','06829','0682a','0682b','06832','06834','06838','06839','0683c','0683d','06840','06841','06842','06843','06846','06848','0684d','0684e','06850','06851','06853','06854','06859','0685c','0685d','0685f','06863','06867','06874','06876','06877','0687c','0687e','0687f','06881','06883','06885','0688d','0688f','06893','06894','06897','0689b','0689d','0689f','068a0','068a2','068a6','068a7','068a8','068ad','068af','068b0','068b1','068b3','068b5','068b6','068b9','068ba','068bc','068c4','068c6','068c9','068ca','068cb','068cd','068d2','068d4','068d5','068d7','068d8','068da','068df','068e0','068e1','068e3','068e7','068ee','068ef','068f2','068f9','068fa','06900','06901','06904','06905','06908','0690b','0690c','0690d','0690e','0690f','06912','06919','0691a','0691b','0691c','06921','06922','06923','06925','06926','06928','0692a','06930','06934','06936','06939','0693d','0693f','0694a','06953','06954','06955','06959','0695a','0695c','0695d','0695e','06960','06961','06962','0696a','0696b','0696d','0696e','0696f','06973','06974','06975','06977','06978','06979','0697c','0697d','0697e','06981','06982','0698a','0698e','06991','06994','06995','0699b','0699c','069a0','069a7','069ae','069b1','069b2','069b4','069bb','069be','069bf','069c1','069c3','069c7','069ca','069cb','069cc','069cd','069ce','069d0','069d3','069d8','069d9','069dd','069de','069e7','069e8','069eb','069ed','069f2','069f9','069fb','069fd','069ff','06a02','06a05','06a0a','06a0b','06a0c','06a12','06a13','06a14','06a17','06a19','06a1b','06a1e','06a1f','06a21','06a22','06a23','06a29','06a2a','06a2b','06a2e','06a35','06a36','06a38','06a39','06a3a','06a3d','06a44','06a47','06a48','06a4b','06a58','06a59','06a5f','06a61','06a62','06a66','06a6b','06a72','06a78','06a7f','06a80','06a84','06a8d','06a8e','06a90','06a97','06a9c','06aa0','06aa2','06aa3','06aaa','06aac','06aae','06ab3','06ab8','06abb','06ac1','06ac2','06ac3','06ad1','06ad3','06ada','06adb','06ade','06adf','06ae8','06aea','06afa','06afb','06b04','06b05','06b0a','06b12','06b16','06b1d','06b1f','06b20','06b21','06b23','06b27','06b32','06b37','06b38','06b39','06b3a','06b3d','06b3e','06b43','06b47','06b49','06b4c','06b4e','06b50','06b53','06b54','06b59','06b5b','06b5f','06b61','06b62','06b63','06b64','06b65','06b66','06b69','06b6a','06b6f','06b73','06b74','06b77','06b78','06b79','06b7a','06b7b','06b7f','06b80','06b83','06b84','06b86','06b89','06b8a','06b8b','06b8d','06b95','06b96','06b98','06b9e','06ba4','06baa','06bab','06baf','06bb1','06bb2','06bb3','06bb4','06bb5','06bb7','06bba','06bbb','06bbc','06bbf','06bc0','06bc5','06bc6','06bcb','06bcd','06bce','06bcf','06bd2','06bd3','06bd4','06bd8','06bdb','06bdf','06beb','06bec','06bef','06bf3','06c08','06c0f','06c10','06c11','06c13','06c14','06c17','06c1b','06c23','06c24','06c34','06c35','06c37','06c38','06c3a','06c3e','06c40','06c41','06c42','06c4e','06c50','06c55','06c57','06c5a','06c5d','06c5e','06c5f','06c60','06c62','06c68','06c6a','06c70','06c72','06c73','06c7a','06c7d','06c7e','06c81','06c82','06c83','06c88','06c8c','06c8d','06c90','06c92','06c93','06c96','06c99','06c9a','06c9b','06ca1','06ca2','06cab','06cae','06cb1','06cb3','06cb8','06cb9','06cba','06cbb','06cbc','06cbd','06cbe','06cbf','06cc1','06cc4','06cc5','06cc9','06cca','06ccc','06cd3','06cd5','06cd7','06cd9','06cdb','06cdd','06ce1','06ce2','06ce3','06ce5','06ce8','06cea','06cef','06cf0','06cf1','06cf3','06d0b','06d0c','06d12','06d17','06d19','06d1b','06d1e','06d1f','06d25','06d29','06d2a','06d2b','06d32','06d33','06d35','06d36','06d38','06d3b','06d3d','06d3e','06d41','06d44','06d45','06d59','06d5a','06d5c','06d63','06d64','06d66','06d69','06d6a','06d6c','06d6e','06d74','06d77','06d78','06d79','06d85','06d88','06d89','06d8c','06d8e','06d93','06d95','06d99','06d9b','06d9c','06daf','06db2','06db5','06db8','06dbc','06dc0','06dc5','06dc6','06dc7','06dcb','06dcc','06dd1','06dd2','06dd5','06dd8','06dd9','06dda','06dde','06de1','06de4','06de6','06de8','06dea','06deb','06dec','06dee','06df1','06df3','06df5','06df7','06df9','06dfa','06dfb','06e05','06e07','06e08','06e09','06e0a','06e0b','06e13','06e15','06e19','06e1a','06e1b','06e1d','06e1f','06e20','06e21','06e23','06e24','06e25','06e26','06e29','06e2b','06e2c','06e2d','06e2e','06e2f','06e34','06e38','06e3a','06e3e','06e43','06e4a','06e4d','06e4e','06e56','06e58','06e5b','06e5f','06e67','06e6b','06e6e','06e6f','06e72','06e76','06e7e','06e7f','06e80','06e82','06e8c','06e8f','06e90','06e96','06e98','06e9c','06e9d','06e9f','06ea2','06ea5','06eaa','06eab','06eaf','06eb2','06eb6','06eb7','06eba','06ebd','06ec2','06ec4','06ec5','06ec9','06ecb','06ecc','06ed1','06ed3','06ed4','06ed5','06edd','06ede','06eec','06eef','06ef2','06ef4','06ef7','06ef8','06efe','06eff','06f01','06f02','06f06','06f09','06f0f','06f11','06f13','06f14','06f15','06f20','06f22','06f23','06f2b','06f2c','06f31','06f32','06f38','06f3e','06f3f','06f41','06f45','06f54','06f58','06f5b','06f5c','06f5f','06f64','06f66','06f6d','06f6e','06f6f','06f70','06f74','06f78','06f7a','06f7c','06f80','06f81','06f82','06f84','06f86','06f8e','06f91','06f97','06fa1','06fa3','06fa4','06faa','06fb1','06fb3','06fb9','06fc0','06fc1','06fc2','06fc3','06fc6','06fd4','06fd5','06fd8','06fdb','06fdf','06fe0','06fe1','06fe4','06feb','06fec','06fee','06fef','06ff1','06ff3','06ff6','06ffa','06ffe','07001','07009','0700b','0700f','07011','07015','07018','0701a','0701b','0701d','0701e','0701f','07026','07027','07028','0702c','07030','07032','0703e','0704c','07051','07058','07063','0706b','0706c','0706f','07070','07078','0707c','0707d','07089','0708a','0708e','07092','07099','070ac','070ad','070ae','070af','070b3','070b8','070b9','070ba','070c8','070cb','070cf','070d9','070dd','070df','070f1','070f9','070fd','07109','07114','07119','0711a','0711c','07121','07126','07130','07136','0713c','07149','0714c','0714e','07155','07156','07159','07162','07164','07165','07166','07167','07169','0716c','0716e','0717d','07184','07188','0718a','0718f','07194','07195','07199','0719f','071a8','071ac','071b1','071b9','071be','071c3','071c8','071c9','071ce','071d0','071d2','071d4','071d5','071d7','071df','071e0','071e5','071e6','071e7','071ec','071ed','071ee','071f5','071f9','071fb','071fc','071ff','07206','0720d','07210','0721b','07228','0722a','0722b','0722c','0722d','07230','07232','07235','07236','0723a','0723b','0723c','0723d','0723e','0723f','07240','07246','07247','07248','0724b','0724c','07252','07258','07259','0725b','0725c','0725d','0725f','07261','07262','07267','07269','07272','07274','07279','0727d','0727e','07280','07281','07282','07287','07292','07296','072a0','072a2','072a7','072ac','072ad','072af','072b2','072b6','072b9','072c0','072c2','072c3','072c4','072c6','072ce','072d0','072d2','072d7','072d9','072db','072e0','072e1','072e2','072e9','072ec','072ed','072f7','072f8','072f9','072fc','072fd','0730a','07316','07317','0731b','0731c','0731d','0731f','07325','07329','0732a','0732b','0732e','0732f','07334','07336','07337','0733e','0733f','07344','07345','0734e','0734f','07357','07363','07368','0736a','07370','07372','07375','07378','0737a','0737b','07384','07387','07389','0738b','07396','073a9','073b2','073b3','073bb','073c0','073c2','073c8','073ca','073cd','073ce','073de','073e0','073e5','073ea','073ed','073ee','073f1','073f8','073fe','07403','07405','07406','07409','07422','07425','07432','07433','07434','07435','07436','0743a','0743f','07441','07455','07459','0745a','0745b','0745c','0745e','0745f','07460','07463','07464','07469','0746a','0746f','07470','07473','07476','0747e','07483','0748b','0749e','074a2','074a7','074b0','074bd','074ca','074cf','074d4','074dc','074e0','074e2','074e3','074e6','074e7','074e9','074ee','074f0','074f1','074f2','074f6','074f7','074f8','07503','07504','07505','0750c','0750d','0750e','07511','07513','07515','07518','0751a','0751c','0751e','0751f','07523','07525','07526','07528','07529','0752b','0752c','07530','07531','07532','07533','07537','07538','0753a','0753b','0753c','07544','07546','07549','0754a','0754b','0754c','0754d','0754f','07550','07551','07554','07559','0755a','0755b','0755c','0755d','07560','07562','07564','07565','07566','07567','07569','0756a','0756b','0756d','07570','07573','07574','07576','07577','07578','0757f','07582','07586','07587','07589','0758a','0758b','0758e','0758f','07591','07592','07594','0759a','0759d','075a3','075a5','075ab','075b1','075b2','075b3','075b5','075b8','075b9','075bc','075bd','075be','075c2','075c3','075c5','075c7','075ca','075cd','075d2','075d4','075d5','075d8','075d9','075db','075de','075e2','075e3','075e9','075f0','075f2','075f3','075f4','075fa','075fc','075fe','075ff','07601','07609','0760b','0760d','0761f','07620','07621','07622','07624','07626','07627','07630','07634','0763b','07642','07646','07647','07648','0764c','07652','07656','07658','0765c','07661','07662','07667','07668','07669','0766a','0766c','07670','07672','07676','07678','0767a','0767b','0767c','0767d','0767e','07680','07683','07684','07686','07687','07688','0768b','0768e','07690','07693','07696','07699','0769a','076ae','076b0','076b4','076b7','076b8','076b9','076ba','076bf','076c2','076c3','076c6','076c8','076ca','076cd','076d2','076d6','076d7','076db','076dc','076de','076df','076e1','076e3','076e4','076e5','076e7','076ea','076ee','076f2','076f4','076f8','076fb','076fe','07701','07704','07707','07708','07709','0770b','0770c','0771b','0771e','0771f','07720','07724','07725','07726','07729','07737','07738','0773a','0773c','07740','07747','07758','0775a','0775b','07761','07763','07765','07766','07768','0776b','07779','0777e','0777f','0778b','0778e','07791','0779e','077a0','077a5','077ac','077ad','077b0','077b3','077b6','077b9','077bb','077bc','077bd','077bf','077c7','077cd','077d7','077da','077db','077dc','077e2','077e3','077e5','077e7','077e9','077ed','077ee','077ef','077f3','077fc','07802','0780c','07812','07814','07815','07820','07825','07826','07827','07832','07834','0783a','0783f','07845','0785d','0786b','0786c','0786f','07872','07874','0787c','07881','07886','07887','0788c','0788d','0788e','07891','07893','07895','07897','0789a','078a3','078a7','078a9','078aa','078af','078b5','078ba','078bc','078be','078c1','078c5','078c6','078ca','078cb','078d0','078d1','078d4','078da','078e7','078e8','078ec','078ef','078f4','078fd','07901','07907','0790e','07911','07912','07919','07926','0792a','0792b','0792c','0793a','0793b','0793c','0793e','07940','07941','07947','07948','07949','07950','07953','07955','07956','07957','0795a','0795d','0795e','0795f','07960','07962','07965','07968','0796d','07977','0797a','0797f','07980','07981','07984','07985','0798a','0798d','0798e','0798f','0799d','079a6','079a7','079aa','079ae','079b0','079b1','079b3','079b8','079b9','079ba','079bb','079bd','079be','079bf','079c0','079c1','079c9','079cb','079d1','079d2','079d5','079d8','079df','079e1','079e3','079e4','079e6','079e7','079e9','079ec','079f0','079fb','07a00','07a08','07a0b','07a0d','07a0e','07a14','07a17','07a18','07a19','07a1a','07a1c','07a1f','07a20','07a2e','07a31','07a32','07a37','07a3b','07a3c','07a3d','07a3e','07a3f','07a40','07a42','07a43','07a46','07a49','07a4d','07a4e','07a4f','07a50','07a57','07a61','07a62','07a63','07a69','07a6b','07a70','07a74','07a76','07a79','07a7a','07a7d','07a7f','07a81','07a83','07a84','07a88','07a92','07a93','07a95','07a96','07a97','07a98','07a9f','07aa9','07aaa','07aae','07aaf','07ab0','07ab6','07aba','07abf','07ac3','07ac4','07ac5','07ac7','07ac8','07aca','07acb','07acd','07acf','07ad2','07ad3','07ad5','07ad9','07ada','07adc','07add','07adf','07ae0','07ae1','07ae2','07ae3','07ae5','07ae6','07aea','07aed','07aef','07af0','07af6','07af8','07af9','07afa','07aff','07b02','07b04','07b06','07b08','07b0a','07b0b','07b0f','07b11','07b18','07b19','07b1b','07b1e','07b20','07b25','07b26','07b28','07b2c','07b33','07b35','07b36','07b39','07b45','07b46','07b48','07b49','07b4b','07b4c','07b4d','07b4f','07b50','07b51','07b52','07b54','07b56','07b5d','07b65','07b67','07b6c','07b6e','07b70','07b71','07b74','07b75','07b7a','07b86','07b87','07b8b','07b8d','07b8f','07b92','07b94','07b95','07b97','07b98','07b99','07b9a','07b9c','07b9d','07b9f','07ba1','07baa','07bad','07bb1','07bb4','07bb8','07bc0','07bc1','07bc4','07bc6','07bc7','07bc9','07bcb','07bcc','07bcf','07bdd','07be0','07be4','07be5','07be6','07be9','07bed','07bf3','07bf6','07bf7','07c00','07c07','07c0d','07c11','07c12','07c13','07c14','07c17','07c1e','07c1f','07c21','07c23','07c27','07c2a','07c2b','07c37','07c38','07c3d','07c3e','07c3f','07c40','07c43','07c4c','07c4d','07c4f','07c50','07c54','07c56','07c58','07c5f','07c60','07c64','07c65','07c6c','07c73','07c75','07c7e','07c81','07c82','07c83','07c89','07c8b','07c8d','07c90','07c92','07c95','07c97','07c98','07c9b','07c9f','07ca1','07ca2','07ca4','07ca5','07ca6','07ca7','07ca8','07cab','07cad','07cae','07cb1','07cb2','07cb3','07cb9','07cbd','07cbe','07cc0','07cc2','07cc5','07cca','07cce','07cd2','07cd6','07cd8','07cdc','07cde','07cdf','07ce0','07ce2','07ce7','07cef','07cf2','07cf4','07cf6','07cf8','07cf9','07cfa','07cfb','07cfe','07d00','07d02','07d04','07d05','07d06','07d0a','07d0b','07d0d','07d10','07d14','07d15','07d17','07d18','07d19','07d1a','07d1b','07d1c','07d20','07d21','07d22','07d2b','07d2c','07d2e','07d2f','07d30','07d32','07d33','07d35','07d39','07d3a','07d3f','07d42','07d43','07d44','07d45','07d46','07d4b','07d4c','07d4e','07d4f','07d50','07d56','07d5b','07d5e','07d61','07d62','07d63','07d66','07d68','07d6e','07d71','07d72','07d73','07d75','07d76','07d79','07d7d','07d89','07d8f','07d93','07d99','07d9a','07d9b','07d9c','07d9f','07da0','07da2','07da3','07dab','07dac','07dad','07dae','07daf','07db0','07db1','07db2','07db4','07db5','07db8','07dba','07dbb','07dbd','07dbe','07dbf','07dc7','07dca','07dcb','07dcf','07dd1','07dd2','07dd5','07dd6','07dd8','07dda','07ddc','07ddd','07dde','07de0','07de1','07de3','07de4','07de8','07de9','07dec','07def','07df2','07df4','07dfb','07e01','07e04','07e05','07e09','07e0a','07e0b','07e12','07e1b','07e1e','07e1f','07e21','07e22','07e23','07e26','07e2b','07e2e','07e31','07e32','07e35','07e37','07e39','07e3a','07e3b','07e3d','07e3e','07e41','07e43','07e46','07e4a','07e4b','07e4d','07e54','07e55','07e56','07e59','07e5a','07e5d','07e5e','07e61','07e66','07e67','07e69','07e6a','07e6b','07e6d','07e70','07e79','07e7b','07e7c','07e7d','07e7f','07e82','07e83','07e88','07e89','07e8c','07e8e','07e8f','07e90','07e92','07e93','07e94','07e96','07e9b','07e9c','07f36','07f38','07f3a','07f45','07f4c','07f4d','07f4e','07f50','07f51','07f52','07f54','07f55','07f58','07f5f','07f60','07f67','07f68','07f69','07f6a','07f6b','07f6e','07f70','07f72','07f75','07f77','07f78','07f79','07f82','07f83','07f85','07f86','07f87','07f88','07f8a','07f8c','07f8e','07f94','07f9a','07f9d','07f9e','07fa3','07fa4','07fa8','07fa9','07fae','07faf','07fb2','07fb6','07fb8','07fb9','07fbd','07fc1','07fc5','07fc6','07fca','07fcc','07fd2','07fd4','07fd5','07fdf','07fe0','07fe1','07fe6','07fe9','07feb','07ff0','07ff3','07ff9','07ffb','07ffc','08000','08001','08002','08003','08004','08005','08006','0800b','0800c','08010','08012','08015','08017','08018','08019','0801c','08021','08028','08033','08036','0803b','0803d','0803f','08046','0804a','08052','08056','08058','0805a','0805e','0805f','08061','08062','08068','0806f','08070','08072','08073','08074','08076','08077','08079','0807d','0807e','0807f','08080','08084','08085','08086','08087','08089','0808b','0808c','08093','08096','08098','0809a','0809b','0809d','080a1','080a2','080a5','080a9','080aa','080ac','080ad','080af','080b1','080b2','080b4','080ba','080c3','080c4','080c6','080cc','080ce','080d6','080d9','080da','080db','080dd','080de','080e1','080e4','080e5','080ef','080f1','080f4','080f8','080fc','080fd','08102','08105','08106','08107','08108','08109','0810a','0811a','0811b','08123','08129','0812f','08131','08133','08139','0813e','08146','0814b','0814e','08150','08151','08153','08154','08155','0815f','08165','08166','0816b','0816e','08170','08171','08174','08178','08179','0817a','0817f','08180','08182','08183','08188','0818a','0818f','08193','08195','0819a','0819c','0819d','081a0','081a3','081a4','081a8','081a9','081b0','081b3','081b5','081b8','081ba','081bd','081be','081bf','081c0','081c2','081c6','081c8','081c9','081cd','081d1','081d3','081d8','081d9','081da','081df','081e0','081e3','081e5','081e7','081e8','081ea','081ed','081f3','081f4','081fa','081fb','081fc','081fe','08201','08202','08205','08207','08208','08209','0820a','0820c','0820d','0820e','08210','08212','08216','08217','08218','0821b','0821c','0821e','0821f','08229','0822a','0822b','0822c','0822e','08233','08235','08236','08237','08238','08239','08240','08247','08258','08259','0825a','0825d','0825f','08262','08264','08266','08268','0826a','0826b','0826e','0826f','08271','08272','08276','08277','08278','08279','0827e','0828b','0828d','08292','08299','0829d','0829f','082a5','082a6','082ab','082ac','082ad','082af','082b1','082b3','082b8','082b9','082bb','082bd','082c5','082d1','082d2','082d3','082d4','082d7','082d9','082db','082dc','082de','082df','082e1','082e3','082e5','082e6','082e7','082eb','082f1','082f3','082f4','082f9','082fa','082fb','08302','08303','08304','08305','08306','08309','0830e','08316','08317','08318','0831c','08323','08328','0832b','0832f','08331','08332','08334','08335','08336','08338','08339','08340','08345','08349','0834a','0834f','08350','08352','08358','08373','08375','08377','0837b','0837c','08385','08387','08389','0838a','0838e','08393','08396','0839a','0839e','0839f','083a0','083a2','083a8','083aa','083ab','083b1','083b5','083bd','083c1','083c5','083ca','083cc','083ce','083d3','083d6','083d8','083dc','083df','083e0','083e9','083eb','083ef','083f0','083f1','083f2','083f4','083f7','083fb','083fd','08403','08404','08407','0840a','0840b','0840c','0840d','0840e','08413','08420','08422','08429','0842a','0842c','08431','08435','08438','0843c','0843d','08446','08449','0844e','08457','0845b','08461','08462','08463','08466','08469','0846b','0846c','0846d','0846e','0846f','08471','08475','08477','08479','0847a','08482','08484','0848b','08490','08494','08499','0849c','0849f','084a1','084ad','084b2','084b8','084b9','084bb','084bc','084bf','084c1','084c4','084c6','084c9','084ca','084cb','084cd','084d0','084d1','084d6','084d9','084da','084ec','084ee','084f4','084fc','084ff','08500','08506','08511','08513','08514','08515','08517','08518','0851a','0851f','08521','08523','08526','0852c','0852d','08535','0853d','08540','08541','08543','08548','08549','0854a','0854b','0854e','08555','08557','08558','0855a','08563','08568','08569','0856a','0856d','08577','0857e','08580','08584','08587','08588','0858a','08590','08591','08594','08597','08599','0859b','0859c','085a4','085a6','085a8','085a9','085aa','085ab','085ac','085ae','085af','085b0','085b9','085ba','085c1','085c9','085cd','085cf','085d0','085d5','085dc','085dd','085e4','085e5','085e9','085ea','085f7','085f9','085fa','085fb','085fe','08602','08606','08607','0860a','0860b','08613','08616','08617','0861a','08622','0862d','0862f','08630','0863f','0864d','0864e','08650','08654','08655','0865a','0865b','0865c','0865e','0865f','08667','0866b','08671','08679','0867b','0868a','0868b','0868c','08693','08695','086a3','086a4','086a9','086aa','086ab','086af','086b0','086b6','086c4','086c6','086c7','086c9','086cb','086cd','086ce','086d4','086d9','086db','086de','086df','086e4','086e9','086ec','086ed','086ee','086ef','086f8','086f9','086fb','086fe','08700','08702','08703','08706','08708','08709','0870a','0870d','08711','08712','08718','0871a','0871c','08725','08729','08734','08737','0873b','0873f','08749','0874b','0874c','0874e','08753','08755','08757','08759','0875f','08760','08763','08766','08768','0876a','0876e','08774','08776','08778','0877f','08782','0878d','0879f','087a2','087ab','087af','087b3','087ba','087bb','087bd','087c0','087c4','087c6','087c7','087cb','087d0','087d2','087e0','087ec','087ef','087f2','087f6','087f7','087f9','087fb','087fe','08805','0880d','0880e','0880f','08811','08815','08816','0881f','08821','08822','08823','08827','08831','08836','08839','0883b','08840','08842','08844','08846','0884c','0884d','08852','08853','08857','08859','0885b','0885d','0885e','08861','08862','08863','08864','08868','0886b','08870','08872','08875','08877','0887d','0887e','0887f','08881','08882','08888','0888b','0888d','08892','08896','08897','08899','0889e','088a2','088a4','088ab','088ae','088b0','088b1','088b4','088b5','088b7','088bf','088c1','088c2','088c3','088c4','088c5','088cf','088d4','088d5','088d8','088d9','088dc','088dd','088df','088e1','088e8','088f2','088f3','088f4','088f8','088f9','088fc','088fd','088fe','08902','08904','08907','0890a','0890c','08910','08912','08913','0891d','0891e','08925','0892a','0892b','08936','08938','0893b','08941','08943','08944','0894c','0894d','08956','0895e','0895f','08960','08964','08966','0896a','0896d','0896f','08972','08974','08977','0897e','0897f','08980','08981','08983','08986','08987','08988','0898a','0898b','0898f','08993','08996','08997','08998','0899a','089a1','089a6','089a7','089a9','089aa','089ac','089af','089b2','089b3','089ba','089bd','089bf','089c0','089d2','089da','089dc','089dd','089e3','089e6','089e7','089f4','089f8','08a00','08a01','08a02','08a03','08a08','08a0a','08a0c','08a0e','08a10','08a13','08a16','08a17','08a18','08a1b','08a1d','08a1f','08a23','08a25','08a2a','08a2d','08a31','08a33','08a34','08a36','08a3a','08a3b','08a3c','08a41','08a46','08a48','08a50','08a51','08a52','08a54','08a55','08a5b','08a5e','08a60','08a62','08a63','08a66','08a69','08a6b','08a6c','08a6d','08a6e','08a70','08a71','08a72','08a73','08a7c','08a82','08a84','08a85','08a87','08a89','08a8c','08a8d','08a91','08a93','08a95','08a98','08a9a','08a9e','08aa0','08aa1','08aa3','08aa4','08aa5','08aa6','08aa8','08aac','08aad','08ab0','08ab2','08ab9','08abc','08abf','08ac2','08ac4','08ac7','08acb','08acc','08acd','08acf','08ad2','08ad6','08ada','08adb','08adc','08ade','08ae0','08ae1','08ae2','08ae4','08ae6','08ae7','08aeb','08aed','08aee','08af1','08af3','08af7','08af8','08afa','08afe','08b00','08b01','08b02','08b04','08b07','08b0c','08b0e','08b10','08b14','08b16','08b17','08b19','08b1a','08b1b','08b1d','08b20','08b21','08b26','08b28','08b2b','08b2c','08b33','08b39','08b3e','08b41','08b49','08b4c','08b4e','08b4f','08b56','08b58','08b5a','08b5b','08b5c','08b5f','08b66','08b6b','08b6c','08b6f','08b70','08b71','08b72','08b74','08b77','08b7d','08b80','08b83','08b8a','08b8c','08b8e','08b90','08b92','08b93','08b96','08b99','08b9a','08c37','08c3a','08c3f','08c41','08c46','08c48','08c4a','08c4c','08c4e','08c50','08c55','08c5a','08c61','08c62','08c6a','08c6b','08c6c','08c78','08c79','08c7a','08c7c','08c82','08c85','08c89','08c8a','08c8c','08c8d','08c8e','08c94','08c98','08c9d','08c9e','08ca0','08ca1','08ca2','08ca7','08ca8','08ca9','08caa','08cab','08cac','08cad','08cae','08caf','08cb0','08cb2','08cb3','08cb4','08cb6','08cb7','08cb8','08cbb','08cbc','08cbd','08cbf','08cc0','08cc1','08cc2','08cc3','08cc4','08cc7','08cc8','08cca','08ccd','08cce','08cd1','08cd3','08cda','08cdb','08cdc','08cde','08ce0','08ce2','08ce3','08ce4','08ce6','08cea','08ced','08cf4','08cfa','08cfb','08cfc','08cfd','08d04','08d05','08d07','08d08','08d0a','08d0b','08d0d','08d0f','08d10','08d13','08d14','08d16','08d64','08d66','08d67','08d6b','08d6d','08d70','08d71','08d73','08d74','08d77','08d81','08d85','08d8a','08d99','08da3','08da8','08db3','08dba','08dbe','08dc2','08dcb','08dcc','08dcf','08dd6','08dda','08ddb','08ddd','08ddf','08de1','08de3','08de8','08dea','08deb','08def','08df3','08df5','08dfc','08dff','08e08','08e09','08e0a','08e0f','08e10','08e1d','08e1e','08e1f','08e2a','08e30','08e34','08e35','08e42','08e44','08e47','08e48','08e49','08e4a','08e4c','08e50','08e55','08e59','08e5f','08e60','08e63','08e64','08e72','08e74','08e76','08e7c','08e81','08e84','08e85','08e87','08e8a','08e8b','08e8d','08e91','08e93','08e94','08e99','08ea1','08eaa','08eab','08eac','08eaf','08eb0','08eb1','08ebe','08ec5','08ec6','08ec8','08eca','08ecb','08ecc','08ecd','08ed2','08edb','08edf','08ee2','08ee3','08eeb','08ef8','08efb','08efc','08efd','08efe','08f03','08f05','08f09','08f0a','08f0c','08f12','08f13','08f14','08f15','08f19','08f1b','08f1c','08f1d','08f1f','08f26','08f29','08f2a','08f2f','08f33','08f38','08f39','08f3b','08f3e','08f3f','08f42','08f44','08f45','08f46','08f49','08f4c','08f4d','08f4e','08f57','08f5c','08f5f','08f61','08f62','08f63','08f64','08f9b','08f9c','08f9e','08f9f','08fa3','08fa7','08fa8','08fad','08fae','08faf','08fb0','08fb1','08fb2','08fb5','08fb6','08fb7','08fba','08fbb','08fbc','08fbf','08fc2','08fc4','08fc5','08fce','08fd1','08fd4','08fda','08fe2','08fe5','08fe6','08fe9','08fea','08feb','08fed','08fef','08ff0','08ff4','08ff7','08ff8','08ff9','08ffa','08ffd','09000','09001','09003','09005','09006','09009','0900b','0900d','0900e','0900f','09010','09011','09013','09014','09015','09016','09017','09019','0901a','0901d','0901e','0901f','09020','09021','09022','09023','09027','0902e','09031','09032','09035','09036','09038','09039','0903c','0903e','09041','09042','09045','09047','09049','0904a','0904b','0904d','0904e','0904f','09050','09051','09052','09053','09054','09055','09056','09058','09059','0905c','0905e','09060','09061','09063','09065','09068','09069','0906d','0906e','0906f','09072','09075','09076','09077','09078','0907a','0907c','0907d','0907f','09080','09081','09082','09083','09084','09087','09089','0908a','0908f','09091','090a3','090a6','090a8','090aa','090af','090b1','090b5','090b8','090c1','090ca','090ce','090db','090de','090e1','090e2','090e4','090e8','090ed','090f5','090f7','090fd','09102','09112','09119','0912d','09130','09132','09149','0914a','0914b','0914c','0914d','0914e','09152','09154','09156','09158','09162','09163','09165','09169','0916a','0916c','09172','09173','09175','09177','09178','09182','09187','09189','0918b','0918d','09190','09192','09197','0919c','091a2','091a4','091aa','091ab','091ac','091af','091b4','091b5','091b8','091ba','091c0','091c1','091c6','091c7','091c8','091c9','091cb','091cc','091cd','091ce','091cf','091d0','091d1','091d2','091d6','091d8','091db','091dc','091dd','091df','091e1','091e3','091e6','091e7','091f5','091f6','091fc','091ff','0920d','0920e','09211','09214','09215','0921e','09229','0922c','09234','09237','0923f','09244','09245','09248','09249','0924b','09250','09257','0925a','0925b','0925e','09262','09264','09266','09271','0927e','09280','09283','09285','09291','09293','09295','09296','09298','0929a','0929b','0929c','092ad','092b7','092b9','092cf','092d2','092e4','092e9','092ea','092ed','092f2','092f3','092f8','092fa','092fc','09304','09306','0930f','09310','09318','09319','0931a','09320','09322','09323','09326','09328','0932b','0932c','0932e','0932f','09332','09335','0933a','0933b','09344','0934a','0934b','0934d','09354','09356','0935b','0935c','09360','0936c','0936e','09375','0937c','0937e','0938c','09394','09396','09397','0939a','093a7','093ac','093ad','093ae','093b0','093b9','093c3','093c8','093d0','093d1','093d6','093d7','093d8','093dd','093e1','093e4','093e5','093e8','09403','09407','09410','09413','09414','09418','09419','0941a','09421','0942b','09435','09436','09438','0943a','09441','09444','09451','09452','09453','0945a','0945b','0945e','09460','09462','0946a','09470','09475','09477','0947c','0947d','0947e','0947f','09481','09577','09578','09580','09582','09583','09587','09589','0958a','0958b','0958f','09591','09593','09594','09596','09598','09599','095a0','095a2','095a3','095a4','095a5','095a7','095a8','095ad','095b2','095b9','095bb','095bc','095be','095c3','095c7','095ca','095cc','095cd','095d4','095d5','095d6','095d8','095dc','095e1','095e2','095e5','0961c','0961d','09621','09628','0962a','0962e','0962f','09632','0963b','0963f','09640','09642','09644','0964b','0964c','0964d','0964f','09650','0965b','0965c','0965d','0965e','0965f','09662','09663','09664','09665','09666','0966a','0966c','09670','09672','09673','09675','09676','09677','09678','0967a','0967d','09685','09686','09688','0968a','0968b','0968d','0968e','0968f','09694','09695','09697','09698','09699','0969b','0969c','096a0','096a3','096a7','096a8','096aa','096b0','096b1','096b2','096b4','096b6','096b7','096b8','096b9','096bb','096bc','096be','096c0','096c1','096c4','096c5','096c6','096c7','096c9','096cb','096cc','096cd','096ce','096d1','096d5','096d6','096d9','096db','096dc','096e2','096e3','096e8','096e9','096ea','096eb','096f0','096f2','096f6','096f7','096f9','096fb','09700','09704','09706','09707','09708','0970a','0970d','0970e','0970f','09711','09713','09716','09719','0971c','0971e','09724','09727','0972a','09730','09732','09738','09739','0973d','0973e','09742','09744','09746','09748','09749','0974d','0974f','09751','09752','09756','09759','0975c','0975e','09760','09761','09762','09763','09764','09766','09768','09769','0976b','0976d','09771','09774','09779','0977a','0977c','09781','09784','09785','09786','0978b','0978d','0978f','09790','09798','0979c','097a0','097a3','097a6','097a8','097ab','097ad','097b3','097b4','097c3','097c6','097c8','097cb','097d3','097dc','097ed','097ee','097f2','097f3','097f5','097f6','097fb','097ff','09801','09802','09803','09805','09806','09808','0980c','0980f','09810','09811','09812','09813','09817','09818','0981a','09821','09824','0982c','0982d','09830','09834','09837','09838','0983b','0983c','0983d','09846','0984b','0984c','0984d','0984e','0984f','09854','09855','09858','0985a','0985b','0985e','09867','0986b','0986f','09870','09871','09873','09874','098a8','098aa','098af','098b1','098b6','098c3','098c4','098c6','098db','098dc','098df','098e0','098e2','098e9','098eb','098ed','098ee','098ef','098f2','098f4','098fc','098fd','098fe','09903','09905','09909','0990a','0990c','09910','09912','09913','09914','09918','0991d','0991e','09920','09921','09924','09928','0992c','0992e','0993d','0993e','09942','09945','09949','0994b','0994c','09950','09951','09952','09955','09957','09996','09997','09998','09999','099a5','099a8','099ac','099ad','099ae','099b3','099b4','099bc','099c1','099c4','099c5','099c6','099c8','099d0','099d1','099d2','099d5','099d8','099db','099dd','099df','099e2','099ed','099ee','099f1','099f2','099f8','099fb','099ff','09a01','09a05','09a0e','09a0f','09a12','09a13','09a19','09a28','09a2b','09a30','09a37','09a3e','09a40','09a42','09a43','09a45','09a4d','09a55','09a57','09a5a','09a5b','09a5f','09a62','09a64','09a65','09a69','09a6a','09a6b','09a6c','09aa8','09aad','09ab0','09ab8','09abc','09ac0','09ac4','09acf','09ad1','09ad3','09ad4','09ad8','09ade','09adf','09ae2','09ae3','09ae6','09aea','09aeb','09aed','09aee','09aef','09af1','09af4','09af7','09afb','09b06','09b18','09b1a','09b1f','09b22','09b23','09b25','09b27','09b28','09b29','09b2a','09b2e','09b2f','09b31','09b32','09b3b','09b3c','09b41','09b42','09b43','09b44','09b45','09b4d','09b4e','09b4f','09b51','09b54','09b58','09b5a','09b6f','09b74','09b83','09b8e','09b91','09b92','09b93','09b96','09b97','09b9f','09ba0','09ba8','09baa','09bab','09bad','09bae','09bb4','09bb9','09bc0','09bc6','09bc9','09bca','09bcf','09bd1','09bd2','09bd4','09bd6','09bdb','09be1','09be2','09be3','09be4','09be8','09bf0','09bf1','09bf2','09bf5','09c04','09c06','09c08','09c09','09c0a','09c0c','09c0d','09c10','09c12','09c13','09c14','09c15','09c1b','09c21','09c24','09c25','09c2d','09c2e','09c2f','09c30','09c32','09c39','09c3a','09c3b','09c3e','09c46','09c47','09c48','09c52','09c57','09c5a','09c60','09c67','09c76','09c78','09ce5','09ce7','09ce9','09ceb','09cec','09cf0','09cf3','09cf4','09cf6','09d03','09d06','09d07','09d08','09d09','09d0e','09d12','09d15','09d1b','09d1f','09d23','09d26','09d28','09d2a','09d2b','09d2c','09d3b','09d3e','09d3f','09d41','09d44','09d46','09d48','09d50','09d51','09d59','09d5c','09d5d','09d5e','09d60','09d61','09d64','09d6c','09d6f','09d72','09d7a','09d87','09d89','09d8f','09d9a','09da4','09da9','09dab','09daf','09db2','09db4','09db8','09dba','09dbb','09dc1','09dc2','09dc4','09dc6','09dcf','09dd3','09dd7','09dd9','09de6','09ded','09def','09df2','09df8','09df9','09dfa','09dfd','09e1a','09e1b','09e1e','09e75','09e78','09e79','09e7d','09e7f','09e81','09e88','09e8b','09e8c','09e91','09e92','09e93','09e95','09e97','09e9d','09e9f','09ea5','09ea6','09ea9','09eaa','09ead','09eb5','09eb8','09eb9','09eba','09ebb','09ebc','09ebe','09ebf','09ec3','09ec4','09ecc','09ecd','09ece','09ecf','09ed0','09ed1','09ed2','09ed4','09ed8','09ed9','09edb','09edc','09edd','09ede','09ee0','09ee5','09ee8','09eef','09ef4','09ef6','09ef7','09ef9','09efb','09efc','09efd','09f07','09f08','09f0e','09f13','09f15','09f20','09f21','09f2c','09f3b','09f3e','09f4a','09f4b','09f4e','09f4f','09f52','09f54','09f5f','09f60','09f61','09f62','09f63','09f66','09f67','09f6a','09f6c','09f72','09f76','09f77','09f8d','09f95','09f9c','09f9d','09fa0','0a730','0a731','0a764','0a765','0a766','0a767','0a7af','0f761','0f762','0f763','0f764','0f765','0f766','0f767','0f768','0f769','0f76a','0f76b','0f76c','0f76d','0f76e','0f76f','0f770','0f771','0f772','0f773','0f774','0f775','0f776','0f777','0f778','0f779','0f77a','0f780','0f781','0f782','0f7f1','0f7f2','0f7f3','0f7f4','0f7f5','0f7f6','0f7f7','0f7f8','0f7f9','0f7fa','0f7fb','0f7fc','0f7fd','0f7fe','0f7ff','0f800','0f801','0f802','0f803','0f804','0f805','0f806','0f807','0f808','0f80a','0f80b','0f80c','0f80d','0f80e','0f80f','0f810','0f811','0f812','0f813','0f815','0f817','0f818','0f819','0f81a','0f81b','0f81c','0f91d','0f928','0f929','0f92e','0f936','0f981','0f9a8','0f9ab','0f9ad','0f9af','0f9b0','0f9b1','0f9b2','0f9b4','0f9d0','0f9d1','0f9dc','0fa10','0fa16','0fa19','0fa1a','0fa1b','0fa1e','0fa1f','0fa22','0fa26','0fa30','0fa31','0fa32','0fa33','0fa34','0fa35','0fa37','0fa38','0fa3a','0fa3b','0fa3d','0fa3f','0fa40','0fa41','0fa43','0fa44','0fa45','0fa46','0fa47','0fa48','0fa49','0fa4a','0fa4b','0fa4c','0fa4d','0fa4e','0fa4f','0fa50','0fa51','0fa52','0fa53','0fa54','0fa55','0fa56','0fa57','0fa59','0fa5a','0fa5b','0fa5c','0fa5f','0fa61','0fa62','0fa63','0fa64','0fa65','0fa66','0fa67','0fa68','0fa69','0faff','0fb00','0fb01','0fb02','0fb03','0fb04','0fb05','0fb06','0ff01','0ff02','0ff03','0ff04','0ff05','0ff06','0ff07','0ff08','0ff09','0ff0a','0ff0b','0ff0c','0ff0d','0ff0e','0ff0f','0ff10','0ff11','0ff12','0ff13','0ff14','0ff15','0ff16','0ff17','0ff18','0ff19','0ff1a','0ff1b','0ff1c','0ff1d','0ff1e','0ff1f','0ff20','0ff21','0ff22','0ff23','0ff24','0ff25','0ff26','0ff27','0ff28','0ff29','0ff2a','0ff2b','0ff2c','0ff2d','0ff2e','0ff2f','0ff30','0ff31','0ff32','0ff33','0ff34','0ff35','0ff36','0ff37','0ff38','0ff39','0ff3a','0ff3b','0ff3c','0ff3d','0ff3e','0ff3f','0ff40','0ff41','0ff42','0ff43','0ff44','0ff45','0ff46','0ff47','0ff48','0ff49','0ff4a','0ff4b','0ff4c','0ff4d','0ff4e','0ff4f','0ff50','0ff51','0ff52','0ff53','0ff54','0ff55','0ff56','0ff57','0ff58','0ff59','0ff5a','0ff5b','0ff5c','0ff5d','0ff5e','0ff5f','0ff60','0ff61','0ff62','0ff63','0ff64','0ff65','0ff66','0ff67','0ff68','0ff69','0ff6a','0ff6b','0ff6c','0ff6d','0ff6e','0ff6f','0ff70','0ff71','0ff72','0ff73','0ff74','0ff75','0ff76','0ff77','0ff78','0ff79','0ff7a','0ff7b','0ff7c','0ff7d','0ff7e','0ff7f','0ff80','0ff81','0ff82','0ff83','0ff84','0ff85','0ff86','0ff87','0ff88','0ff89','0ff8a','0ff8b','0ff8c','0ff8d','0ff8e','0ff8f','0ff90','0ff91','0ff92','0ff93','0ff94','0ff95','0ff96','0ff97','0ff98','0ff99','0ff9a','0ff9b','0ff9c','0ff9d','0ff9e','0ff9f','0ffe0','0ffe1','0ffe2','0ffe3','0ffe4','0ffe5','0ffe6']);

    function charExistsInFont(char) {
        const unicodeValue = char.codePointAt(0).toString(16).padStart(5, '0');
        return unicodeSet.has(unicodeValue);
    }

    function replaceKanjiStrokeOrderFont() {
        const kanjiSvg = document.querySelector(CONFIG.kanjiSvgSelector);
        const kanjiPlain = document.querySelector(CONFIG.kanjiPlainSelector);
        if (!kanjiSvg || !kanjiPlain) return;
        const kanjiChar = kanjiPlain.getAttribute('href').split(/[?#]/)[0].split('/').pop();

        if (!charExistsInFont(kanjiChar)) {
            console.error('Kanji not found in the font:', kanjiChar);
            GM_addStyle(STYLES.kanjiFontOverrideFallback);
            return;
        }

        // kanjiSvg.remove();
        const kanjiFont = document.createElement('span');
        kanjiFont.classList.add('kanji-font');
        kanjiFont.textContent = kanjiChar;
        kanjiPlain.appendChild(kanjiFont);

        resizeKanjiStrokeOrderFont();
    }

    function resizeKanjiStrokeOrderFont() {
        const text = document.querySelector('.kanji-font');

        if (!text.parentElement || !text.parentElement.parentElement) return;

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

    async function replaceKanjiStrokeOrderSvg() {
        const kanjiSvg = document.querySelector(CONFIG.kanjiSvgSelector);
        const kanjiPlain = document.querySelector(CONFIG.kanjiPlainSelector);
        if (!kanjiSvg || !kanjiPlain) return;
        const kanjiChar = kanjiPlain.getAttribute('href').split(/[?#]/)[0].split('/').pop();
        const kanjiUnicode = kanjiChar.codePointAt(0).toString(16).padStart(5, '0');
        const strokeOrderUrl = `${CONFIG.strokeOrderRawHost}/${CONFIG.strokeOrderRepo}/${CONFIG.strokeOrderBranch}/${CONFIG.strokeOrderFolder}/${kanjiUnicode}.svg`;

        // Store the original SVG's dimensions
        const originalClass = kanjiSvg.getAttribute('class');

        try {
            const svgContent = (await httpRequest(strokeOrderUrl, 30 * 24 * 60 * 60, true, true, true)).responseText;
            replaceSvgWithCached(svgContent);
        } catch (error) {
            console.error('Error fetching kanji stroke order for kanji:', kanjiChar, error);
            GM_addStyle(STYLES.hideKanjiSvgOverrideFallback);
        }

        function replaceSvgWithCached(svgContent) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = svgContent;
            const newSvg = tempDiv.querySelector('svg');
            if (newSvg) {
                applySvgAttributes(newSvg);
                if (kanjiSvg.parentElement) {
                    kanjiSvg.parentNode.replaceChild(newSvg, kanjiSvg);
                } else {
                    console.warn('Parent of original SVG not found. This can be ignored if the SVG was already replaced.');
                }
            } else {
                console.error('New SVG not found in the cached content');
            }
        }

        function applySvgAttributes(newSvg) {
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
        if (USER_SETTINGS.useFontInsteadOfSvg()) {
            replaceKanjiStrokeOrderFont();
        } else {
            replaceKanjiStrokeOrderSvg();
        }
    }

    // Debug function to cache all stroke order SVGs
    async function cacheAllKanjiStrokeOrder() {
        if (STATE.currentlyBuildingKanjiCache) {
            return;
        }

        STATE.currentlyBuildingKanjiCache = true;

        async function getAllFiles(repo, path, branch = 'main') {
            const baseUrl = 'https://api.github.com';

            // Function to make API requests
            async function fetchGitHubAPI(url) {
                const response = await httpRequest(url, -1);
                if (response.status !== 200) {
                    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
                }
                return JSON.parse(response.responseText);
            }

            try {
                // Get the latest commit SHA for the specified branch
                const branchUrl = `${baseUrl}/repos/${repo}/branches/${branch}`;
                const branchData = await fetchGitHubAPI(branchUrl);
                const latestSha = branchData.commit.sha;

                // Get the tree using the recursive parameter
                const treeUrl = `${baseUrl}/repos/${repo}/git/trees/${latestSha}?recursive=1`;
                const treeData = await fetchGitHubAPI(treeUrl);

                // Filter files in the specified path
                const files = treeData.tree.filter((item) => item.type === 'blob' && item.path.startsWith(path));

                return files;
            } catch (error) {
                console.error('Error fetching files:', error);
                throw error;
            }
        }

        const files = await getAllFiles(CONFIG.strokeOrderRepo, CONFIG.strokeOrderFolder, CONFIG.strokeOrderBranch);
        const fileUrls = files
            .filter((file) => file.path.split('/').pop().split('.')[0].length === 5 && file.path.endsWith('.svg'))
            .map((file) => `${CONFIG.strokeOrderRawHost}/${CONFIG.strokeOrderRepo}/${CONFIG.strokeOrderBranch}/${file.path}`);

        const progressBar = document.getElementById('kanji-cache-progress');
        progressBar.style.display = 'grid';

        const progress = progressBar.children[0];
        const progressText = progressBar.children[1].children[0];

        const total = fileUrls.length;
        let count = 0;
        const promises = [];
        while (fileUrls.length > 0) {
            const urls = fileUrls.splice(0, 50);
            const batchPromises = urls.map((url) =>
                httpRequest(url, 30 * 24 * 60 * 60, false, false, true).then(() => {
                    count++;
                    progress.style.width = `${(count / total) * 100}%`;
                    progressText.textContent = `${count}/${total} (${((count / total) * 100).toFixed(2)}%)`;
                })
            );
            promises.push(Promise.all(batchPromises));
            await Promise.all(promises);
        }

        progressBar.style.display = 'none';
        STATE.currentlyBuildingKanjiCache = false;
    }

    function initLearnPage() {
        replaceDeckList();
        hideDeckListLink();

        let lastProcessedMutation = null;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (
                    mutation.type === 'childList' &&
                    mutation.target.classList.contains(CONFIG.deckListClass) &&
                    !mutation.target.classList.contains(CONFIG.newDeckListClass)
                ) {
                    // Check if this mutation is different from the last processed one
                    if (mutation !== lastProcessedMutation) {
                        replaceDeckList();
                        hideDeckListLink();
                        lastProcessedMutation = mutation;
                    }
                    break; // Exit the loop after processing the first relevant mutation
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    async function initReviewPage() {
        styleReviewButtons();

        if (USER_SETTINGS.buttonSoundDelay() === -1) {
            function initPageLoadTime() {
                // Function to measure page load time
                function measurePageLoadTime() {
                    if (performance && performance.timing) {
                        const navTiming = performance.timing;
                        const loadTime = navTiming.loadEventEnd - navTiming.navigationStart;

                        // Store the load time
                        GM_setValue('reviewPageLoadTime', loadTime);
                    }
                }

                // Measure load time when the page is fully loaded
                window.addEventListener('load', function () {
                    // Wait a short time to ensure loadEventEnd is set
                    setTimeout(measurePageLoadTime, 0);
                });
            }

            initPageLoadTime();
        }

        if (USER_SETTINGS.enableButtonEffects() && !STATE.cachedEffects) {
            const effectUrls = [].concat(CONFIG.lottieSparkles, CONFIG.lottieSmallFireworks, CONFIG.lottieBigFireworks);
            console.log('Caching review button effects:', effectUrls);
            for (const effectUrl of effectUrls) {
                await httpRequest(effectUrl, 30 * 24 * 60 * 60, true, false, true);
            }
            STATE.cachedEffects = true;
            GM_setValue('cachedEffects', true);
        }

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
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            checkAndReplaceKanji(node);
                        }
                    });
                }
            });
        });

        function checkAndReplaceKanji(node) {
            if (node.matches('svg.kanji') && !node.classList.contains('stroke-order-kanji')) {
                replaceKanjiStrokeOrder(node);
            }
            node.querySelectorAll('svg.kanji:not(.stroke-order-kanji)').forEach((svg) => {
                replaceKanjiStrokeOrder(svg);
            });
        }

        observer.observe(document.body, { childList: true, subtree: true });

        if (USER_SETTINGS.useFontInsteadOfSvg()) {
            window.addEventListener('load', resizeKanjiStrokeOrderFont);
            window.addEventListener('resize', resizeKanjiStrokeOrderFont);
        }
    }

    function kanjiCopyButton() {
        // Find the element with class "subsection-label" that includes the text "Keyword "
        const keywordElement = Array.from(document.querySelectorAll('.subsection-label')).find((el) => el.textContent.includes('Keyword'));

        if (!keywordElement) return;

        // Parse the kanji from the associated <a> element
        const kanjiElement = keywordElement.querySelector('a');
        if (!kanjiElement || !kanjiElement.href) return;

        const kanji = new URLSearchParams(new URL(kanjiElement.href).search).get('k');
        if (!kanji) return;

        const kanjiMeaning = keywordElement.nextSibling.textContent.trim();
        if (!kanjiMeaning) return;

        // Find the element of class "subsection-composed-of-kanji"
        const composedOfElement = document.querySelector('.subsection-composed-of-kanji');
        if (!composedOfElement) return;

        // Parse all the kanji and their descriptions
        const components = Array.from(composedOfElement.querySelectorAll('.spelling a'));
        const descriptions = Array.from(composedOfElement.querySelectorAll('.description'));

        let composedText = `${kanji}\n${kanjiMeaning}\n\n`;
        components.forEach((component, index) => {
            composedText += `${component.textContent}\n${descriptions[index].textContent}\n`;
        });

        // Add a small button next to the "Composed of" label
        const composedLabel = composedOfElement.querySelector('.subsection-label');
        if (!composedLabel) return;

        const buttonContainer = document.createElement('button');
        buttonContainer.classList.add('kanji-copy-button'); // Add a class to the container

        const copyButton = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        copyButton.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        copyButton.setAttribute('viewBox', '0 0 24 24');
        copyButton.classList.add('kanji-copy-button-svg');
        copyButton.innerHTML = `<path d="M0 0h24v24H0V0z" fill="none"/><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>`;

        // Match the font size of .subsection-label
        const subsectionLabelStyle = window.getComputedStyle(composedLabel);
        copyButton.style.width = subsectionLabelStyle.fontSize;
        copyButton.style.height = subsectionLabelStyle.fontSize;

        buttonContainer.appendChild(copyButton);

        buttonContainer.addEventListener('click', () => {
            GM_setClipboard(composedText.trim());
        });

        // Dispatch a custom event to notify other scripts what the components are
        document.dispatchEvent(new CustomEvent('kanjiComponents', { detail: { componentString: composedText.trim() } }));

        composedLabel.appendChild(buttonContainer);
    }

    function initKanjiCopyButton() {
        kanjiCopyButton();

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node && node.classList && node.classList.contains('subsection-composed-of-kanji')) {
                            kanjiCopyButton();
                        } else if (node && node.querySelectorAll) {
                            node.querySelectorAll('.subsection-composed-of-kanji').forEach((subNode) => {
                                kanjiCopyButton();
                                return;
                            });
                        }
                    });
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function shiftMoveDecks() {
        let originalValues = new Map();

        return function (setValue) {
            const deckElements = document.querySelectorAll('.deck');
            deckElements.forEach((deck) => {
                const inputs = deck.querySelectorAll('input[type="hidden"][name="delta"]');
                inputs.forEach((input) => {
                    if (setValue) {
                        originalValues.set(input, input.value);
                        input.value *= 9999;
                    } else {
                        input.value = originalValues.get(input) || input.value;
                    }
                });
            });
        };
    }

    function initShiftMoveDecks() {
        const mover = shiftMoveDecks();

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Shift') {
                mover(true);
            }
        });

        document.addEventListener('keyup', function (event) {
            if (event.key === 'Shift') {
                mover(false);
            }
        });
    }

    function handleCtrlEnter(event) {
        const submittableInputTypes = ['text', 'search'];
        const input = event.target;
        const form = input.closest('form');

        if (form && input.matches('input') && submittableInputTypes.includes(input.type)) {
            event.preventDefault();

            // Create a clone of the form
            const clonedForm = form.cloneNode(true);

            // Set the target to _blank to open in a new tab
            clonedForm.target = '_blank';

            // Append the cloned form to the body, submit it, and remove it
            document.body.appendChild(clonedForm);
            clonedForm.submit();
            document.body.removeChild(clonedForm);

            // Attempt to focus on the new tab (may not work in all browsers)
            window.focus();
        }
    }

    function initCtrlEnter() {
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && event.ctrlKey) {
                handleCtrlEnter(event);
            }
        });
    }

    function isNothingFocused() {
        const activeElement = document.activeElement;
        const isBodyFocused = activeElement === document.body;
        const isContentEditable = activeElement.isContentEditable;

        // ['INPUT', 'TEXTAREA', 'SELECT']
        // return isBodyFocused || (!isContentEditable && !['INPUT', 'TEXTAREA'].includes(activeElement.tagName));
        return isBodyFocused || (!isContentEditable && !['text', 'search'].includes(activeElement.type));
    }

    // Search overlay functions
    ////////////////////////////////////////////////////////////////////////////
    function createSearchOverlay(searchForm) {
        const searchOverlay = document.createElement('div');
        searchOverlay.classList.add('injected-search-overlay');
        searchOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: ${USER_SETTINGS.searchBarOverlayTransition() ? 'rgba(0, 0, 0, 0)' : 'rgba(0, 0, 0, 0.7)'};
            backdrop-filter: blur(${USER_SETTINGS.searchBarOverlayTransition() ? '0' : '1'}px);
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding-top: 20vh;
            z-index: 9999;
            ${
                USER_SETTINGS.searchBarOverlayTransition()
                    ? 'transition: background-color ' +
                      CONFIG.searchOverlayTransitionDuration +
                      'ms ease, backdrop-filter ' +
                      CONFIG.searchOverlayTransitionDuration +
                      'ms ease;'
                    : ''
            }
        `;

        const searchContainer = document.createElement('div');
        if (USER_SETTINGS.searchBarOverlayTransition()) {
            searchContainer.style.cssText = `
                transform: scale(0.75);
                opacity: 0;
                transition: transform ${CONFIG.searchOverlayTransitionDuration}ms ease, opacity ${CONFIG.searchOverlayTransitionDuration}ms ease;
            `;
        }
        searchContainer.appendChild(searchForm);
        searchOverlay.appendChild(searchContainer);

        document.body.appendChild(searchOverlay);

        // Focus on the search input
        const searchInput = searchForm.querySelector('input[type="search"]');
        if (searchInput) {
            searchInput.focus();
        }

        // Add glow to search input
        searchInput.style.cssText += `
            box-shadow: 0 0 12px var(--link-color);
            min-width: 40vw;
            max-width: 80vw;
        `;

        if (USER_SETTINGS.searchBarOverlayTransition()) {
            // Trigger the fade-in and pop-up effect
            setTimeout(() => {
                searchOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                searchOverlay.style.backdropFilter = 'blur(1px)';
                searchContainer.style.transform = 'scale(1)';
                searchContainer.style.opacity = '1';
            }, 10);
        }

        // Prevent any hotkey events from triggering
        searchOverlay.addEventListener('keydown', function (event) {
            if (!['Escape', 'Enter', '/'].includes(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey) {
                event.stopPropagation();
            }
            if (event.key === 'Escape') {
                removeSearchOverlay();
            }
        });

        // Close the overlay when the Escape key is pressed
        document.addEventListener(
            'keydown',
            function (event) {
                if (event.key === 'Escape') {
                    removeSearchOverlay();
                }
            },
            { once: true }
        );

        // Close overlay when clicking outside the search form
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) {
                removeSearchOverlay();
            }
        });

        return searchOverlay;
    }

    function removeSearchOverlay() {
        const searchOverlay = document.querySelector('.injected-search-overlay');
        if (searchOverlay) {
            const searchContainer = searchOverlay.firstElementChild;

            if (USER_SETTINGS.searchBarOverlayTransition()) {
                // Trigger the fade-out and shrink effect
                searchOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
                searchOverlay.style.backdropFilter = 'blur(0px)';
                searchContainer.style.transform = 'scale(0.75)';
                searchContainer.style.opacity = '0';

                // Remove the overlay after the transition
                setTimeout(() => {
                    document.body.removeChild(searchOverlay);
                }, CONFIG.searchOverlayTransitionDuration);
            } else {
                document.body.removeChild(searchOverlay);
            }
        }
    }

    async function fetchSearchForm() {
        const searchOverlay = document.querySelector('.injected-search-overlay');
        if (searchOverlay) {
            return;
        }
        const response = await httpRequest('https://jpdb.io/', 24 * 60 * 60, true);

        const parser = new DOMParser();
        const doc = parser.parseFromString(response.responseText, 'text/html');
        const searchForm = doc.querySelector('form[action="/search#a"]');
        if (searchForm) {
            createSearchOverlay(searchForm.cloneNode(true));
        }
    }

    function showSearchBar(event) {
        if (isNothingFocused()) {
            event.preventDefault();
            const searchBar = document.querySelector('input[type="search"]');
            if (searchBar) {
                searchBar.focus();
            } else {
                fetchSearchForm();
            }
        }
    }

    function initShowSearchBar() {
        document.addEventListener('keydown', function (event) {
            if (event.key === '/') {
                showSearchBar(event);
            }
        });
    }
    ////////////////////////////////////////////////////////////////////////////

    // Function to add settings section to the form
    function addSettingsSection() {
        const settingsForm = document.querySelector('form[action="/settings"]');
        if (settingsForm) {
            const formDivs = settingsForm.querySelectorAll('div');
            const submitButtonDiv = Array.from(formDivs)
                .reverse()
                .find((div) => div.querySelector('input[type="submit"]'));

            if (submitButtonDiv) {
                let sectionsHTML = '';
                for (const setting of Object.values(USER_SETTINGS)) {
                    let indent = 0;
                    let dependency = setting.getDependency();
                    let highestDependency = dependency;
                    while (dependency !== null) {
                        highestDependency = dependency;
                        indent += 1.5;
                        dependency = dependency.getDependency();
                    }

                    const extraIndent = `${indent}rem`;
                    const hiddenClass = highestDependency !== null && !highestDependency() ? ' class="hidden"' : '';

                    // check if type is boolean
                    if (setting.getPossibleValues()) {
                        sectionsHTML += `
                            <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 1rem; margin-left: ${extraIndent};"${hiddenClass}>
                                <label style="margin-left: 2rem;" for="${setting.getName()}">${setting.getShortDescription()}</label>
                                <select id="${setting.getName()}" name="${setting.getName()}" style="flex-grow: 0;flex-shrink: 1;width: auto;margin-left: 0.3rem; font-family: monospace;">
                                    ${setting
                                        .getPossibleValues()
                                        .map(
                                            (value) => `<option value="${value}" ${setting() === value ? 'selected' : ''}>${value}</option>`
                                        )
                                        .join('')}
                                </select>
                                ${setting.getLongDescription() ? `<p style="opacity: 0.8;">\n${setting.getLongDescription()}\n</p>` : ''}
                            </div>
                        `;
                    } else if (typeof setting() === 'boolean') {
                        sectionsHTML += `
                            <div style="margin-left: ${extraIndent};"${hiddenClass}>
                            <div class="checkbox">
                                <input type="checkbox" id="${setting.getName()}" name="${setting.getName()}" ${setting() ? 'checked' : ''}>
                                <label for="${setting.getName()}">${setting.getShortDescription()}</label>
                            </div>
                            ${
                                setting.getLongDescription()
                                    ? `<p style="margin-left: 2rem; opacity: 0.8;">\n${setting.getLongDescription()}\n</p>`
                                    : ''
                            }
                            </div>
                        `;
                    } else if (typeof setting() === 'number') {
                        sectionsHTML += `
                            <div style="margin-left: ${extraIndent};"${hiddenClass}>
                                <label for="${setting.getName()}">${setting.getShortDescription()}</label>
                                <input style="max-width: 16rem;" type="number" id="${setting.getName()}" name="${setting.getName()}" step="any" value="${setting()}">
                                ${setting.getLongDescription() ? `<p style="opacity: 0.8;">\n${setting.getLongDescription()}\n</p>` : ''}
                            </div>
                        `;
                    } else {
                        sectionsHTML += `
                            <div style="margin-left: ${extraIndent};"${hiddenClass}>
                                <label for="${setting.getName()}">${setting.getShortDescription()}</label>
                                <input style="max-width: 16rem;" type="text" id="${setting.getName()}" name="${setting.getName()}" value="${setting()}">
                                ${setting.getLongDescription() ? `<p style="opacity: 0.8;">\n${setting.getLongDescription()}\n</p>` : ''}
                            </div>
                        `;
                    }
                }

                const buildKanjiCache = `
                    <div style="padding-bottom: 1rem;"></div>
                    <div>
                        <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 1rem;">
                            <div id="build-kanji-cache">
                                <input type="submit" class="outline" value="Build Kanji Cache">
                            </div>
                            <p style="opacity: 0.8;">This will cache all stroke order SVGs for faster loading times.</p>
                        </div>
                        <div id="kanji-cache-progress" style=" background-color: var(--progress-bar-background); min-height: 0.5rem; width: 100%; border-radius: 4px; /* display: grid; */ display: none; "> <div style=" z-index: 1; background: var(--progress-bar-foreground); width: progress_here; border-radius: 4px; grid-row: 1; grid-column: 1; border-top-right-radius: 0; border-bottom-right-radius: 0; " ></div> <div style=" z-index: 2; font-weight: bold; text-align: center; grid-row: 1; grid-column: 1; text-align: right; text-shadow: var(--progress-bar-text-shadow) 1px 1px 1px; color: white; padding: 0.2rem 0.45rem; font-size: 75%; display: flex; justify-content: space-between; column-gap: 1rem; " > <div>0/0 (0%)</div> </div></div>
                    </div>
                `;

                const resetSettings = `
                    <div style="padding-bottom: 1rem;"></div>
                    <div>
                        <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 1rem;">
                            <div id="reset-settings"><input type="submit" class="outline v1" value="Reset Userscript Settings"></div>
                            <div id="reset-kanji-cache"><input type="submit" class="outline v1" value="Reset Kanji Cache"></div>
                        </div>
                        <p style="opacity: 0.8;"></p>
                    </div>
                `;

                const settingsHTML = `
                    <h6>${GM_info.script.name} Settings</h6>
                    <div>
                        ${sectionsHTML}
                        ${buildKanjiCache}
                        ${resetSettings}
                    </div>
                    <div style="padding-bottom: 1.5rem;"></div>
                `;

                submitButtonDiv.previousSibling.insertAdjacentHTML('beforebegin', settingsHTML);

                // call cacheAllKanjiStrokeOrder function when button is clicked
                const buildKanjiCacheButton = document.getElementById('build-kanji-cache');
                buildKanjiCacheButton.addEventListener('click', function (event) {
                    event.preventDefault();
                    cacheAllKanjiStrokeOrder();
                });

                // call resetSettings function when button is clicked
                const resetSettingsButton = document.getElementById('reset-settings');
                resetSettingsButton.addEventListener('click', function (event) {
                    event.preventDefault();
                    const successful = removeAllGMValues();
                    const parentDiv = resetSettingsButton.parentElement.parentElement;
                    const p = parentDiv.querySelector('p');
                    p.textContent = successful ? 'Settings reset successfully.' : 'Settings reset failed.';
                    settingsForm.submit();
                });

                const resetKanjiCacheButton = document.getElementById('reset-kanji-cache');
                resetKanjiCacheButton.addEventListener('click', function (event) {
                    event.preventDefault();
                    purgeHttpRequestCache();
                    const parentDiv = resetKanjiCacheButton.parentElement.parentElement;
                    const p = parentDiv.querySelector('p');
                    p.textContent = 'Kanji cache reset.';
                    settingsForm.submit();
                });

                // add event listener to toggle hidden class
                for (const setting of Object.values(USER_SETTINGS)) {
                    const dependency = setting.getDependency();
                    if (!dependency) {
                        continue;
                    }

                    const dependentElement = settingsForm.querySelector(`[name="${setting.getName()}"]`);
                    const dependencyElement = settingsForm.querySelector(`[name="${dependency.getName()}"]`);

                    if ((!dependentElement || !dependencyElement) || dependencyElement.dataset.dependent) {
                        continue;
                    }

                    // find all elements that depend on the dependencyElement
                    const dependentSettings = []
                    for (const setting of Object.values(USER_SETTINGS)) {
                        const subDependency = setting.getDependency();
                        if (!subDependency) {
                            continue;
                        }
                        if (subDependency.getName() === dependency.getName()) {
                            dependentSettings.push(setting);
                        }
                    }

                    dependencyElement.addEventListener('change', function () {
                        console.log(`Event triggered on ${dependencyElement.name}`);
                        for (const dependentSetting of dependentSettings) {
                            const dependentElement = settingsForm.querySelector(`[name="${dependentSetting.getName()}"]`);
                            if (dependentElement.type === 'checkbox') {
                                dependentElement.parentElement.parentElement.classList.toggle('hidden');
                            } else {
                                dependentElement.parentElement.classList.toggle('hidden');
                            }
                            console.log(`Toggled hidden class on ${dependentElement.name}`);

                            // trigger change event
                            dependentElement.dispatchEvent(new Event('change'));
                        }
                    });

                    // set value to prevent attaching event listener multiple times
                    dependencyElement.dataset.dependent = 'true';
                }

                // Add event listener to the form submission
                settingsForm.addEventListener('submit', function (e) {
                    e.preventDefault();

                    // Update USER_SETTINGS based on the values
                    for (const setting of Object.values(USER_SETTINGS)) {
                        const input = settingsForm.querySelector(`input[name="${setting.getName()}"]`);
                        const select = settingsForm.querySelector(`select[name="${setting.getName()}"]`);
                        if (input) {
                            if (typeof setting() === 'boolean') {
                                setting(input.checked);
                            } else if (typeof setting() === 'number') {
                                setting(Number(input.value));
                            } else {
                                setting(input.value);
                            }
                        } else if (select) {
                            setting(select.value);
                        }
                    }

                    // Submit the form
                    this.submit();
                });
            }
        }
    }

    function unblurSentenceOnClick() {
        GM_addStyle(STYLES.sentenceBlur);

        document.addEventListener('click', function (event) {
            if (event.target.classList.contains('sentence-translation')) {
                event.target.classList.toggle('unblur');
            }
        });
    }

    async function initTranslation() {
        // Flag to prevent observer from triggering itself
        let isTranslating = false;

        // Function to translate text
        function translate(text) {
            const language = USER_SETTINGS.translationLanguage();
            if (language === 'None' || !TRANSLATIONS[language]) return text;

            // Function to decode HTML entities
            function decodeHTMLEntities(text) {
                if (text && typeof text === 'string') {
                    text = text.replace(/<script[^>]*>([\S\s]*?)<\/script>/gim, '');
                    text = text.replace(/<\/?\w(?:[^"'>]|"[^"]*"|'[^']*')*>/gim, '');
                }
                return text.normalize('NFKC');
            }

            // Decode HTML entities in the input text
            const decodedText = decodeHTMLEntities(text);

            // Check for exact match first
            if (TRANSLATIONS[language][decodedText.trim()]) {
                return TRANSLATIONS[language][decodedText.trim()];
            }

            // Check for regex pattern matches
            for (const [pattern, translation] of Object.entries(TRANSLATIONS[language])) {
                if (pattern.startsWith('/') && pattern.endsWith('/')) {
                    // It's a regex pattern
                    const regexPattern = new RegExp(pattern.slice(1, -1));
                    const match = decodedText.trim().match(regexPattern);
                    if (match) {
                        let result = translation;
                        for (let i = 0; i < match.length; i++) {
                            // Use a non-greedy replace to avoid nested replacements
                            result = result.replace(new RegExp(`\\{${i}\\}`, 'g'), () => match[i] || '');
                        }
                        return result;
                    }
                }
            }

            // If no match found, return original text
            return text;
        }

        // Function to translate an element and its attributes
        function translateElement(element) {
            if (element.nodeType !== Node.ELEMENT_NODE) return;

            // Check if the element has already been translated
            if (element.classList.contains('translated')) return;

            let wasTranslated = false;

            // Translate text content if the element only contains text
            element.childNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const originalText = node.textContent.trim();
                    if (originalText) {
                        // Only process non-empty text
                        const translatedText = translate(originalText);
                        if (originalText !== translatedText) {
                            node.textContent = translatedText;
                            wasTranslated = true;
                        }
                    }
                }
            });

            // Translate attributes
            const translatableAttributes = ['placeholder', 'value', 'title', 'alt', 'aria-label'];
            translatableAttributes.forEach((attr) => {
                if (element.hasAttribute(attr)) {
                    const originalText = element.getAttribute(attr);
                    const translatedText = translate(originalText);
                    if (originalText !== translatedText) {
                        element.setAttribute(attr, translatedText);
                        wasTranslated = true;
                    }
                }
            });

            // Handle special cases for specific elements
            if (element.tagName === 'INPUT' && element.type === 'submit') {
                const originalValue = element.value;
                const translatedValue = translate(originalValue);
                if (originalValue !== translatedValue) {
                    element.value = translatedValue;
                    wasTranslated = true;
                }
            }
            if (element.tagName === 'META' && element.name === 'description') {
                const originalContent = element.content;
                const translatedContent = translate(originalContent);
                if (originalContent !== translatedContent) {
                    element.content = translatedContent;
                    wasTranslated = true;
                }
            }

            if (wasTranslated) {
                element.setAttribute('lang', USER_SETTINGS.translationLanguage());
                element.classList.add('translated');
            }
        }

        // Function to translate all elements in the document
        function translateAllElements() {
            isTranslating = true;
            const allElements = document.getElementsByTagName('*');
            for (let element of allElements) {
                translateElement(element);
            }
            isTranslating = false;
        }

        // Set up MutationObserver to handle dynamically added elements
        const observer = new MutationObserver((mutations) => {
            if (isTranslating) return;

            isTranslating = true;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            translateAllElements();
                        }
                    });
                } else if (mutation.type === 'attributes') {
                    translateAllElements();
                }
            });
            isTranslating = false;
        });

        // Start observing the document
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['placeholder', 'value', 'title', 'alt', 'aria-label'],
        });

        // Run initial translation
        translateAllElements();
    }

    function initMonolingualMachineTranslation() {
        async function machineTranslate(text, cacheTime = 7 * 24 * 60 * 60) {
            const response = await httpRequest(
                `https://jpdb.io/search?q=${encodeURIComponent(text)}&lang=english#a`,
                cacheTime,
                false,
                false,
                false,
                false
            );
            const parser = new DOMParser();
            const doc = parser.parseFromString(response.responseText, 'text/html');
            const translation = doc.querySelector('#machine-translation');
            if (translation.classList.contains('translation-in-progress')) {
                const translationId = response.responseText.match(/translation\?id=(\d+)/)[1];
                const translationResponse = await httpRequest(
                    `https://jpdb.io/translation?id=${translationId}`,
                    cacheTime,
                    false,
                    false,
                    false,
                    false
                );
                return {
                    success: true,
                    translation: translationResponse.responseText.trim(),
                };
            } else {
                if (translation) {
                    return {
                        success: true,
                        translation: translation.textContent.trim(),
                    };
                }

                return {
                    success: false,
                    translation: '',
                };
            }
        }

        function getJPText(jpElement) {
            const clonedContents = jpElement.cloneNode(true);
            const div = document.createElement('div');
            div.appendChild(clonedContents);

            div.querySelectorAll('ruby rt').forEach((rt) => rt.remove());

            return div.innerText
                .replace(/<br>/g, '\n')
                .replace(/\n/g, ' ')
                .replace(/<[^>]*>/g, '')
                .trim();
        }

        function addMachineTranslation() {
            const usedInElements = document.querySelectorAll('.used-in');
            usedInElements.forEach((usedInElement) => {
                const jpElement = usedInElement.querySelector('.jp');
                const enElement = usedInElement.querySelector('.en');

                if (jpElement && !enElement) {
                    const enElement = document.createElement('div');
                    enElement.classList.add('en');
                    enElement.classList.add('pending-translation');
                    enElement.textContent = 'Click to translate';
                    usedInElement.appendChild(enElement);
                    const cacheTime = 7 * 24 * 60 * 60;
                    async function translateText() {
                        const jpText = getJPText(jpElement);
                        enElement.textContent = 'Translating...';
                        const { success, translation } = await machineTranslate(jpText, cacheTime);
                        if (success) {
                            enElement.textContent = translation;
                            enElement.classList.remove('pending-translation');
                            enElement.removeEventListener('click', translateText);
                        } else {
                            enElement.textContent = 'Translation failed. Click to try again.';
                            cacheTime = 0;
                        }
                    }
                    enElement.addEventListener('click', translateText);
                }
            });

            const cardSentence = document.querySelector('.card-sentence');
            const reviewReveal = document.querySelector('.review-reveal');
            const sentenceTranslation = cardSentence?.parentElement?.querySelector('.sentence-translation');
            if (cardSentence && !sentenceTranslation && reviewReveal) {
                const jpElement = cardSentence.querySelector('.sentence');
                const enElement = `<div style="display: flex;justify-content: center;"><div class="sentence-translation" style="">Click to translate</div></div>`;
                cardSentence.insertAdjacentHTML('afterend', enElement);
                const cacheTime = 7 * 24 * 60 * 60;
                async function translateText() {
                    const jpText = getJPText(jpElement);
                    const enElement = cardSentence.nextElementSibling.querySelector('.sentence-translation');
                    enElement.textContent = 'Translating...';
                    const { success, translation } = await machineTranslate(jpText);
                    if (success) {
                        enElement.textContent = translation;
                        enElement.classList.remove('pending-translation');
                        enElement.removeEventListener('click', translateText);
                    } else {
                        enElement.textContent = 'Translation failed. Click to try again.';
                        cacheTime = 0;
                    }
                }
                cardSentence.nextElementSibling.querySelector('.sentence-translation').addEventListener('click', translateText);
            }
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            addMachineTranslation();
                        }
                    });
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });

        addMachineTranslation();
    }

    function initInjectStatsIntoLearnPage() {
        function addReviewStats() {
            async function injectReviewStats() {
                if (document.querySelector('.injected-stats')) return;

                const container = document.querySelector('.container');
                if (!container) return;
                const table = container.querySelector('table');
                if (!table) return;
                const stats = table.parentElement;
                const div = document.createElement('div');
                stats.insertAdjacentElement('afterend', div);
                div.classList.add('injected-stats');
                const statsResponse = await httpRequest('https://jpdb.io/stats', -1);

                const parser = new DOMParser();
                const doc = parser.parseFromString(statsResponse.responseText, 'text/html');
                const chart = doc.getElementById('chart');

                const scripts = doc.querySelectorAll('script');
                let script = null;
                scripts.forEach((s) => {
                    if (s.textContent.includes('document.getElementById("chart")')) {
                        script = s;
                    }
                });
                console.log(script);
                if (chart && script) {
                    script.textContent = script.textContent.replace('DOMContentLoaded', 'loadInjectedStats');

                    div.appendChild(chart);

                    GM_addStyle(`
                        #chart {
                            height: 15rem !important;
                        }
                    `);

                    const head = doc.querySelector('head');
                    const scriptsInHead = head.querySelectorAll('script');
                    const currentHead = document.head;
                    const currentScripts = currentHead.querySelectorAll('script');

                    const scriptPromises = [];

                    scriptsInHead.forEach((s) => {
                        let found = false;
                        currentScripts.forEach((cs) => {
                            if (s.src === cs.src) {
                                found = true;
                            }
                        });
                        if (!found) {
                            const newScript = document.createElement('script');
                            newScript.src = s.src;

                            const scriptPromise = new Promise((resolve, reject) => {
                                newScript.onload = resolve;
                                newScript.onerror = reject;
                            });
                            scriptPromises.push(scriptPromise);

                            currentHead.appendChild(newScript);
                        }
                    });

                    const newScript = document.createElement('script');
                    newScript.textContent = script.textContent;
                    currentHead.appendChild(newScript);

                    Promise.all(scriptPromises).then(() => {
                        document.dispatchEvent(new Event('loadInjectedStats'));
                    });
                }
            }
            injectReviewStats();

            let lastProcessedMutation = null;

            const observer = new MutationObserver(async (mutations) => {
                for (const mutation of mutations) {
                    if (mutation === lastProcessedMutation) {
                        continue;
                    }
                    lastProcessedMutation = mutation;
                    if (mutation.type === 'childList') {
                        if (mutation.target.classList.contains('container')) {
                            await injectReviewStats();
                        }
                    }
                }
            });

            observer.observe(document.body.querySelector('.container'), { childList: true, subtree: true });
        }

        function addKnownVocabularyStats() {
            async function injectKnownVocabularyStats() {
                if (document.querySelector('.injected-vocab-stats')) return;

                const container = document.querySelector('.container');
                if (!container) return;
                const table = container.querySelector('table');
                if (!table) return;

                try {
                    const knownVocabResponse = await httpRequest('https://jpdb.io/labs/known-vocabulary-over-time', -1);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(knownVocabResponse.responseText, 'text/html');
                    const chart = doc.getElementById('chart3');
                    const tbody = document.createElement('tbody');
                    tbody.classList.add('injected-vocab-stats');
                    tbody.style.display = 'inline-block';
                    table.querySelector('tbody').style.display = 'inline-block';

                    tbody.appendChild(chart);
                    table.appendChild(tbody);

                    const head = doc.querySelector('head');
                    const scriptsInHead = head.querySelectorAll('script');
                    const currentHead = document.head;
                    const currentScripts = currentHead.querySelectorAll('script');

                    const scriptPromises = [];

                    scriptsInHead.forEach((s) => {
                        let found = false;
                        currentScripts.forEach((cs) => {
                            if (s.src === cs.src) {
                                found = true;
                            }
                        });
                        if (!found) {
                            const newScript = document.createElement('script');
                            newScript.src = s.src;

                            const scriptPromise = new Promise((resolve, reject) => {
                                newScript.onload = resolve;
                                newScript.onerror = reject;
                            });
                            scriptPromises.push(scriptPromise);

                            currentHead.appendChild(newScript);
                        }
                    });

                    const scripts = doc.querySelectorAll('script');
                    let script = null;
                    scripts.forEach((s) => {
                        if (s.textContent.includes('document.getElementById("chart3")')) {
                            script = s;
                        }
                    });

                    if (script) {
                        script.textContent = script.textContent.replace('DOMContentLoaded', 'loadInjectedVocabStats');
                        const dataRegex = /var\s?data\s?=\s?({\s?.+?\s?});/;
                        let data = script.textContent.match(new RegExp(dataRegex))[1];
                        // replace unquoted keys with quoted keys
                        data = data.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": ');
                        const dataObj = JSON.parse(data);
                        // find the first index of the first non-zero value in data["datasets"][0]["data"]
                        const firstNonZeroIndex = dataObj['datasets'][0]['data'].findIndex((value) => value > 0);
                        // remove every element before the first non-zero value in data["datasets"][0]["data"] and data["labels"]
                        dataObj['datasets'][0]['data'] = dataObj['datasets'][0]['data'].slice(firstNonZeroIndex);
                        dataObj['labels'] = dataObj['labels'].slice(firstNonZeroIndex);
                        script.textContent = script.textContent.replace(dataRegex, `var data = ${JSON.stringify(dataObj)};`);

                        const newScript = document.createElement('script');
                        newScript.textContent = script.textContent;
                        currentHead.appendChild(newScript);
                    }

                    Promise.all(scriptPromises).then(() => {
                        const initialWidth = chart.style.width;
                        const initialHeight = chart.style.height;
                        try {
                            document.dispatchEvent(new Event('loadInjectedVocabStats'));
                        } catch (error) {}
                        GM_addStyle(`
                            .injected-vocab-stats {
                                height: 10rem;
                            }

                            #chart3 {
                                margin: 0 !important;
                            }
                        `);
                    });
                } catch (error) {
                    console.warn('Failed to fetch known vocabulary stats:', error);
                }
            }
            injectKnownVocabularyStats();

            let lastProcessedMutation = null;

            const observer = new MutationObserver(async (mutations) => {
                for (const mutation of mutations) {
                    if (mutation === lastProcessedMutation) {
                        continue;
                    }
                    lastProcessedMutation = mutation;
                    if (mutation.type === 'childList') {
                        if (mutation.target.classList.contains('container')) {
                            await injectKnownVocabularyStats();
                        }
                    }
                }
            });

            observer.observe(document.body.querySelector('.container'), { childList: true, subtree: true });
        }
        addReviewStats();
        addKnownVocabularyStats();
    }

    function getVerticalDistance(elem1, elem2) {
        const rect1 = elem1.getBoundingClientRect();
        const rect2 = elem2.getBoundingClientRect();

        const distance = rect2.top - rect1.bottom;

        return distance;
    }

    function getVerticalDistanceTopToTop(elem1, elem2) {
        const rect1 = elem1.getBoundingClientRect();
        const rect2 = elem2.getBoundingClientRect();

        const distance = rect2.top - rect1.top;

        return distance;
    }

    function initVerticalSentence() {
        GM_addStyle(STYLES.verticalSentence);

        function adjustHeight() {
            const windowWidth = window.innerWidth;
            const containerWidth = document.querySelector('.container').clientWidth;

            if (windowWidth / containerWidth > 4 / 3) {
                const cardSentence = document.querySelector('.card-sentence');
                const container = document.querySelector('.container');

                if (!cardSentence || !container) {
                    return;
                }

                const rectCardSentence = cardSentence.getBoundingClientRect();
                const rectContainer = container.getBoundingClientRect();
                const distance = rectContainer.bottom - rectCardSentence.top;
                cardSentence.style = '';

                cardSentence.style.height = Math.max(distance, 10) + 'px';
                cardSentence.style.right = 'unset';
                cardSentence.style.left = '100%';
            } else {
                const iconLink = document.querySelector('.sentence .icon-link');
                const showCheckboxExamplesLabel = document.getElementById('show-checkbox-examples-label');

                // let heights = [getComputedStyle(document.querySelector('.card-sentence')).height];
                const heights = [];

                if (iconLink && showCheckboxExamplesLabel) {
                    const verticalDistance = getVerticalDistance(iconLink, showCheckboxExamplesLabel);
                    heights.push(`${Math.round(verticalDistance)}px`);
                }

                const reviewButtonGroup = document.querySelector('.review-button-group');

                if (iconLink && reviewButtonGroup) {
                    const verticalDistance = getVerticalDistance(iconLink, reviewButtonGroup);
                    heights.push(`${Math.round(verticalDistance)}px`);
                }

                const cardSentence = document.querySelector('.card-sentence');

                if (!iconLink) {
                    if (!cardSentence) {
                        return;
                    }

                    if (showCheckboxExamplesLabel) {
                        const verticalDistance = getVerticalDistanceTopToTop(cardSentence, showCheckboxExamplesLabel);
                        heights.push(`${Math.round(verticalDistance)}px`);
                    }

                    if (reviewButtonGroup) {
                        const verticalDistance = getVerticalDistanceTopToTop(cardSentence, reviewButtonGroup);
                        heights.push(`${Math.round(verticalDistance)}px`);
                    }
                }

                if (cardSentence) {
                    cardSentence.style = '';
                    cardSentence.style.height = `calc(max(10px, min(${heights.join(', ')}) * 0.99)`;
                }
            }
        }
        adjustHeight();

        let lastProcessedMutation = null;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation === lastProcessedMutation) {
                    continue;
                }
                lastProcessedMutation = mutation;
                adjustHeight();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', adjustHeight);
    }

    async function initDropdownOnReviewPage() {
        const mutex = {
            locked: false,
            queue: [],
            lock: async function () {
                if (this.locked) {
                    await new Promise((resolve) => this.queue.push(resolve));
                }
                this.locked = true;
            },
            unlock: function () {
                this.locked = false;
                const next = this.queue.shift();
                if (next) next();
            },
        };

        async function addDropdown() {
            if (document.querySelector('.inserted-dropdown')) return;

            await mutex.lock();
            try {
                // Double-check after acquiring the lock
                if (document.querySelector('.inserted-dropdown')) {
                    return;
                }

                const answerBox = document.querySelector('.answer-box');
                if (!answerBox) return;
                const vocabLink = answerBox.querySelector('a[href*="/vocabulary/"]');
                if (!vocabLink) return;

                const url = new URL(vocabLink.href, window.location.origin);

                const response = await httpRequest(url.href, -1);

                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');
                let menu = doc.querySelector('.menu .dropdown');
                if (!menu) return;

                menu = menu.parentElement;

                const plain = answerBox.querySelector('.plain');
                if (!plain) return;

                menu.classList.add('inserted-dropdown');
                menu.style.justifyContent = 'flex-start';
                menu.style.fontSize = '1rem';
                menu.style.fontFamily = getComputedStyle(document.body).fontFamily;

                plain.insertBefore(menu, plain.firstChild);
                const menuWidth = menu.getBoundingClientRect().width;
                menu.style.marginRight = `-${menuWidth}px`;
            } finally {
                mutex.unlock();
            }
        }

        await addDropdown();

        let lastProcessedMutation = null;

        const observer = new MutationObserver(async (mutations) => {
            for (const mutation of mutations) {
                if (mutation === lastProcessedMutation) {
                    continue;
                }
                lastProcessedMutation = mutation;
                await addDropdown();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    async function initReviewProgress() {
        function cardRevealed() {
            return !!document.querySelector('.review-reveal');
        }

        // async function getTimezoneOffset() {
        //     if (GM_getValue('progress_timezoneOffset')) {
        //         return GM_getValue('progress_timezoneOffset');
        //     }

        //     const response = await httpRequest('https://jpdb.io/settings', -1);
        //     const parser = new DOMParser();
        //     const doc = parser.parseFromString(response.responseText, 'text/html');
        //     // find <select> id="timezone-offset" and get selected value
        //     const timezoneOffset = doc.querySelector('#timezone-offset');
        //     const tzo = timezoneOffset.value;
        //     GM_setValue('progress_timezoneOffset', tzo);
        //     return tzo; // offset is in minutes relative to UTC
        // }

        // async function beginReviewSession() {
        //     const lastReviewStarted = GM_getValue('progress_lastReviewStarted', 0);
        //     const timezoneOffset = await getTimezoneOffset();

        //     // Convert timezoneOffset from minutes to milliseconds
        //     const offsetMs = timezoneOffset * 60 * 1000;

        //     // Get the current UTC timestamp
        //     const now = Date.now();

        //     // Calculate the start of the current day in user's timezone
        //     const startOfDay = new Date(now);
        //     startOfDay.setUTCHours(0, 0, 0, 0);
        //     const startOfDayTimestamp = startOfDay.getTime() - offsetMs;

        //     // Check if last review started was before 0:00 in user's timezone
        //     if (lastReviewStarted < startOfDayTimestamp) {
        //         // Reset the reviewsSubmitted count
        //         GM_setValue('progress_reviewsSubmitted', 0);
        //         GM_setValue('progress_lastReviewStarted', now);
        //     }
        // }

        function getOpenReviews() {
            const learnNavItem = document.querySelector('.nav-item[href*="/learn"]');
            const span = learnNavItem.querySelector('span');
            if ((span && getComputedStyle(span).color === 'red') || getComputedStyle(span).color === 'rgb(255, 0, 0)') {
                const openReviews = Number(span.textContent);
                return openReviews;
            }
            return 0;
        }

        async function getNewCardLimit() {
            const response = await httpRequest('https://jpdb.io/settings', 24 * 60 * 60);
            const parser = new DOMParser();
            const doc = parser.parseFromString(response.responseText, 'text/html');
            const newCardLimit = doc.querySelector('#max-new-cards-per-day');
            return Number(newCardLimit.value);
        }

        async function getReviewCountFromStatsPage() {
            let response = null;
            if (cardRevealed()) {
                response = await httpRequest('https://jpdb.io/stats', 9999);
            } else {
                response = await httpRequest('https://jpdb.io/stats', 3);
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(response.responseText, 'text/html');
            const scripts = doc.querySelectorAll('script');

            let script = null;
            scripts.forEach((s) => {
                if (s.textContent.includes('document.getElementById("chart")')) {
                    script = s;
                }
            });

            if (script) {
                const dataRegex = /var\s?data\s?=\s?({\s?.+?\s?});/;
                let data = script.textContent.match(new RegExp(dataRegex))[1];
                // replace unquoted keys with quoted keys
                data = data.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": ');
                data = data.replace(/,(\s*[}\]])/g, '$1');
                const dataObj = JSON.parse(data);
                // filter where "label" has "old" and "failed" in it (case insensitive)
                const oldCardsFailed = dataObj['datasets'].find((dataset) => dataset['label'].toLowerCase().includes('old') && dataset['label'].toLowerCase().includes('failed'));
                const oldCardsPassed = dataObj['datasets'].find((dataset) => dataset['label'].toLowerCase().includes('old') && dataset['label'].toLowerCase().includes('passed'));
                const newCards = dataObj['datasets'].find((dataset) => dataset['label'].toLowerCase().includes('new'));

                const oldCardsCount =
                    oldCardsFailed['data'][oldCardsFailed['data'].length - 1] + oldCardsPassed['data'][oldCardsPassed['data'].length - 1];
                const newCardsCount = newCards['data'][newCards['data'].length - 1];

                return {
                    oldCardsCount,
                    newCardsCount,
                };
            }
            return {
                oldCardsCount: 0,
                newCardsCount: 0,
            };
        }

        async function displayProgress() {
            // insert {reviewsSubmitted}/{reviewsSubmitted+openReviews} to top left
            let openReviews = getOpenReviews();
            // const reviewsSubmitted = GM_getValue('progress_reviewsSubmitted', 0);
            const { oldCardsCount, newCardsCount } = await getReviewCountFromStatsPage();
            const reviewsSubmitted = oldCardsCount + newCardsCount;
            if (newCardsCount > 0) {
                const newCardLimit = await getNewCardLimit();
                openReviews += newCardLimit - newCardsCount;
            }
            const progress = document.createElement('div');
            progress.classList.add('review-progress');
            progress.style.position = 'fixed';
            progress.style.top = '0';
            progress.style.left = '0';
            progress.style.zIndex = '1000';
            progress.style.padding = '0.5rem';
            progress.style.background = 'rgba(0, 0, 0, 0.5)';
            progress.style.color = 'white';
            progress.style.fontFamily = 'monospace';
            progress.style.fontSize = '1rem';
            progress.style.fontWeight = 'bold';
            progress.textContent = `${reviewsSubmitted}/${reviewsSubmitted + openReviews}`;
            if (document.querySelector('.review-progress')) {
                // document.querySelector('.review-progress').textContent = `${reviewsSubmitted}/${reviewsSubmitted + openReviews}`;
                return;
            } else {
                document.body.appendChild(progress);
            }
        }

        // async function attachSubmitListeners() {
        //     if (!cardRevealed()) {
        //         return;
        //     }
        //     const submitButtons = document.querySelectorAll('.review-button-group [type="submit"]');

        //     submitButtons.forEach((button) => {
        //         if (!button.dataset.listenerAttached) {
        //             button.addEventListener('click', () => {
        //                 // Increase the GM value when submitted
        //                 let count = GM_getValue('progress_reviewsSubmitted', 0);
        //                 GM_setValue('progress_reviewsSubmitted', count + 1);
        //             });
        //             console.log('attached listener');
        //             button.dataset.listenerAttached = true;
        //         }
        //     });
        // }

        // attachSubmitListeners();
        displayProgress();
        // beginReviewSession();

        let lastProcessedMutation = null;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation === lastProcessedMutation) {
                    continue;
                }
                lastProcessedMutation = mutation;
                // attachSubmitListeners();
                displayProgress();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        injectFont();
        applyStyles();
        if (window.location.href === CONFIG.learnPageUrl) {
            initLearnPage();
            // initInjectStatsIntoLearnPage();
        } else if (window.location.href.startsWith(CONFIG.reviewPageUrlPrefix) && USER_SETTINGS.enableButtonStyling()) {
            initReviewPage();
        }

        if (window.location.href.startsWith(CONFIG.reviewPageUrlPrefix) && USER_SETTINGS.enableVerticalSentence()) {
            initVerticalSentence();
        }

        if (window.location.href.startsWith(CONFIG.reviewPageUrlPrefix)) {
            initDropdownOnReviewPage();
        }

        if (window.location.href.startsWith(CONFIG.reviewPageUrlPrefix) && DEBUG.enableProgress) {
            initReviewProgress();
        }

        if (window.location.href === CONFIG.learnPageUrl || window.location.href == CONFIG.deckListPageUrl) {
            initShiftMoveDecks();
        }

        if (window.location.href === CONFIG.settingsPageUrl) {
            addSettingsSection();
        }

        if (USER_SETTINGS.enableReplaceKanjiStrokeOrder()) {
            initKanjiStrokeOrder();
        }

        if (USER_SETTINGS.translationLanguage() !== 'None') {
            initTranslation();
        }

        initKanjiCopyButton();
        initCtrlEnter();
        initShowSearchBar();

        if (USER_SETTINGS.enableSentenceBlur()) {
            unblurSentenceOnClick();
        }

        if (USER_SETTINGS.enableMonolingualMachineTranslation()) {
            initMonolingualMachineTranslation();
        }

        document.dispatchEvent(new CustomEvent(`${GM_info.script.name}-initialized`));
    }

    try {
        applyStyles();
    } catch (error) {}

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        try {
            init();
        } catch (error) {}
    }
})();
