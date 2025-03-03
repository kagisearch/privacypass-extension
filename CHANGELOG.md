
# Change Log

## [1.0.4] - 2025-02-17

### Added

- Dev feature: added support for staging environment.

### Changed

### Fixed

- After version update, extension toolbar icon was inconsistent (reset to gray even if enabled)
- Showing correct error message when hitting error 429 during token generation.
- When searching from Firefox search bar, fixed diacritics getting garbled.

## [1.0.3] - 2025-02-14

### Added

- Button in settings dialog to discard the currently loaded token from all endpoints. This enables one to recover from a double-spend situation where the system fails to automatically recover.

### Changed

### Fixed

## [1.0.2] - 2025-02-12

### Added

- Extension icon now reflects whether Privacy Pass is in use or not.

### Changed

- Extension icon.

### Fixed

## [1.0.1] - 2025-02-11

### Added

- Support for text translation on Kagi Translate.

### Changed

- Made error messages more helpful.
- Removed redundant periodic token generation.
- Added more information in the "out of tokens" page.
- Added "/" and "/html" as endpoints that can see the "out of tokens" page.
- Simplified the extension's UI.

### Fixed

- Stopped the extension from getting enabled whenever no tokens were available and token generation failed due to account not being authorized.

## [1.0.0.7] - 2025-02-05

### Added

-   Extension-side Support for Quick Answer and Summarize Document.

### Changed

### Fixed

## [1.0.0.6] - 2025-02-04

### Added

### Changed
- Clearer error message when failing to obtain a session cookie.

### Fixed

## [1.0.0.5] - 2025-02-04

### Added

- First public release.

### Changed

### Fixed
