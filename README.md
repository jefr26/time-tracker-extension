# Time Tracker Extension

A 100% local and private time tracking browser extension for tasks and projects.

## Features

- **Project Management**: Organize your tasks by projects.
- **Active Timer**: Track time in real-time with a live timer.
- **Manual Entry**: Add time records manually if you forgot to start the timer.
- **Weekly Summary**: View your total time spent per task and project during the current week.
- **Navigation**: Review records from previous weeks.
- **Privacy Focused**: All data is stored locally in your browser's storage (`chrome.storage.local`). No data is sent to external servers.
- **Full View**: Option to open the tracker in a full browser tab for a better overview.

## Installation

Since this is a developer version, you can install it as an unpacked extension:

1. Download or clone this repository.
2. Open Chrome (or any Chromium-based browser) and go to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right corner).
4. Click on **Load unpacked**.
5. Select the folder containing the project files.

## How to use

1. Click on the extension icon in your browser toolbar.
2. **Start Tracking**:
   - Select or create a project.
   - Enter the task name.
   - Press the Play (▶) button or hit Enter.
3. **Stop Tracking**:
   - Press the Stop (■) button.
4. **Manual Entry**:
   - Enter the task and project.
   - Input the duration in the manual time field (Format: `H:MM` or just `MM` for minutes).
   - Click **+ Manual Entry**.
5. **Managing Projects**:
   - Click the grid icon (⊞) in the header to open the project panel.
   - Add new projects or remove existing ones.

## Technologies

- HTML5 / CSS3 (using DM Mono and Fraunces fonts)
- Vanilla JavaScript
- Chrome Extension API (Manifest V3)
- Local Storage API

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
