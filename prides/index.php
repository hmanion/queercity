<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Explore Pride events across Manchester and Greater Manchester, with details, dates and linked events.">
  <title>Queer City - Prides</title>
  <link rel="icon" type="image/png" href="/favicon/favicon-96x96.png" sizes="96x96" />
  <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
  <link rel="shortcut icon" href="/favicon/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
  <meta name="apple-mobile-web-app-title" content="QUEER CITY" />
  <link rel="manifest" href="/favicon/site.webmanifest" />
  <link rel="stylesheet" href="../style.css">
  <link rel="preconnect" href="../api/prides.php">
  <link rel="modulepreload" href="../js/fetch-json.module.js" />
  <script type="module" src="../js/prides-page.module.js"></script>
</head>

<body>
  <?php require __DIR__ . '/../includes/header.php'; qc_render_header('../', 'prides'); ?>

  <main id="main-content">
    <section class="prides-map-section" aria-labelledby="prides-map-title">
      <h2 id="prides-map-title">Greater Manchester Pride Map</h2>
      <div class="prides-map-layout">
        <div class="prides-map-wrap">
          <div id="prides-map-tooltip" class="prides-map-tooltip" role="status" aria-live="polite"></div>
          <div id="prides-map" class="prides-map" aria-describedby="prides-map-help"></div>
          <p id="prides-map-help" class="sr-only">Use Tab then Enter or Space to select a borough and view Pride details.</p>
        </div>
        <aside id="prides-borough-panel" class="prides-borough-panel" aria-hidden="true">
          <button id="prides-borough-close" type="button" class="prides-borough-close" aria-label="Close borough details">Close</button>
          <div id="prides-borough-content"></div>
        </aside>
      </div>
      <div id="prides-map-live" class="sr-only" aria-live="polite"></div>
    </section>

    <div id="prides-panel-backdrop" class="prides-panel-backdrop" hidden></div>
    <section id="prides-summary" class="prides-summary"></section>
    <section id="prides-filter-bar" class="prides-filter-bar"></section>
    <section id="prides-list" class="prides-list"></section>
  </main>

  <?php require __DIR__ . '/../includes/footer.php'; qc_render_footer('../'); ?>
</body>

</html>
