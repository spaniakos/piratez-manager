# Integration checks

These tests create a disposable copy of the supplied WordPress 7.1.3 source, launch WordPress Playground with PHP 8.3, and operate the real admin interface in headless Chromium. GitHub HTTP responses use local release fixtures; no live releases are created and no production installation is modified.

Install the exact development dependencies in `tests/package.json`, plus a Playwright Chromium runtime. Set:

* `WP_SOURCE`: unpacked, clean WordPress 7.1.3 source.
* `PIRATEZ_THEME_SOURCE`: theme 1.3.0 repository source.
* `PIRATEZ_PREVIOUS_THEME_SOURCE`: optional theme 1.2.0 source to exercise the initial upgrade/handoff.
* `PIRATEZ_ADDONS_SOURCE`: directory containing `piratez-image-optimize` and `piratez-cookie-consent` release source trees (1.1.0).
* `PIRATEZ_CHROMIUM_EXECUTABLE`: optional path to a Chromium binary.

Run `node tests/wordpress.cjs` from the repository root, with the development dependencies on Node's module path. The test uses localhost port 9401. Run against temporary source trees; its endpoint is test-only and is never part of release packages. Fixtures simulate the next patch releases to exercise real package replacement, activation and settings preservation.

The release CI runs syntax and reproducible-package checks. This source-baseline integration suite is run separately because the authoritative user-provided WordPress archive is not a repository asset. Multisite requires a separate staging pass before deployment there.

The suite also verifies the installer-only theme fallback: missing, installed/inactive, active and renamed Manager; separate install/activation; denied file modifications; invalid nonces; rejected tampered packages; and the absence of legacy theme management code. No Manager runtime changes are required for this launcher.

## Product-menu regression

`admin-menu.cjs` runs against the supplied WordPress 7.1.3 baseline with the PirateZ theme, Editorial (catalogue enabled), Image Optimize and Cookie Consent. Set `WP_SOURCE`, `PIRATEZ_THEME_SOURCE`, `PIRATEZ_EDITORIAL_SOURCE`, `PIRATEZ_IMAGE_SOURCE`, `PIRATEZ_COOKIE_SOURCE` and `PIRATEZ_CHROMIUM_EXECUTABLE`, then run it with the existing Playground/Playwright dependencies resolvable through `NODE_PATH`.

It checks that Modules stays first with a product CPT, navigation does not open Products instead, both legacy Appearance URLs redirect while Manager is active, and deactivation restores the theme launcher without removing independent addon menus.
