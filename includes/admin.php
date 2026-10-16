<?php
/** Capability-checked catalogue and explicit native WordPress operations. */
if (!defined('ABSPATH')) { exit; }

add_action('admin_menu', 'piratez_manager_menu');
add_action('network_admin_menu', 'piratez_manager_menu');
function piratez_manager_menu() {
    if (is_multisite() && !is_network_admin()) { return; }
    add_menu_page('PirateZ Manager', 'PirateZ', piratez_manager_capability(), 'piratez-manager', 'piratez_manager_page', 'dashicons-admin-plugins');
}

// Compatibility with theme 1.2.0, which predates the handoff flag. Keep its
// independent theme updater but retire its duplicate management screen/actions.
add_action('admin_menu', function () { remove_submenu_page('themes.php', 'piratez-components'); }, 100);
add_action('after_setup_theme', function () {
    remove_action('admin_post_piratez_component', 'piratez_component_action');
    if (!function_exists('piratez_component_updaters')) { return; }
    foreach (piratez_component_updaters() as $client) {
        if ($client->config['type'] !== 'plugin') { continue; }
        remove_filter('update_plugins_github.com', array($client, 'update'), 10);
        remove_filter('upgrader_pre_download', array($client, 'download'), 10);
        remove_filter('upgrader_source_selection', array($client, 'source'), 20);
        remove_action('upgrader_process_complete', array($client, 'clear'), 10);
        remove_filter('plugins_api', array($client, 'info'), 20);
    }
}, 100);
add_action('admin_init', function () {
    if (($GLOBALS['pagenow'] ?? '') === 'themes.php' && ($_GET['page'] ?? '') === 'piratez-components' && current_user_can(piratez_manager_capability())) {
        wp_safe_redirect(piratez_manager_url()); exit;
    }
});

function piratez_manager_component_form($id, $operation, $label) {
    echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" style="display:inline-block;margin:0 8px 8px 0">';
    echo '<input type="hidden" name="action" value="piratez_manager_component"><input type="hidden" name="component" value="' . esc_attr($id) . '"><input type="hidden" name="operation" value="' . esc_attr($operation) . '">';
    wp_nonce_field('piratez_manager_component_' . $id . '_' . $operation);
    submit_button($label, 'secondary', 'submit', false);
    echo '</form>';
}

function piratez_manager_page() {
    if (!current_user_can(piratez_manager_capability())) { return; }
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
    $plugins = get_plugins();
    echo '<div class="wrap"><h1>PirateZ Manager</h1><p>Updates come from the official PirateZ GitHub releases. Install modules individually, then activate them when ready.</p>';
    $notice = get_transient('piratez_manager_component_notice_' . get_current_user_id());
    if ($notice) { delete_transient('piratez_manager_component_notice_' . get_current_user_id()); echo '<div class="notice notice-' . ($notice['ok'] ? 'success' : 'error') . '"><p>' . esc_html($notice['message']) . '</p></div>'; }
    foreach (piratez_manager_clients() as $id => $client) {
        $item = $client->config;
        $installed = $item['installed'];
        $version = $installed ? ($item['type'] === 'theme' ? wp_get_theme($item['key'])->get('Version') : $plugins[$item['key']]['Version']) : '';
        $release = $client->release();
        echo '<div class="card"><h2>' . esc_html($item['name']) . '</h2><p>Installed: ' . esc_html($version ?: 'Not installed') . '</p>';
        if (is_wp_error($release)) { echo '<p>' . esc_html($release->get_error_message()) . '</p>'; }
        else {
            echo '<p>Latest release: <a href="' . esc_url($release['url']) . '" target="_blank" rel="noopener noreferrer">' . esc_html($release['version']) . '</a></p>';
            if (!$client->compatible($release)) { echo '<p>Requires WordPress ' . esc_html($release['requires']) . ' and PHP ' . esc_html($release['requires_php']) . '.</p>'; }
            elseif (!$installed && !$item['collision'] && $item['type'] === 'plugin' && current_user_can('install_plugins') && wp_is_file_mod_allowed('piratez_manager')) { piratez_manager_component_form($id, 'install', 'Install module'); }
            elseif ($installed && version_compare($release['version'], $version, '>') && current_user_can('update_' . ($item['type'] === 'theme' ? 'themes' : 'plugins')) && wp_is_file_mod_allowed('piratez_manager')) { piratez_manager_component_form($id, 'update', 'Update now'); }
            elseif ($installed && !version_compare($release['version'], $version, '>')) { echo '<p>Up to date.</p>'; }
        }
        if ($item['collision']) { echo '<p>A different component occupies the expected folder. Resolve the conflict before installing.</p>'; }
        if ($installed && $item['type'] === 'plugin' && !is_plugin_active($item['key']) && current_user_can('activate_plugins')) { piratez_manager_component_form($id, 'activate', 'Activate module'); }
        elseif ($installed && $item['type'] === 'plugin' && is_plugin_active($item['key'])) { echo '<p>Module active.</p>'; }
        if (current_user_can(piratez_manager_capability())) { piratez_manager_component_form($id, 'check', 'Check for updates'); }
        echo '</div>';
    }
    echo '<p>Manager is optional. Each installed component checks for its own updates, including when Manager is inactive.</p><p>Automatic updates can be enabled in the standard WordPress Themes and Plugins screens. GitHub access does not require an API key for these public repositories.</p></div>';
}

