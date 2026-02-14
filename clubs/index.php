<!DOCTYPE html>
<html lang="en">

<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Queer City - Clubs</title>
  <link rel="stylesheet" href="../style.css">
  <link rel="preconnect" href="../api/output.php">
  <link rel="preconnect" href="../api/directory.php">
  <meta charset="utf-8" />
  <script type="module" src="../js/genre-page.module.js"></script>
</head>

<body id="genrepage" data-genre-slug="clubs" data-genre-label="Club" data-genre-title="Clubs">
  <?php require __DIR__ . '/../includes/header.php'; qc_render_header('../', 'clubs'); ?>

  <section id="genre-links"></section>
  <div id="genrelist"></div>

  <section>
    <a href="../archive/">PAST EVENTS</a>
  </section>

  <section>
    <a href="https://github.com/hmanion/queercity" target="_blank" rel="noopener noreferrer">SOURCE / LICENSE</a>
  </section>
</body>

</html>
