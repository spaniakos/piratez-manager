# PirateZ Manager

Optional management plugin for first-party PirateZ WordPress components. Requires the supplied WordPress 7.1.3 baseline and PHP 7.4 or newer.

## Install and use

With PirateZ Cyberpunk 1.3.0, use **Appearance → PirateZ Manager** to install the verified release, then activate it. With another theme, download `piratez-manager.zip` from GitHub Releases and use **Plugins → Add New → Upload Plugin**. Open **PirateZ** in the admin menu.

The catalogue currently includes PirateZ Cyberpunk, Image Optimize, Cookie Consent and Manager itself. It offers stable-release checks, plugin installation, separate activation and component updates through native WordPress APIs. Theme installation and switching remain in Appearance; Manager never switches the active theme. Future modules are added when their repositories are provided and their releases are ready.

Each component keeps its own updater. Manager is not a shared runtime dependency. Plugins continue checking for updates with another theme active and Manager deactivated, provided those plugins themselves remain active. WordPress's standard update screens and automatic-update choices remain available.

## Theme handoff and rollback

* Theme **1.3.0** always registers its independent updater. Its **Appearance → PirateZ Manager** screen only installs, activates or opens Manager. The theme contains no backup catalogue or module-management implementation.
* Theme **1.2.0** is also supported during rollout: Manager hides the old menu, redirects its bookmarks and disables the old management actions and duplicate plugin updater hooks. Its theme updater remains active.
* Activate Manager before or after installing theme 1.3.0. Deactivating Manager removes its management interface; the theme offers its activation button again. Deleting Manager restores the install button. Existing theme/plugin operation and independent updaters continue. No migration flags are saved.
* Switching to a standard theme leaves Manager available. It discovers installed PirateZ components by their Update URI, including renamed installation folders.

No content, shortcode, Customizer or addon settings are moved or deleted. Manager has no persistent configuration to export; it reads existing installed-component state. It changes installation/update state only on explicit administrator actions. Deleting Manager leaves all other components and settings intact.

## Security and failure behavior

The catalogue is a fixed allowlist of public PirateZ GitHub repositories. There is no arbitrary repository/URL input. Operations require administrator capabilities, per-component/per-operation nonces, native installation permissions and WordPress filesystem policies. Install and update require file modifications to be allowed; checking releases and activating installed plugins do not write packages.

Only stable semantic-version releases with matching package identity, SHA-256, WordPress and PHP requirements are accepted. Wrong origins, tampered ZIPs, mismatching entry headers and occupied installation folders are rejected. Release failures are shown without changing installed components. Checks are cached for six hours (errors for fifteen minutes); **Check for updates** refreshes them. No GitHub token is required. Sites requiring FTP credentials can use WordPress's standard installer.

On multisite, network-activate Manager and use **Network Admin → PirateZ**; module activation from that screen is network-wide. Site administrators do not receive installation controls. Multisite rollout still requires a staging verification on your actual network configuration.

## Releases and local checks

Run `python3 tools/build_release.py` for the runtime-only ZIP, `release.json` and `SHA256SUMS`. The package has a fixed top-level folder and normalized file permissions. Runtime packages exclude tests, tools, development files and repository metadata.

Merge a new version into `main` to publish its immutable GitHub release. Bump the plugin header, `PIRATEZ_MANAGER_VERSION`, readme stable tag and changelog together. Existing releases/tags are never overwritten. The theme installer can install the first Manager release, or use a manual plugin upload with another theme. Subsequent updates use WordPress.

Run `python3 tests/package.py` and PHP syntax checks before merging. `tests/wordpress.cjs` exercises disposable WordPress installations with local release fixtures; see [tests/README.md](tests/README.md). Production credentials are never required.

## Editorial catalogue addition (1.1.0)

Adds PirateZ Editorial as an independent first-party component. Its release manifest supplies WordPress/PHP requirements. Catalogue visibility can precede publication: no-release status is handled safely. Editorial must be published before the paired theme 1.4.0 handoff. Manager remains optional and its self-updater is unchanged.

## Admin navigation

With Manager active, **PirateZ → Modules** is the first submenu and opens the catalogue. Addon pages and product catalogues remain alongside it. The theme’s Appearance → PirateZ Manager launcher is hidden while Manager is active; old launcher bookmarks redirect to Modules. Deactivating Manager lets the theme’s install/activate launcher return and leaves addon menus/updaters independent.
