<?php

if (!function_exists('qc_render_header')) {
    function qc_render_header(string $basePath = '', string $active = ''): void
    {
        $links = [
            ['id' => 'events', 'href' => $basePath . './', 'label' => 'EVENTS'],
            ['id' => 'weekdays', 'href' => $basePath . 'weekdays/', 'label' => 'WEEKDAYS'],
            ['id' => 'prides', 'href' => $basePath . 'prides/', 'label' => 'PRIDES'],
        ];
        ?>
        <div class="header">
          <nav>
            <?php foreach ($links as $index => $link): ?>
              <?php if ($index > 0): ?> | <?php endif; ?>
              <?php
              $isActive = ($active !== '' && $active === $link['id']);
              $href = htmlspecialchars($link['href'], ENT_QUOTES, 'UTF-8');
              $label = htmlspecialchars($link['label'], ENT_QUOTES, 'UTF-8');
              ?>
              <a href="<?= $href ?>"<?= $isActive ? ' aria-current="page"' : '' ?>><?= $label ?></a>
            <?php endforeach; ?>
          </nav>
          <div class="title">QUEER CITY</div>
          <span class="circle"></span>
          <div class="subtitle">BIGGER THAN A VILLAGE</div>
        </div>
        <?php
    }
}
