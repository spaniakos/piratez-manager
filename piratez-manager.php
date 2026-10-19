<?php
/**
 * Plugin Name: PirateZ Manager
 * Plugin URI: https://github.com/spaniakos/piratez-manager
 * Description: Optional catalogue, installation and update controls for independent PirateZ themes and plugins.
 * Version: 1.1.1
 * Requires at least: 7.1.3
 * Requires PHP: 7.4
 * Update URI: https://github.com/spaniakos/piratez-manager
 * Author: Spaniakos
 * License: GPLv3 or later
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: piratez-manager
 */
if (!defined('ABSPATH')) { exit; }

define('PIRATEZ_MANAGER_VERSION', '1.1.1');
define('PIRATEZ_MANAGER_FILE', __FILE__);
require_once __DIR__ . '/includes/github-updater.php';
require_once __DIR__ . '/includes/components.php';

// The plugin checks for its own updates with any theme, without the catalogue UI.
new \PirateZManager\GitHubUpdater(array('name' => 'PirateZ Manager', 'type' => 'plugin', 'slug' => 'piratez-manager', 'repo' => 'spaniakos/piratez-manager', 'key' => plugin_basename(__FILE__), 'entry' => 'piratez-manager.php'));
require_once __DIR__ . '/includes/admin.php';
