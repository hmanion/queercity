<?php

if (!function_exists('qc_admin_required_token')) {
    function qc_admin_required_token(): string
    {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }

        $configPath = __DIR__ . '/../../config/db.php';
        if (!file_exists($configPath)) {
            $cached = '';
            return $cached;
        }

        $config = require $configPath;
        $cached = (string)($config['import_token'] ?? '');
        return $cached;
    }
}

if (!function_exists('qc_admin_extract_token')) {
    function qc_admin_extract_token(array $candidates = []): string
    {
        foreach ($candidates as $candidate) {
            $text = trim((string)($candidate ?? ''));
            if ($text !== '') {
                return $text;
            }
        }

        $query = trim((string)($_GET['token'] ?? ''));
        if ($query !== '') {
            return $query;
        }
        $post = trim((string)($_POST['token'] ?? ''));
        if ($post !== '') {
            return $post;
        }
        $cookie = trim((string)($_COOKIE['qc_admin_token'] ?? ''));
        if ($cookie !== '') {
            return $cookie;
        }
        return '';
    }
}

if (!function_exists('qc_admin_token_is_valid')) {
    function qc_admin_token_is_valid(string $token): bool
    {
        $required = qc_admin_required_token();
        return $required !== '' && hash_equals($required, $token);
    }
}

if (!function_exists('qc_admin_set_token_cookie')) {
    function qc_admin_set_token_cookie(string $token): void
    {
        setcookie('qc_admin_token', $token, [
            'expires' => time() + (12 * 60 * 60),
            'path' => '/',
            'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }
}

if (!function_exists('qc_admin_clear_token_cookie')) {
    function qc_admin_clear_token_cookie(): void
    {
        setcookie('qc_admin_token', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }
}

if (!function_exists('qc_admin_require_page_token')) {
    function qc_admin_require_page_token(string $title = 'Admin Access'): string
    {
        if (isset($_GET['logout']) && $_GET['logout'] === '1') {
            qc_admin_clear_token_cookie();
        }

        $provided = qc_admin_extract_token([$_POST['token'] ?? null]);
        if (qc_admin_token_is_valid($provided)) {
            qc_admin_set_token_cookie($provided);
            return $provided;
        }

        http_response_code(403);
        header('Content-Type: text/html; charset=utf-8');
        $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">';
        echo '<title>' . $safeTitle . '</title>';
        echo '<link rel="stylesheet" href="../style.css"><link rel="stylesheet" href="./admin.css"></head><body>';
        echo '<main class="admin-wrap"><section class="panel"><h1>' . $safeTitle . '</h1>';
        echo '<p class="admin-intro">Enter the admin token to continue.</p>';
        echo '<form method="post" class="admin-form"><label>Admin token<input name="token" type="password" required></label>';
        echo '<button type="submit">Access admin</button></form></section></main></body></html>';
        exit;
    }
}
