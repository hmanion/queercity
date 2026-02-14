<!DOCTYPE html>
<html lang="en">

<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Queer City - Charity</title>
  <link rel="stylesheet" href="../style.css">
  <link rel="preconnect" href="../api/output.php">
  <link rel="preconnect" href="../api/directory.php">
  <meta charset="utf-8" />
  <script type="module" src="../js/genre-page.module.js"></script>
</head>

<body id="genrepage" data-genre-slug="charity" data-genre-label="Charity" data-genre-title="Charity">
  <?php require __DIR__ . '/../includes/header.php'; qc_render_header('../', 'charity'); ?>

  <section id="genre-links"></section>
  <div id="genrelist"></div>

  <?php require __DIR__ . '/../includes/footer.php'; qc_render_footer('../'); ?>
</body>

</html>