function piratez_manager_component_result($ok, $message) {
    set_transient('piratez_manager_component_notice_' . get_current_user_id(), array('ok' => $ok, 'message' => $message), MINUTE_IN_SECONDS);
    wp_safe_redirect(piratez_manager_url()); exit;
}

function piratez_manager_component_action() {
    if (!current_user_can(piratez_manager_capability())) { wp_die('Permission denied.', '', array('response' => 403)); }
    if (!isset($_POST['component'], $_POST['operation']) || !is_string($_POST['component']) || !is_string($_POST['operation'])) { wp_die('Invalid request.', '', array('response' => 400)); }
    $id = sanitize_key(wp_unslash($_POST['component'] ?? ''));
    $operation = sanitize_key(wp_unslash($_POST['operation'] ?? ''));
    $clients = piratez_manager_clients();
    if (!isset($clients[$id]) || !in_array($operation, array('check', 'install', 'update', 'activate'), true)) { wp_die('Unknown component or operation.', '', array('response' => 400)); }
    check_admin_referer('piratez_manager_component_' . $id . '_' . $operation);
    $client = $clients[$id]; $item = $client->config;
    if (($operation === 'install' && ($item['installed'] || $item['collision'])) || (in_array($operation, array('update', 'activate'), true) && !$item['installed'])) { wp_die('Component installation state has changed. Refresh the catalogue.', '', array('response' => 409)); }
    $cap = $operation === 'check' ? piratez_manager_capability() : ($operation === 'activate' ? 'activate_plugins' : ($operation === 'install' ? 'install_plugins' : 'update_' . ($item['type'] === 'theme' ? 'themes' : 'plugins')));
    if (!current_user_can($cap) || (in_array($operation, array('install', 'update'), true) && !wp_is_file_mod_allowed('piratez_manager'))) { wp_die('This operation is not permitted on this installation.', '', array('response' => 403)); }
    if ($item['type'] === 'theme' && in_array($operation, array('install', 'activate'), true)) { wp_die('Unsupported theme operation.', '', array('response' => 400)); }
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
    if ($operation === 'activate') {
        $result = activate_plugin($item['key'], '', is_multisite());
        piratez_manager_component_result(!is_wp_error($result), is_wp_error($result) ? $result->get_error_message() : 'Module activated.');
    }
    $release = $client->release(true);
    if (is_wp_error($release)) { piratez_manager_component_result(false, $release->get_error_message()); }
    if ($operation === 'check') {
        if ($item['type'] === 'theme') { delete_site_transient('update_themes'); wp_update_themes(); }
        else { delete_site_transient('update_plugins'); wp_update_plugins(); }
        piratez_manager_component_result(true, 'Update information refreshed. Latest release: ' . $release['version']);
    }
    if (!$client->compatible($release)) { piratez_manager_component_result(false, 'This release requires a newer WordPress or PHP version.'); }
    require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
    $skin = new WP_Ajax_Upgrader_Skin();
    // Register verification only for this explicit install/update operation.
    $client = new \PirateZManager\GitHubUpdater($item);
    if ($operation === 'install') {
        if (isset(get_plugins()[$item['key']])) { piratez_manager_component_result(false, 'The module is already installed.'); }
        $upgrader = new Plugin_Upgrader($skin); $result = $upgrader->install($release['package']);
    } else {
        $version = $item['type'] === 'theme' ? wp_get_theme($item['key'])->get('Version') : (get_plugins()[$item['key']]['Version'] ?? '');
        if (!$version || !version_compare($release['version'], $version, '>')) { piratez_manager_component_result(false, 'No newer release is available.'); }
        $transient = get_site_transient('update_' . ($item['type'] === 'theme' ? 'themes' : 'plugins'));
        if (!is_object($transient)) { $transient = new stdClass(); }
        if (!isset($transient->response) || !is_array($transient->response)) { $transient->response = array(); }
        $update = $client->update(false, array('UpdateURI' => $client->uri()), $item['key'], array());
        $transient->response[$item['key']] = $item['type'] === 'theme' ? $update : (object) array_merge($update, array('new_version' => $release['version'], 'plugin' => $item['key']));
        set_site_transient('update_' . ($item['type'] === 'theme' ? 'themes' : 'plugins'), $transient);
        $upgrader = $item['type'] === 'theme' ? new Theme_Upgrader($skin) : new Plugin_Upgrader($skin);
        if ($item['type'] === 'theme') { $result = $upgrader->upgrade($item['key']); }
        else {
            // Match WordPress' AJAX updater: keep active modules active during replacement.
            $results = $upgrader->bulk_upgrade(array($item['key']));
            $result = is_array($results) && isset($results[$item['key']]) ? $results[$item['key']] : $results;
            if (is_array($result)) { $result = true; }
        }
    }
    $errors = $skin->get_errors();
    $ok = $result === true && !$errors->has_errors();
    piratez_manager_component_result($ok, $ok ? ($operation === 'install' ? 'Module installed. Activate it when ready.' : 'Update completed.') : (is_wp_error($result) ? $result->get_error_message() : ($errors->has_errors() ? $errors->get_error_message() : 'Installation could not complete. Use the standard WordPress installer if filesystem credentials are required.')));
}
add_action('admin_post_piratez_manager_component', 'piratez_manager_component_action');
