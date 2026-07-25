# YT-zen

Clean, lightweight, and customizable client-side interface for YouTube.

## Overview

YT-zen is a browser extension that improves your YouTube viewing experience by removing clutter, preventing data tracking, and providing advanced player and interface customizability. It runs entirely locally on your machine with no external network requests or remote dependencies.

## Key Features

* **Ad and Tracking Prevention**: Block advertisements, promotional scripts, and user tracking requests before they can load, without interrupting video playback.
* **Video Segment Skipping**: Automatically skips sponsored segments, intro music, non-essential reminders, and end screens using timing data, or skips them manually with a hotkey.
* **Layout Cleanup (Remove Shorts)**: Cleans up the YouTube interface by hiding Shorts videos from the home feed, sub lists, and sidebars, and redirects Shorts video links directly to the standard video player.
* **Automatic Video Resume**: Remembers your exact watch position for recently played videos and offers a button to continue playback from where you left off.
* **Compact Mode Layout**: Shrinks empty whitespace, margins, paddings, and list heights across YouTube so that more videos and comments fit on your screen.
* **Custom Appearance Themes**: Choose from light and dark color schemes, adjust layout accent highlights, or apply glass-style window designs.
* **Performance Control**: Prevents browser tab lag and memory growth during long browsing sessions by automatically cleaning up background timers and page observers.

## Installation

1. Install a userscript manager such as Tampermonkey or Violentmonkey in your browser.
2. Click the [Userscript Installation Link](https://github.com/mheci/YT-zen/releases/latest/download/yt-zen.user.js).
3. Confirm the installation, then open YouTube in a new tab.

## Keyboard Shortcuts

| Keybind | Action Description |
|---|---|
| **Alt+Y** | Open or close the settings dashboard panel |
| **?** (Shift+/) | Open or close the keyboard shortcut cheat sheet |
| **Ctrl+Shift+K** | Open the quick command palette search bar |
| **KeyK** / **Space** | Play or pause video playback |
| **KeyM** | Mute or unmute audio |
| **Comma (,)** / **Period (.)** | Decrease or increase video playback speed |
| **Digit0** | Reset playback speed to normal 1x |
| **ArrowLeft** / **ArrowRight** | Seek backward 5 seconds / forward 5 seconds |
| **KeyJ** / **KeyL** | Seek backward 10 seconds / forward 10 seconds |
| **Shift+W** | Force-mark the current video as fully watched |

## Interface Customization

The Compact Mode setting can be enabled directly on the layout tab of the settings panel (`Alt+Y`). This option dynamically reduces the top navigation bar height, sidebar Guide margins, Home feed grid gutters, Watch page actions spacing, and Comment vertical paddings, allowing more content to remain visible without reducing readable text sizes.

## License

This is free and unencumbered software released into the public domain under the Unlicense license.
