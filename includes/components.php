<?php
/** Fixed first-party catalogue. Components retain independent update clients. */
if (!defined('ABSPATH')) { exit; }

function piratez_manager_catalogue() {
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
    $items = array(
        'theme' => array('name' => 'PirateZ Cyberpunk', 'type' => 'theme', 'slug' => 'piratez-cyberpunk', 'repo' => 'spaniakos/Piratez.gr-Theme', 'key' => 'piratez-cyberpunk', 'entry' => 'style.css'),
        'piratez-manager' => array('name' => 'PirateZ Manager', 'type' => 'plugin', 'slug' => 'piratez-manager', 'repo' => 'spaniakos/piratez-manager', 'key' => plugin_basename(PIRATEZ_MANAGER_FILE), 'entry' => 'piratez-manager.php'),
        'piratez-image-optimize' => array('name' => 'PirateZ Image Optimize', 'type' => 'plugin', 'slug' => 'piratez-image-optimize', 'repo' => 'spaniakos/piratez-image-optimize', 'key' => 'piratez-image-optimize/piratez-image-optimize.php', 'entry' => 'piratez-image-optimize.php'),
        'piratez-editorial' => array('name' => 'PirateZ Editorial', 'type' => 'plugin', 'slug' => 'piratez-editorial', 'repo' => 'spaniakos/piratez-editorial', 'key' => 'piratez-editorial/piratez-editorial.php', 'entry' => 'piratez-editorial.php'),
        'piratez-cookie-consent' => array('name' => 'PirateZ Cookie Consent', 'type' => 'plugin', 'slug' => 'piratez-cookie-consent', 'repo' => 'spaniakos/piratez-cookie-consent', 'key' => 'piratez-cookie-consent/piratez-cookie-consent.php', 'entry' => 'piratez-cookie-consent.php'),
    );
    $plugins = get_plugins();
    $themes = wp_get_themes();
    foreach ($items as &$item) {
        $candidates = $item['type'] === 'theme' ? $themes : $plugins;
        // Resolve by repository identity, including renamed directories. Prefer
        // the active PirateZ parent theme when multiple copies are installed.
        if ($item['type'] === 'theme' && isset($themes[get_template()])) {
            $candidates = array(get_template() => $themes[get_template()]) + $candidates;
        }
        $item['installed'] = false;
        $item['collision'] = isset($candidates[$item['key']]) || ($item['type'] === 'plugin' && is_dir(WP_PLUGIN_DIR . '/' . $item['slug']));
        foreach ($candidates as $key => $headers) {
            $uri = $item['type'] === 'theme' ? $headers->get('UpdateURI') : ($headers['UpdateURI'] ?? '');
            if (rtrim($uri, '/') !== 'https://github.com/' . $item['repo']) { continue; }
            $item['key'] = $key;
            $item['installed'] = true;
            $item['collision'] = false;
            break;
        }
    }
    unset($item);
    return $items;
}

function piratez_manager_clients() {
    $clients = array();
    // Passive clients for display; do not duplicate active components' hooks.
    foreach (piratez_manager_catalogue() as $id => $item) {
        $clients[$id] = new \PirateZManager\GitHubUpdater($item, false);
    }
    return $clients;
}

function piratez_manager_url() {
    return (is_multisite() ? network_admin_url('admin.php') : admin_url('admin.php')) . '?page=piratez-manager';
}

function piratez_manager_capability() {
    return is_multisite() ? 'manage_network_plugins' : 'manage_options';
}
