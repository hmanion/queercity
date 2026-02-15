<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Find upcoming LGBTQ+ sexy events in Manchester and Greater Manchester, including kinky nightlife and adult-only events.">
  <title>Queer City - Sexy</title>
  <link rel="icon" type="image/png" href="/favicon/favicon-96x96.png" sizes="96x96" />
  <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
  <link rel="shortcut icon" href="/favicon/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
  <meta name="apple-mobile-web-app-title" content="QUEER CITY" />
  <link rel="manifest" href="/favicon/site.webmanifest" />
  <link rel="stylesheet" href="../style.css">
  <link rel="preconnect" href="../api/output.php">
  <link rel="preconnect" href="../api/directory.php">
  <script type="module" src="../js/genre-page.module.js"></script>
</head>

<body id="genrepage" data-genre-slug="sexy" data-genre-label="Sexy" data-genre-title="Sexy">
  <?php require __DIR__ . '/../includes/header.php'; qc_render_header('../', 'sexy'); ?>
  <?php require __DIR__ . '/../includes/filter-bar.php'; qc_render_filter_bar(false, true); ?>

  <div id="genrelist"></div>

  <?php require __DIR__ . '/../includes/footer.php'; qc_render_footer('../'); ?>
</body>

</html>
