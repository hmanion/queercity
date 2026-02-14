<?php

if (!function_exists('qc_render_footer')) {
    function qc_render_footer(string $basePath = ''): void
    {
        $archiveHref = htmlspecialchars($basePath . 'archive/', ENT_QUOTES, 'UTF-8');
        ?>
        <footer class="qc-footer">
          <a class="qc-footer-archive" href="<?= $archiveHref ?>">PAST EVENTS</a>
          <a class="qc-footer-source" href="https://github.com/hmanion/queercity" target="_blank" rel="noopener noreferrer">SOURCE / LICENSE</a>
        </footer>
        <?php
    }
}
