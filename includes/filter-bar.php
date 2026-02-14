<?php

if (!function_exists('qc_render_filter_bar')) {
    function qc_render_filter_bar(bool $showGenrePills, bool $showRecurringToggle = true): void
    {
        $genres = $showGenrePills ? '1' : '0';
        $recurring = $showRecurringToggle ? '1' : '0';
        ?>
        <section
          id="category-filter-bar"
          class="category-filter-bar"
          data-show-genres="<?= htmlspecialchars($genres, ENT_QUOTES, 'UTF-8') ?>"
          data-show-recurring="<?= htmlspecialchars($recurring, ENT_QUOTES, 'UTF-8') ?>"
        ></section>
        <?php
    }
}
