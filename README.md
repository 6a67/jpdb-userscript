# JPDB Userscript (6a67)
An opinionated userscript that modifies [jpdb.io](https://jpdb.io/) to add features and design changes.


## Installation
0. Currently only supported on Chromium-based browsers.
1. Install a userscript manager like [Violentmonkey](https://violentmonkey.github.io/).
2. Add the userscript to your userscript manager using [this link](https://raw.githubusercontent.com/6a67/jpdb-userscript/main/script.user.js).


## Features (incomplete)

### General Styling
- **Custom Dark Mode**
  - Changes the color scheme of the dark theme.
  - Experimental dark theme generator.
- **Rounded Corners**
  - Applies rounded corners to various elements.
- **Manrope Font**
  - Replaces the default font with Manrope.
- **Homepage Message Hiding**
  - Hides additional messages on the homepage to reduce clutter.
  - This also hides the Patreon message. [Please consider supporting JPDB on Patreon.](https://www.patreon.com/jpdb)
- **Hide Logout Button**
  - Option to hide the logout button in the navigation menu.
- **Custom CSS**
  - Add your own custom CSS styles.

### Review Page
- **Button Styling**
  - Custom styles for review buttons, inspired by Duolingo.
- **Button Effects**
  - Optional button effects (animations) upon clicking to provide more satisfying feedback.
- **Button Sounds**
  - Optional button sounds upon clicking to provide more satisfying feedback.
- **Sentence Translation Blurring**
  - Blurs sentence translations on card backs, allowing users to toggle the blur by clicking on the sentence. Native implementation only reveals the translation but does not blur it again.
- **Vertical Sentences**
  - Option to display sentences vertically on review cards.
- **Dropdown Menu on Review Page**
  - Adds a vocabulary dropdown menu to the reveal page.
- **Auto-expand Navigation Menu**
  - Automatically expands the navigation menu on the review page to easily show the remaining cards.
- **Static Answer Buttons**
  - Option to move answer buttons to the bottom of the page on smaller screens instead of having them float.
- **Transparent Answer Buttons**
  - Option to make the background of the answer buttons transparent on smaller screens to see the definitions more easily.
- **Show Hidden Vocabulary**
  - Option to show hidden vocabulary on card backs when "Enlarge the example sentence" setting is enabled.

### Learn Page
- **Deck List Replacement**
  - Replaces the default deck list with a grid.
- **Shift Move Decks**
  - Allows moving decks by holding the Shift key to the very top or very bottom of the list.

### Kanji
- **Kanji Stroke Order**
  - Replaces default Kanji display with SVG stroke order diagrams from KanjiVG.
  - Option to use a font-based stroke order for potentially better performance.
  - Option to prefer specific KanjiVG variants over default ones.
- **Kanji Grid**
  - Displays a grid on hover (or always on).
- **Kanji Component Copy**
  - Copy button for kanji components and meanings to easily paste them into other applications (e.g., to paste them into your LLM of your choice to help you come up with mnemonics).

### Translation Features
- **Partial Translation**
  - Translates certain UI elements into a selected language (currently only supports Japanese but should in theory be extendable to other languages).
- **Monolingual Machine Translation**
  - Machine translation for monolingual sentences: Shows a placeholder sentence that can be clicked to translate the sentence using JPDB's machine translation.

### Audio Features
- **Yomi Vocab Audio Server**
  - Allows setting custom audio for vocabularies using a custom audio server.

### Settings Page
- **Settings Section**
  - Adds a settings section to the JPDB settings page to configure the userscript.
- **Build Kanji Cache**
  - Provides an option to build a cache of kanji stroke order SVGs. It is highly recommended to build the cache if SVGs from KanjiVG are used.

### Search Bar
- **Search Bar Overlay**
  - Adds a search overlay that can be triggered by pressing `/`.
  - Animated transition for search overlay.
- **Search Hotkey**
  - Press `/` to quickly focus the search bar.
- **Ctrl+Enter Search**
  - Open search in a new tab with Ctrl+Enter.

### Additional Features
- **Custom Comprehension Analyzer**
  - Adds a custom comprehension analyzer for analyzing text or subtitle files which can be found [here](https://jpdb.io/custom-comprehension-analyzer).
- **Custom Audio Quiz**
  - Adds a custom audio quiz for testing your listening skills which can be found [here](https://jpdb.io/custom-audio-quiz).
- **Short Button Vibration**
  - Very weak haptic feedback on positive review buttons on supported devices.
- **Changelog Notifications**
  - Receive notifications when there are new changelog entries on JPDB.


## Configuration
To access the settings page, navigate to the [JPDB settings](https://jpdb.io/settings) and look for the userscript section.


## External Libraries
This script uses the following external libraries:
- [LZString](https://github.com/pieroxy/lz-string): For compressing and decompressing data.
- [Lottie-web](https://github.com/airbnb/lottie-web): For playing animations.


## Contributing
Contributions are welcome! Feel free to submit pull requests or open issues for bug fixes, new features, or improvements.


## Acknowledgements
- [jpdb.io](https://jpdb.io) For providing a great resource for Japanese learners.
- [KanjiVG](https://kanjivg.tagaini.net/) For providing the kanji stroke orders.
- [Kanji Stroke Order Font](https://www.nihilist.org.uk/) For providing the font-based stroke order.
- [Duolingo](https://www.duolingo.com/) For design inspiration.