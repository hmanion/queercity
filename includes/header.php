<?php

if (!function_exists('qc_render_header')) {
    function qc_render_header(string $basePath = '', string $active = ''): void
    {
        $links = [
            ['id' => 'events', 'href' => $basePath . './', 'label' => 'EVENTS'],
            ['id' => 'weekdays', 'href' => $basePath . 'weekdays/', 'label' => 'WEEKDAYS'],
            ['id' => 'activities', 'href' => $basePath . 'activities/', 'label' => 'ACTIVITIES'],
            ['id' => 'arts', 'href' => $basePath . 'arts/', 'label' => 'ARTS'],
            ['id' => 'clubs', 'href' => $basePath . 'clubs/', 'label' => 'CLUBS'],
            ['id' => 'celebration', 'href' => $basePath . 'celebration/', 'label' => 'CELEBRATION'],
            ['id' => 'life', 'href' => $basePath . 'life/', 'label' => 'LIFE'],
            ['id' => 'sexy', 'href' => $basePath . 'sexy/', 'label' => 'SEXY'],
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
